import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { validateIdempotencyKey } from "@/domain/idempotency";
import type { PrivateObjectStorage, StorageDownloadGrant, StorageUploadGrant } from "@/providers/storage";

import { PrivateUploadNotFoundError, PrivateUploadUnavailableError, PrivateUploadValidationError } from "./errors";
import { createOpaquePrivateObjectKey, validateCompletedUpload, validateUploadDeclaration } from "./policy";
import type { PrivateUploadRecord, PrivateUploadRepository } from "./registry";

const DEFAULT_UPLOAD_GRANT_MS = 5 * 60 * 1_000;
const DEFAULT_DOWNLOAD_GRANT_MS = 60 * 1_000;

export interface UploadAuthorizationPort {
  assertCanUpload(input: Readonly<{ actorId: string; orderId: string }>): Promise<void>;
  assertCanDownload(input: Readonly<{ actorId: string; orderId: string; attachmentId: string }>): Promise<void>;
}

export interface PrivateUploadServiceDependencies {
  readonly storage: PrivateObjectStorage;
  readonly repository: PrivateUploadRepository;
  readonly authorization: UploadAuthorizationPort;
  readonly now?: () => Date;
  readonly attachmentId?: () => string;
  readonly opaqueObjectId?: () => string;
  readonly uploadGrantMs?: number;
  readonly downloadGrantMs?: number;
}

export interface InitiatePrivateUploadInput {
  readonly actorId: string;
  readonly orderId: string;
  readonly filename: string;
  readonly declaredMimeType: string;
  readonly expectedSizeBytes: number;
  readonly idempotencyKey: string;
}

export interface InitiatedPrivateUpload {
  readonly attachmentId: string;
  readonly orderId: string;
  readonly status: "AWAITING_UPLOAD";
  readonly upload: Omit<StorageUploadGrant, "objectKey">;
}

