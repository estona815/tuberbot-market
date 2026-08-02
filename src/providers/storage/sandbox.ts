import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";

import { detectPrivateUploadMime } from "./content-inspection";
import { StorageStateError, StorageValidationError } from "./errors";
import type {
  CreateDownloadGrantRequest,
  CreateUploadGrantRequest,
  PrivateObjectStorage,
  StorageDownloadGrant,
  StorageObjectState,
  StorageScanDisposition,
  StorageUploadGrant,
  StoredObjectInspection,
} from "./types";

const MAX_UPLOAD_GRANT_MS = 15 * 60 * 1_000;
const MAX_DOWNLOAD_GRANT_MS = 5 * 60 * 1_000;

export interface SandboxStorageDependencies {
  readonly now?: () => Date;
  readonly token?: (purpose: "upload" | "download") => string;
}

interface SandboxObject {
  readonly objectKey: string;
  readonly declaredMimeType: string;
  readonly expectedSizeBytes: number;
  state: StorageObjectState;
  body?: Uint8Array;
  inspection?: StoredObjectInspection;
  uploadGrant?: StorageUploadGrant;
}

interface DownloadToken {
  readonly objectKey: string;
  readonly expiresAt: string;
  readonly responseHeaders: StorageDownloadGrant["responseHeaders"];
}

interface UploadToken {
  readonly objectKey: string;
  readonly expiresAt: string;
}

function parseTimestamp(value: string, field: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new StorageValidationError("INVALID_EXPIRY", `${field} must be an ISO-8601 timestamp`);
  }
  return timestamp;
}

function requireGrantWindow(now: number, expiresAt: string, maximumMs: number): void {
  const expiry = parseTimestamp(expiresAt, "expiresAt");
  if (expiry <= now || expiry - now > maximumMs) {
    throw new StorageValidationError("INVALID_EXPIRY", "Signed URL expiry is outside the allowed window");
  }
}

function parseSandboxUrl(rawUrl: string, purpose: "upload" | "download"): string {
  const url = new URL(rawUrl);
  const token = url.pathname.slice(1);
  if (url.protocol !== "sandbox-storage:" || url.hostname !== purpose || token.length === 0) {
    throw new StorageValidationError("INVALID_SIGNED_URL", "Signed URL is invalid");
  }
  return token;
}

function header(headers: Readonly<Record<string, string>>, name: string): string | undefined {
  const normalizedName = name.toLowerCase();
  return Object.entries(headers).find(([key]) => key.toLowerCase() === normalizedName)?.[1];
}

