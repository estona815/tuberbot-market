import type { ProviderMode } from "../types";

export type StorageObjectState =
  | "AWAITING_UPLOAD"
  | "UPLOADED"
  | "PENDING_SCAN"
  | "CLEAN"
  | "QUARANTINED";

/** QUARANTINED is the internal terminal rejection state exposed generically to users. */
export type StorageScanDisposition = "CLEAN" | "QUARANTINED";

export interface CreateUploadGrantRequest {
  /** Random, opaque key. It must not contain tenant IDs or user filenames. */
  readonly objectKey: string;
  readonly declaredMimeType: string;
  readonly expectedSizeBytes: number;
  readonly expiresAt: string;
}

export interface StorageUploadGrant {
  readonly objectKey: string;
  readonly method: "PUT";
  readonly url: string;
  readonly expiresAt: string;
  readonly requiredHeaders: Readonly<Record<string, string>>;
}

export interface StoredObjectInspection {
  readonly objectKey: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly detectedMimeType: string;
  readonly state: "PENDING_SCAN";
}

export interface CreateDownloadGrantRequest {
  readonly objectKey: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly expiresAt: string;
}

export interface StorageDownloadGrant {
  readonly method: "GET";
  readonly url: string;
  readonly expiresAt: string;
  /** Headers the object store must force on its response. */
  readonly responseHeaders: Readonly<{
    "Cache-Control": "private, no-store";
    "Content-Disposition": string;
    "Content-Type": string;
    "X-Content-Type-Options": "nosniff";
  }>;
}

/**
 * Private object storage port. A production implementation must keep objects
 * private, compute inspection facts server-side, and make completion immutable.
 */
export interface PrivateObjectStorage {
  readonly provider: string;
  readonly mode: ProviderMode;
  createUploadGrant(request: CreateUploadGrantRequest): Promise<StorageUploadGrant>;
  inspectAndSeal(objectKey: string): Promise<StoredObjectInspection>;
  setScanDisposition(objectKey: string, disposition: StorageScanDisposition): Promise<void>;
  createDownloadGrant(request: CreateDownloadGrantRequest): Promise<StorageDownloadGrant>;
}