export interface CompletedPrivateUpload {
  readonly attachmentId: string;
  readonly orderId: string;
  readonly status: "PENDING" | "CLEAN" | "REJECTED";
  readonly detectedMimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

function iso(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new PrivateUploadValidationError("INVALID_CLOCK");
  return date.toISOString();
}

function requireIdentifier(value: string, field: string): void {
  if (value.trim().length === 0 || value.length > 128 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new PrivateUploadValidationError("INVALID_IDENTIFIER", `${field} is invalid`);
  }
}

function fingerprint(parts: readonly (string | number)[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function completionResult(record: PrivateUploadRecord): CompletedPrivateUpload {
  if (record.detectedMimeType === null || record.sha256 === null) throw new PrivateUploadUnavailableError("SCAN_PENDING");
  return Object.freeze({
    attachmentId: record.attachmentId,
    orderId: record.orderId,
    status: record.status === "QUARANTINED"
      ? "REJECTED"
      : record.status === "AWAITING_UPLOAD"
        ? "PENDING"
        : record.status,
    detectedMimeType: record.detectedMimeType,
    sizeBytes: record.expectedSizeBytes,
    sha256: record.sha256,
  });
}

export class PrivateUploadService {
  private readonly storage: PrivateObjectStorage;
  private readonly repository: PrivateUploadRepository;
  private readonly authorization: UploadAuthorizationPort;
  private readonly now: () => Date;
  private readonly attachmentId: () => string;
  private readonly opaqueObjectId: () => string;
  private readonly uploadGrantMs: number;
  private readonly downloadGrantMs: number;

  get storageMode(): PrivateObjectStorage["mode"] {
    return this.storage.mode;
  }

  constructor(dependencies: PrivateUploadServiceDependencies) {
    this.storage = dependencies.storage;
    this.repository = dependencies.repository;
    this.authorization = dependencies.authorization;
    this.now = dependencies.now ?? (() => new Date());
    this.attachmentId = dependencies.attachmentId ?? randomUUID;
    this.opaqueObjectId = dependencies.opaqueObjectId ?? (() => randomBytes(24).toString("base64url"));
    this.uploadGrantMs = dependencies.uploadGrantMs ?? DEFAULT_UPLOAD_GRANT_MS;
    this.downloadGrantMs = dependencies.downloadGrantMs ?? DEFAULT_DOWNLOAD_GRANT_MS;
    if (!Number.isSafeInteger(this.uploadGrantMs) || this.uploadGrantMs <= 0 || this.uploadGrantMs > 15 * 60 * 1_000) {
      throw new PrivateUploadValidationError("INVALID_UPLOAD_GRANT_TTL");
    }
    if (!Number.isSafeInteger(this.downloadGrantMs) || this.downloadGrantMs <= 0 || this.downloadGrantMs > 5 * 60 * 1_000) {
      throw new PrivateUploadValidationError("INVALID_DOWNLOAD_GRANT_TTL");
    }
  }

  async initiate(input: InitiatePrivateUploadInput): Promise<InitiatedPrivateUpload> {
    requireIdentifier(input.actorId, "actorId");
    requireIdentifier(input.orderId, "orderId");
    validateIdempotencyKey(input.idempotencyKey);
    const declaration = validateUploadDeclaration(input);
    await this.authorization.assertCanUpload({ actorId: input.actorId, orderId: input.orderId });

    const requestFingerprint = fingerprint([
      input.actorId,
      input.orderId,
      declaration.filename,
      declaration.declaredMimeType,
      declaration.expectedSizeBytes,
    ]);
    const createdAt = iso(this.now());
    const record = await this.repository.reserveInitiation({
      scope: `upload:initiate:${input.actorId}`,
      idempotencyKey: input.idempotencyKey,
      fingerprint: requestFingerprint,
      record: Object.freeze({
        attachmentId: this.attachmentId(),
        actorId: input.actorId,
        orderId: input.orderId,
        objectKey: createOpaquePrivateObjectKey(this.opaqueObjectId()),
        filename: declaration.filename,
        declaredMimeType: declaration.declaredMimeType,
        expectedSizeBytes: declaration.expectedSizeBytes,
        status: "AWAITING_UPLOAD" as const,
        detectedMimeType: null,
        sha256: null,
        createdAt,
        completedAt: null,
        scanCompletedAt: null,
      }),
    });
    const expiresAt = iso(new Date(this.now().getTime() + this.uploadGrantMs));
    const grant = await this.storage.createUploadGrant({
      objectKey: record.objectKey,
      declaredMimeType: record.declaredMimeType,
      expectedSizeBytes: record.expectedSizeBytes,
      expiresAt,
    });
    const publicGrant = Object.freeze({
      method: grant.method,
      url: grant.url,
      expiresAt: grant.expiresAt,
      requiredHeaders: grant.requiredHeaders,
    });
    return Object.freeze({
      attachmentId: record.attachmentId,
      orderId: record.orderId,
      status: "AWAITING_UPLOAD" as const,
      upload: publicGrant,
    });
  }

  async complete(input: Readonly<{ actorId: string; attachmentId: string; idempotencyKey: string }>): Promise<CompletedPrivateUpload> {
    requireIdentifier(input.actorId, "actorId");
    requireIdentifier(input.attachmentId, "attachmentId");
    validateIdempotencyKey(input.idempotencyKey);
    const current = await this.requireRecord(input.attachmentId);
    await this.authorization.assertCanUpload({ actorId: input.actorId, orderId: current.orderId });
    const requestFingerprint = fingerprint([input.actorId, input.attachmentId]);
    const operation = {
      scope: `upload:complete:${input.actorId}`,
      idempotencyKey: input.idempotencyKey,
      fingerprint: requestFingerprint,
      attachmentId: input.attachmentId,
    };
    const replay = await this.repository.findCompletionReplay(operation);
    if (replay !== null) {
      if (replay.status === "QUARANTINED") throw new PrivateUploadUnavailableError("UPLOAD_REJECTED");
      return completionResult(replay);
    }

    const inspection = await this.storage.inspectAndSeal(current.objectKey);
    let status: "PENDING" | "QUARANTINED" = "PENDING";
    try {
      validateCompletedUpload(
        {
          filename: current.filename,
          declaredMimeType: current.declaredMimeType,
          expectedSizeBytes: current.expectedSizeBytes,
        },
        inspection,
      );
    } catch (error) {
      if (!(error instanceof PrivateUploadValidationError)) throw error;
      status = "QUARANTINED";
      await this.storage.setScanDisposition(current.objectKey, "QUARANTINED");
    }
    const record = await this.repository.finalizeUpload({
      ...operation,
      status,
      detectedMimeType: inspection.detectedMimeType,
      sha256: inspection.sha256,
      completedAt: iso(this.now()),
    });
    if (record.status === "QUARANTINED") throw new PrivateUploadUnavailableError("UPLOAD_REJECTED");
    return completionResult(record);
  }

  async recordScanResult(input: Readonly<{
    attachmentId: string;
    scanEventId: string;
    disposition: "CLEAN" | "REJECTED";
  }>): Promise<CompletedPrivateUpload> {
    requireIdentifier(input.attachmentId, "attachmentId");
    validateIdempotencyKey(input.scanEventId);
    const current = await this.requireRecord(input.attachmentId);
    const internalDisposition = input.disposition === "REJECTED" ? "QUARANTINED" : "CLEAN";
    if (current.status !== "PENDING" && current.status !== internalDisposition) {
      throw new PrivateUploadUnavailableError(current.status === "QUARANTINED" ? "UPLOAD_REJECTED" : "SCAN_PENDING");
    }
    await this.storage.setScanDisposition(current.objectKey, internalDisposition);
    const record = await this.repository.recordScan({
      attachmentId: input.attachmentId,
      scanEventId: input.scanEventId,
      disposition: internalDisposition,
      completedAt: iso(this.now()),
    });
    return completionResult(record);
  }

  async createDownload(input: Readonly<{ actorId: string; attachmentId: string }>): Promise<StorageDownloadGrant> {
    requireIdentifier(input.actorId, "actorId");
    requireIdentifier(input.attachmentId, "attachmentId");
    const record = await this.requireRecord(input.attachmentId);
    await this.authorization.assertCanDownload({ actorId: input.actorId, orderId: record.orderId, attachmentId: record.attachmentId });
    if (record.status !== "CLEAN" || record.detectedMimeType === null) {
      throw new PrivateUploadUnavailableError(record.status === "QUARANTINED" ? "UPLOAD_REJECTED" : "SCAN_PENDING");
    }
    return this.storage.createDownloadGrant({
      objectKey: record.objectKey,
      filename: record.filename,
      mimeType: record.detectedMimeType,
      expiresAt: iso(new Date(this.now().getTime() + this.downloadGrantMs)),
    });
  }

  private async requireRecord(attachmentId: string): Promise<PrivateUploadRecord> {
    const record = await this.repository.findById(attachmentId);
    if (record === null) throw new PrivateUploadNotFoundError();
    return record;
  }
}
