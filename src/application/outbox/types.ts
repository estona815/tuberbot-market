export type OutboxStatus = "PENDING" | "PROCESSING" | "PUBLISHED" | "RETRY" | "DEAD_LETTER";

export interface OutboxEvent {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
  readonly status: OutboxStatus;
  readonly attemptCount: number;
  readonly availableAt: string;
  readonly lockedAt: string | null;
  readonly processedAt: string | null;
  readonly lastErrorCode: string | null;
  readonly createdAt: string;
}

export interface NewOutboxEvent {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
  readonly availableAt: string;
  readonly createdAt: string;
}

export interface ClaimedOutboxEvent extends OutboxEvent {
  readonly status: "PROCESSING";
  readonly lockedAt: string;
  readonly leaseToken: string;
  readonly leaseExpiresAt: string;
}

/** Must be the transaction object used for the aggregate mutation. */
export interface OutboxTransaction {
  insertOutboxEvent(event: NewOutboxEvent): Promise<OutboxEvent>;
}

export interface OutboxRepository extends OutboxTransaction {
  claimBatch(input: Readonly<{
    workerId: string;
    now: string;
    limit: number;
    leaseDurationMs: number;
  }>): Promise<readonly ClaimedOutboxEvent[]>;
  markPublished(input: Readonly<{ eventId: string; leaseToken: string; processedAt: string }>): Promise<OutboxEvent>;
  markRetry(input: Readonly<{
    eventId: string;
    leaseToken: string;
    failedAt: string;
    availableAt: string;
    errorCode: string;
  }>): Promise<OutboxEvent>;
  markDeadLetter(input: Readonly<{
    eventId: string;
    leaseToken: string;
    processedAt: string;
    errorCode: string;
  }>): Promise<OutboxEvent>;
}

export type OutboxHandler = (event: ClaimedOutboxEvent) => Promise<void>;
