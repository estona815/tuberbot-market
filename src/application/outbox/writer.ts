import { createHash, randomUUID } from "node:crypto";

import { OutboxConflictError } from "./errors";
import type { NewOutboxEvent, OutboxEvent, OutboxTransaction } from "./types";
import {
  canonicalizeOutboxPayload,
  cloneOutboxPayload,
  parseOutboxTimestamp,
  validateOutboxIdempotencyKey,
  validateOutboxType,
  validateOutboxUuid,
} from "./validation";

export interface AppendOutboxEventInput {
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
  readonly availableAt?: string;
}

export interface TransactionalOutboxDependencies {
  readonly now?: () => Date;
  readonly id?: () => string;
}

export function outboxEventFingerprint(event: Pick<NewOutboxEvent, "aggregateType" | "aggregateId" | "eventType" | "payload">): string {
  return createHash("sha256")
    .update(
      [event.aggregateType, event.aggregateId, event.eventType, canonicalizeOutboxPayload(event.payload)].join("\u0000"),
    )
    .digest("hex");
}

/**
 * Builds and inserts an event through the caller's transaction. The caller must
 * pass the same transaction that commits the aggregate state change.
 */
export class TransactionalOutboxWriter {
  private readonly now: () => Date;
  private readonly id: () => string;

  constructor(dependencies: TransactionalOutboxDependencies = {}) {
    this.now = dependencies.now ?? (() => new Date());
    this.id = dependencies.id ?? randomUUID;
  }

  async append(transaction: OutboxTransaction, input: AppendOutboxEventInput): Promise<OutboxEvent> {
    validateOutboxType(input.aggregateType, "aggregateType");
    validateOutboxUuid(input.aggregateId, "aggregateId");
    validateOutboxType(input.eventType, "eventType");
    validateOutboxIdempotencyKey(input.idempotencyKey);
    const payload = cloneOutboxPayload(input.payload);
    const now = this.now().toISOString();
    const availableAt = input.availableAt ?? now;
    parseOutboxTimestamp(availableAt, "availableAt");
    const eventId = this.id();
    validateOutboxUuid(eventId, "eventId");
    return transaction.insertOutboxEvent(
      Object.freeze({
        id: eventId,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload,
        idempotencyKey: input.idempotencyKey,
        availableAt,
        createdAt: now,
      }),
    );
  }
}

export function assertMatchingOutboxReplay(existing: OutboxEvent, incoming: NewOutboxEvent): void {
  if (outboxEventFingerprint(existing) !== outboxEventFingerprint(incoming)) {
    throw new OutboxConflictError();
  }
}
