import "server-only";

import { PrivateUploadConflictError, PrivateUploadNotFoundError } from "./errors";

/** QUARANTINED matches attachments.malware_scan_status and maps to public REJECTED. */
export type PrivateUploadStatus = "AWAITING_UPLOAD" | "PENDING" | "CLEAN" | "QUARANTINED";

export interface PrivateUploadRecord {
  readonly attachmentId: string;
  readonly actorId: string;
  readonly orderId: string;
  readonly objectKey: string;
  readonly filename: string;
  readonly declaredMimeType: string;
  readonly expectedSizeBytes: number;
  readonly status: PrivateUploadStatus;
  readonly detectedMimeType: string | null;
  readonly sha256: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly scanCompletedAt: string | null;
}

interface IdempotentReference {
  readonly fingerprint: string;
  readonly attachmentId: string;
}

export interface ReserveInitiationInput {
  readonly scope: string;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly record: PrivateUploadRecord;
}

export interface CompletionOperation {
  readonly scope: string;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly attachmentId: string;
}

export interface FinalizeUploadInput extends CompletionOperation {
  readonly status: "PENDING" | "QUARANTINED";
  readonly detectedMimeType: string;
  readonly sha256: string;
  readonly completedAt: string;
}

export interface RecordScanInput {
  readonly attachmentId: string;
  readonly scanEventId: string;
  readonly disposition: "CLEAN" | "QUARANTINED";
  readonly completedAt: string;
}

/** Persistence port; every idempotent mutation must be atomic in production. */
export interface PrivateUploadRepository {
  reserveInitiation(input: ReserveInitiationInput): Promise<PrivateUploadRecord>;
  findById(attachmentId: string): Promise<PrivateUploadRecord | null>;
  findCompletionReplay(input: CompletionOperation): Promise<PrivateUploadRecord | null>;
  finalizeUpload(input: FinalizeUploadInput): Promise<PrivateUploadRecord>;
  recordScan(input: RecordScanInput): Promise<PrivateUploadRecord>;
}

function freezeRecord(record: PrivateUploadRecord): PrivateUploadRecord {
  return Object.freeze({ ...record });
}

/** Isolated metadata registry for deterministic sandbox and unit tests. */
export class InMemoryPrivateUploadRepository implements PrivateUploadRepository {
  private readonly records = new Map<string, PrivateUploadRecord>();
  private readonly initiationKeys = new Map<string, IdempotentReference>();
  private readonly completionKeys = new Map<string, IdempotentReference>();
  private readonly scanEvents = new Map<string, Readonly<{ attachmentId: string; disposition: "CLEAN" | "QUARANTINED" }>>();

  async reserveInitiation(input: ReserveInitiationInput): Promise<PrivateUploadRecord> {
    const key = `${input.scope}\u0000${input.idempotencyKey}`;
    const existing = this.initiationKeys.get(key);
    if (existing !== undefined) {
      if (existing.fingerprint !== input.fingerprint) throw new PrivateUploadConflictError();
      return this.requireRecord(existing.attachmentId);
    }
    if (this.records.has(input.record.attachmentId)) throw new PrivateUploadConflictError();
    const record = freezeRecord(input.record);
    this.records.set(record.attachmentId, record);
    this.initiationKeys.set(key, Object.freeze({ fingerprint: input.fingerprint, attachmentId: record.attachmentId }));
    return record;
  }

  async findById(attachmentId: string): Promise<PrivateUploadRecord | null> {
    return this.records.get(attachmentId) ?? null;
  }

  async findCompletionReplay(input: CompletionOperation): Promise<PrivateUploadRecord | null> {
    const existing = this.completionKeys.get(`${input.scope}\u0000${input.idempotencyKey}`);
    if (existing === undefined) return null;
    if (existing.fingerprint !== input.fingerprint || existing.attachmentId !== input.attachmentId) {
      throw new PrivateUploadConflictError();
    }
    return this.requireRecord(existing.attachmentId);
  }

  async finalizeUpload(input: FinalizeUploadInput): Promise<PrivateUploadRecord> {
    const key = `${input.scope}\u0000${input.idempotencyKey}`;
    const existing = this.completionKeys.get(key);
    if (existing !== undefined) {
      if (existing.fingerprint !== input.fingerprint || existing.attachmentId !== input.attachmentId) {
        throw new PrivateUploadConflictError();
      }
      return this.requireRecord(existing.attachmentId);
    }
    const current = this.requireRecord(input.attachmentId);
    if (current.status !== "AWAITING_UPLOAD") {
      throw new PrivateUploadConflictError();
    }
    const record = freezeRecord({
      ...current,
      status: input.status,
      detectedMimeType: input.detectedMimeType,
      sha256: input.sha256,
      completedAt: input.completedAt,
    });
    this.records.set(record.attachmentId, record);
    this.completionKeys.set(key, Object.freeze({ fingerprint: input.fingerprint, attachmentId: record.attachmentId }));
    return record;
  }

  async recordScan(input: RecordScanInput): Promise<PrivateUploadRecord> {
    const existing = this.scanEvents.get(input.scanEventId);
    if (existing !== undefined) {
      if (existing.attachmentId !== input.attachmentId || existing.disposition !== input.disposition) {
        throw new PrivateUploadConflictError();
      }
      return this.requireRecord(existing.attachmentId);
    }
    const current = this.requireRecord(input.attachmentId);
    if (current.status === input.disposition) {
      this.scanEvents.set(input.scanEventId, Object.freeze({ attachmentId: input.attachmentId, disposition: input.disposition }));
      return current;
    }
    if (current.status !== "PENDING") throw new PrivateUploadConflictError();
    const record = freezeRecord({ ...current, status: input.disposition, scanCompletedAt: input.completedAt });
    this.records.set(record.attachmentId, record);
    this.scanEvents.set(input.scanEventId, Object.freeze({ attachmentId: input.attachmentId, disposition: input.disposition }));
    return record;
  }

  private requireRecord(attachmentId: string): PrivateUploadRecord {
    const record = this.records.get(attachmentId);
    if (record === undefined) throw new PrivateUploadNotFoundError();
    return record;
  }
}
