import { randomUUID } from "node:crypto";

import { OutboxConflictError, OutboxLeaseError, OutboxValidationError } from "./errors";
import type { ClaimedOutboxEvent, NewOutboxEvent, OutboxEvent, OutboxRepository } from "./types";
import {
  parseOutboxTimestamp,
  cloneOutboxPayload,
  validateErrorCode,
  validateOutboxIdempotencyKey,
  validateOutboxType,
  validateOutboxUuid,
  validateWorkerId,
} from "./validation";
import { assertMatchingOutboxReplay } from "./writer";

export interface InMemoryOutboxDependencies {
  readonly leaseToken?: () => string;
}

interface MutableOutboxEvent {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
  status: OutboxEvent["status"];
  attemptCount: number;
  availableAt: string;
  lockedAt: string | null;
  processedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
}

function snapshot(event: MutableOutboxEvent): OutboxEvent {
  return Object.freeze({
    id: event.id,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    eventType: event.eventType,
    payload: event.payload,
    idempotencyKey: event.idempotencyKey,
    status: event.status,
    attemptCount: event.attemptCount,
    availableAt: event.availableAt,
    lockedAt: event.lockedAt,
    processedAt: event.processedAt,
    lastErrorCode: event.lastErrorCode,
    createdAt: event.createdAt,
  });
}

/** Deterministic reference implementation; not a production transaction store. */
export class InMemoryOutboxRepository implements OutboxRepository {
  private readonly events = new Map<string, MutableOutboxEvent>();
  private readonly idempotency = new Map<string, string>();
  private readonly createLeaseToken: () => string;

  constructor(dependencies: InMemoryOutboxDependencies = {}) {
    this.createLeaseToken = dependencies.leaseToken ?? randomUUID;
  }

  async insertOutboxEvent(input: NewOutboxEvent): Promise<OutboxEvent> {
    validateOutboxUuid(input.id, "eventId");
    validateOutboxType(input.aggregateType, "aggregateType");
    validateOutboxUuid(input.aggregateId, "aggregateId");
    validateOutboxType(input.eventType, "eventType");
    validateOutboxIdempotencyKey(input.idempotencyKey);
    parseOutboxTimestamp(input.availableAt, "availableAt");
    parseOutboxTimestamp(input.createdAt, "createdAt");
    const existingId = this.idempotency.get(input.idempotencyKey);
    if (existingId !== undefined) {
      const existing = this.events.get(existingId);
      if (existing === undefined) throw new OutboxConflictError();
      assertMatchingOutboxReplay(snapshot(existing), input);
      return snapshot(existing);
    }
    if (this.events.has(input.id)) throw new OutboxConflictError("Outbox event ID already exists");
    const event: MutableOutboxEvent = {
      ...input,
      payload: cloneOutboxPayload(input.payload),
      status: "PENDING",
      attemptCount: 0,
      lockedAt: null,
      processedAt: null,
      lastErrorCode: null,
      leaseToken: null,
      leaseExpiresAt: null,
    };
    this.events.set(event.id, event);
    this.idempotency.set(event.idempotencyKey, event.id);
    return snapshot(event);
  }

  async claimBatch(input: Readonly<{ workerId: string; now: string; limit: number; leaseDurationMs: number }>): Promise<readonly ClaimedOutboxEvent[]> {
    validateWorkerId(input.workerId);
    const now = parseOutboxTimestamp(input.now, "now");
    if (!Number.isSafeInteger(input.limit) || input.limit <= 0 || input.limit > 100) {
      throw new OutboxValidationError("limit must be between 1 and 100");
    }
    if (!Number.isSafeInteger(input.leaseDurationMs) || input.leaseDurationMs <= 0 || input.leaseDurationMs > 60 * 60 * 1_000) {
      throw new OutboxValidationError("leaseDurationMs is outside the allowed range");
    }

    const eligible = [...this.events.values()]
      .filter((event) => {
        if ((event.status === "PENDING" || event.status === "RETRY") && Date.parse(event.availableAt) <= now) return true;
        return event.status === "PROCESSING" && event.leaseExpiresAt !== null && Date.parse(event.leaseExpiresAt) <= now;
      })
      .sort((left, right) => {
        const available = Date.parse(left.availableAt) - Date.parse(right.availableAt);
        if (available !== 0) return available;
        const created = Date.parse(left.createdAt) - Date.parse(right.createdAt);
        return created !== 0 ? created : left.id.localeCompare(right.id);
      })
      .slice(0, input.limit);

    return Object.freeze(
      eligible.map((event) => {
        const leaseToken = `${input.workerId}:${this.createLeaseToken()}`;
        event.status = "PROCESSING";
        event.attemptCount += 1;
        event.lockedAt = input.now;
        event.leaseToken = leaseToken;
        event.leaseExpiresAt = new Date(now + input.leaseDurationMs).toISOString();
        return Object.freeze({
          ...snapshot(event),
          status: "PROCESSING" as const,
          lockedAt: input.now,
          leaseToken,
          leaseExpiresAt: event.leaseExpiresAt,
        });
      }),
    );
  }

  async markPublished(input: Readonly<{ eventId: string; leaseToken: string; processedAt: string }>): Promise<OutboxEvent> {
    parseOutboxTimestamp(input.processedAt, "processedAt");
    const event = this.requireLease(input.eventId, input.leaseToken, input.processedAt);
    event.status = "PUBLISHED";
    event.processedAt = input.processedAt;
    event.lockedAt = null;
    event.leaseToken = null;
    event.leaseExpiresAt = null;
    event.lastErrorCode = null;
    return snapshot(event);
  }

  async markRetry(input: Readonly<{ eventId: string; leaseToken: string; failedAt: string; availableAt: string; errorCode: string }>): Promise<OutboxEvent> {
    parseOutboxTimestamp(input.failedAt, "failedAt");
    const event = this.requireLease(input.eventId, input.leaseToken, input.failedAt);
    parseOutboxTimestamp(input.availableAt, "availableAt");
    validateErrorCode(input.errorCode);
    event.status = "RETRY";
    event.availableAt = input.availableAt;
    event.lockedAt = null;
    event.leaseToken = null;
    event.leaseExpiresAt = null;
    event.lastErrorCode = input.errorCode;
    return snapshot(event);
  }

  async markDeadLetter(input: Readonly<{ eventId: string; leaseToken: string; processedAt: string; errorCode: string }>): Promise<OutboxEvent> {
    parseOutboxTimestamp(input.processedAt, "processedAt");
    const event = this.requireLease(input.eventId, input.leaseToken, input.processedAt);
    validateErrorCode(input.errorCode);
    event.status = "DEAD_LETTER";
    event.processedAt = input.processedAt;
    event.lockedAt = null;
    event.leaseToken = null;
    event.leaseExpiresAt = null;
    event.lastErrorCode = input.errorCode;
    return snapshot(event);
  }

  async getById(eventId: string): Promise<OutboxEvent | null> {
    const event = this.events.get(eventId);
    return event === undefined ? null : snapshot(event);
  }

  private requireLease(eventId: string, leaseToken: string, operationAt: string): MutableOutboxEvent {
    const event = this.events.get(eventId);
    if (
      event === undefined ||
      event.status !== "PROCESSING" ||
      event.leaseToken !== leaseToken ||
      event.leaseExpiresAt === null ||
      Date.parse(event.leaseExpiresAt) <= Date.parse(operationAt)
    ) {
      throw new OutboxLeaseError();
    }
    return event;
  }
}