function encodeFilename(filename: string): string {
  return encodeURIComponent(filename).replace(/[!'()*]/gu, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function contentDisposition(filename: string): string {
  const extension = /^\.[a-z0-9]{1,8}$/u.test(extname(filename).toLowerCase())
    ? extname(filename).toLowerCase()
    : "";
  return `attachment; filename="download${extension}"; filename*=UTF-8''${encodeFilename(filename)}`;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Isolated in-memory adapter for tests and local sandbox verification only. */
export class SandboxPrivateObjectStorage implements PrivateObjectStorage {
  readonly provider = "sandbox-memory";
  readonly mode = "SANDBOX" as const;
  private readonly now: () => Date;
  private readonly createToken: (purpose: "upload" | "download") => string;
  private readonly objects = new Map<string, SandboxObject>();
  private readonly uploadTokens = new Map<string, UploadToken>();
  private readonly downloadTokens = new Map<string, DownloadToken>();

  constructor(dependencies: SandboxStorageDependencies = {}) {
    this.now = dependencies.now ?? (() => new Date());
    this.createToken = dependencies.token ?? ((purpose) => `${purpose}_${randomUUID()}`);
  }

  async createUploadGrant(request: CreateUploadGrantRequest): Promise<StorageUploadGrant> {
    if (!/^private\/[A-Za-z0-9_-]{22,128}$/u.test(request.objectKey)) {
      throw new StorageValidationError("NON_OPAQUE_KEY", "Object key is not an opaque private key");
    }
    if (!Number.isSafeInteger(request.expectedSizeBytes) || request.expectedSizeBytes <= 0) {
      throw new StorageValidationError("INVALID_SIZE", "Expected size must be a positive safe integer");
    }
    requireGrantWindow(this.now().getTime(), request.expiresAt, MAX_UPLOAD_GRANT_MS);

    const existing = this.objects.get(request.objectKey);
    if (existing !== undefined) {
      if (existing.declaredMimeType !== request.declaredMimeType || existing.expectedSizeBytes !== request.expectedSizeBytes) {
        throw new StorageValidationError("OBJECT_KEY_CONFLICT", "Object key was reused with different upload facts");
      }
      if (existing.uploadGrant !== undefined && Date.parse(existing.uploadGrant.expiresAt) > this.now().getTime()) {
        return existing.uploadGrant;
      }
      if (existing.state !== "AWAITING_UPLOAD") {
        throw new StorageStateError("OBJECT_IMMUTABLE");
      }
    }

    const token = this.createToken("upload");
    if (this.uploadTokens.has(token)) {
      throw new StorageValidationError("TOKEN_COLLISION", "Upload token collision");
    }
    const grant = Object.freeze({
      objectKey: request.objectKey,
      method: "PUT" as const,
      url: `sandbox-storage://upload/${encodeURIComponent(token)}`,
      expiresAt: request.expiresAt,
      requiredHeaders: Object.freeze({
        "Content-Length": request.expectedSizeBytes.toString(),
        "Content-Type": request.declaredMimeType,
      }),
    });
    const object = existing ?? {
      objectKey: request.objectKey,
      declaredMimeType: request.declaredMimeType,
      expectedSizeBytes: request.expectedSizeBytes,
      state: "AWAITING_UPLOAD" as const,
    };
    object.uploadGrant = grant;
    this.objects.set(request.objectKey, object);
    this.uploadTokens.set(token, Object.freeze({ objectKey: request.objectKey, expiresAt: request.expiresAt }));
    return grant;
  }

  /** Test-only stand-in for a browser PUT to the sandbox signed URL. */
  async putSignedUpload(rawUrl: string, body: Uint8Array, headers: Readonly<Record<string, string>>): Promise<void> {
    const token = decodeURIComponent(parseSandboxUrl(rawUrl, "upload"));
    const signedToken = this.uploadTokens.get(token);
    const object = signedToken === undefined ? undefined : this.objects.get(signedToken.objectKey);
    if (object === undefined || object.uploadGrant === undefined) {
      throw new StorageValidationError("INVALID_SIGNED_URL", "Upload grant was not found");
    }
    if (signedToken === undefined || Date.parse(signedToken.expiresAt) <= this.now().getTime()) {
      throw new StorageValidationError("SIGNED_URL_EXPIRED", "Upload grant expired");
    }
    if (header(headers, "content-type") !== object.declaredMimeType || Number(header(headers, "content-length")) !== object.expectedSizeBytes) {
      throw new StorageValidationError("SIGNED_HEADERS_MISMATCH", "Signed upload headers do not match");
    }
    if (body.byteLength !== object.expectedSizeBytes) {
      throw new StorageValidationError("SIZE_MISMATCH", "Uploaded body size does not match");
    }
    if (object.state !== "AWAITING_UPLOAD" && object.state !== "UPLOADED") {
      throw new StorageStateError("OBJECT_IMMUTABLE");
    }
    if (object.body !== undefined && sha256(object.body) !== sha256(body)) {
      throw new StorageStateError("UPLOAD_REPLAY_MISMATCH", "Upload grant cannot replace existing bytes");
    }
    object.body = Uint8Array.from(body);
    object.state = "UPLOADED";
  }

  async inspectAndSeal(objectKey: string): Promise<StoredObjectInspection> {
    const object = this.requireObject(objectKey);
    if (object.inspection !== undefined) return object.inspection;
    if (object.state !== "UPLOADED" || object.body === undefined) {
      throw new StorageStateError("UPLOAD_NOT_COMPLETE", "Uploaded bytes are not available");
    }
    const inspection = Object.freeze({
      objectKey,
      sizeBytes: object.body.byteLength,
      sha256: sha256(object.body),
      detectedMimeType: detectPrivateUploadMime(object.body),
      state: "PENDING_SCAN" as const,
    });
    object.inspection = inspection;
    object.state = "PENDING_SCAN";
    return inspection;
  }

  async setScanDisposition(objectKey: string, disposition: StorageScanDisposition): Promise<void> {
    const object = this.requireObject(objectKey);
    if (object.state === disposition) return;
    if (object.state !== "PENDING_SCAN") {
      throw new StorageStateError("INVALID_SCAN_TRANSITION", "Object is not awaiting a scan verdict");
    }
    object.state = disposition;
  }

  async createDownloadGrant(request: CreateDownloadGrantRequest): Promise<StorageDownloadGrant> {
    const object = this.requireObject(request.objectKey);
    if (object.state !== "CLEAN") {
      throw new StorageStateError("OBJECT_NOT_CLEAN", "Object is not cleared for download");
    }
    requireGrantWindow(this.now().getTime(), request.expiresAt, MAX_DOWNLOAD_GRANT_MS);
    const responseHeaders = Object.freeze({
      "Cache-Control": "private, no-store" as const,
      "Content-Disposition": contentDisposition(request.filename),
      "Content-Type": request.mimeType,
      "X-Content-Type-Options": "nosniff" as const,
    });
    const token = this.createToken("download");
    if (this.downloadTokens.has(token)) {
      throw new StorageValidationError("TOKEN_COLLISION", "Download token collision");
    }
    this.downloadTokens.set(token, {
      objectKey: request.objectKey,
      expiresAt: request.expiresAt,
      responseHeaders,
    });
    return Object.freeze({
      method: "GET" as const,
      url: `sandbox-storage://download/${encodeURIComponent(token)}`,
      expiresAt: request.expiresAt,
      responseHeaders,
    });
  }

  /** Test-only stand-in for following a sandbox download grant. */
  async readSignedDownload(rawUrl: string): Promise<Readonly<{ body: Uint8Array; headers: StorageDownloadGrant["responseHeaders"] }>> {
    const token = decodeURIComponent(parseSandboxUrl(rawUrl, "download"));
    const grant = this.downloadTokens.get(token);
    if (grant === undefined || Date.parse(grant.expiresAt) <= this.now().getTime()) {
      throw new StorageValidationError("SIGNED_URL_EXPIRED", "Download grant is invalid or expired");
    }
    const object = this.requireObject(grant.objectKey);
    if (object.state !== "CLEAN" || object.body === undefined) {
      throw new StorageStateError("OBJECT_NOT_CLEAN");
    }
    return Object.freeze({ body: Uint8Array.from(object.body), headers: grant.responseHeaders });
  }

  private requireObject(objectKey: string): SandboxObject {
    const object = this.objects.get(objectKey);
    if (object === undefined) throw new StorageStateError("OBJECT_NOT_FOUND");
    return object;
  }
}
