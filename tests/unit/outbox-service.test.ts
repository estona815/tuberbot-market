import { describe, expect, it } from "vitest";

import {
  InMemoryOutboxRepository,
  OutboxConflictError,
  OutboxDeliveryError,
  OutboxDispatcher,
  OutboxLeaseError,
  TransactionalOutboxWriter,
} from "../../src/application/outbox";

const AGGREGATE_ID = "00000000-0000-4000-8000-000000000101";

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

describe("transactional outbox writer and repository", () => {
  it("deduplicates a canonical replay, rejects conflicting reuse, and snapshots mutable payloads", async () => {
    const repository = new InMemoryOutboxRepository();
    let idSequence = 200;
    const writer = new TransactionalOutboxWriter({
      now: () => new Date("2026-08-02T07:00:00.000Z"),
      id: () => uuid(++idSequence),
    });
    const mutable = { nested: { value: 1 }, label: "created" };
    const first = await writer.append(repository, {
      aggregateType: "Order",
      aggregateId: AGGREGATE_ID,
      eventType: "OrderCreated",
      payload: mutable,
      idempotencyKey: "outbox-order-created-001",
    });
    mutable.nested.value = 99;
    expect(first.payload).toEqual({ label: "created", nested: { value: 1 } });

    const replay = await writer.append(repository, {
      aggregateType: "Order",
      aggregateId: AGGREGATE_ID,
      eventType: "OrderCreated",
      payload: { label: "created", nested: { value: 1 } },
      idempotencyKey: "outbox-order-created-001",
    });
    expect(replay.id).toBe(first.id);
    await expect(
      writer.append(repository, {
        aggregateType: "Order",
        aggregateId: AGGREGATE_ID,
        eventType: "OrderCreated",
        payload: { label: "different" },
        idempotencyKey: "outbox-order-created-001",
      }),
    ).rejects.toBeInstanceOf(OutboxConflictError);
  });

  it("claims exclusively, recovers an expired lease, and rejects a stale worker acknowledgement", async () => {
    let token = 0;
    const repository = new InMemoryOutboxRepository({ leaseToken: () => `lease_${++token}` });
    let idSequence = 300;
    const writer = new TransactionalOutboxWriter({
      now: () => new Date("2026-08-02T07:10:00.000Z"),
      id: () => uuid(++idSequence),
    });
    for (const suffix of ["a", "b"] as const) {
      await writer.append(repository, {
        aggregateType: "Order",
        aggregateId: AGGREGATE_ID,
        eventType: "OrderChanged",
        payload: { suffix },
        idempotencyKey: `outbox-claim-${suffix}`,
      });
    }

    const firstWorker = await repository.claimBatch({
      workerId: "worker_a",
      now: "2026-08-02T07:10:00.000Z",
      limit: 1,
      leaseDurationMs: 1_000,
    });
    const secondWorker = await repository.claimBatch({
      workerId: "worker_b",
      now: "2026-08-02T07:10:00.000Z",
      limit: 10,
      leaseDurationMs: 1_000,
    });
    expect(firstWorker).toHaveLength(1);
    expect(secondWorker).toHaveLength(1);
    expect(secondWorker[0]?.id).not.toBe(firstWorker[0]?.id);

    const recovered = await repository.claimBatch({
      workerId: "worker_recovery",
      now: "2026-08-02T07:10:01.000Z",
      limit: 1,
      leaseDurationMs: 1_000,
    });
    expect(recovered[0]?.id).toBe(firstWorker[0]?.id);
    expect(recovered[0]?.attemptCount).toBe(2);
    await expect(
      repository.markPublished({
        eventId: firstWorker[0]?.id ?? "",
        leaseToken: firstWorker[0]?.leaseToken ?? "",
        processedAt: "2026-08-02T07:10:01.001Z",
      }),
    ).rejects.toBeInstanceOf(OutboxLeaseError);
    await expect(
      repository.markPublished({
        eventId: recovered[0]?.id ?? "",
        leaseToken: recovered[0]?.leaseToken ?? "",
        processedAt: "2026-08-02T07:10:01.001Z",
      }),
    ).resolves.toMatchObject({ status: "PUBLISHED" });
  });

  it("uses the original absolute lease expiry and cannot be tricked by a shorter reclaim TTL", async () => {
    const repository = new InMemoryOutboxRepository({ leaseToken: () => "absolute_lease" });
    const writer = new TransactionalOutboxWriter({
      now: () => new Date("2026-08-02T07:15:00.000Z"),
      id: () => uuid(350),
    });
    await writer.append(repository, {
      aggregateType: "Order",
      aggregateId: AGGREGATE_ID,
      eventType: "OrderChanged",
      payload: {},
      idempotencyKey: "outbox-absolute-lease-001",
    });
    const original = await repository.claimBatch({
      workerId: "worker_long_lease",
      now: "2026-08-02T07:15:00.000Z",
      limit: 1,
      leaseDurationMs: 10_000,
    });
    expect(original[0]?.leaseExpiresAt).toBe("2026-08-02T07:15:10.000Z");

    await expect(
      repository.claimBatch({
        workerId: "worker_short_ttl",
        now: "2026-08-02T07:15:01.000Z",
        limit: 1,
        leaseDurationMs: 1,
      }),
    ).resolves.toEqual([]);
    await expect(
      repository.claimBatch({
        workerId: "worker_after_expiry",
        now: "2026-08-02T07:15:10.000Z",
        limit: 1,
        leaseDurationMs: 1_000,
      }),
    ).resolves.toHaveLength(1);
  });
});

describe("outbox dispatcher", () => {
  it("applies deterministic exponential retry timing and then publishes", async () => {
    let nowMs = Date.parse("2026-08-02T07:20:00.000Z");
    const now = () => new Date(nowMs);
    const repository = new InMemoryOutboxRepository({ leaseToken: () => "lease_retry" });
    const writer = new TransactionalOutboxWriter({ now, id: () => uuid(401) });
    const event = await writer.append(repository, {
      aggregateType: "Order",
      aggregateId: AGGREGATE_ID,
      eventType: "NotifyBuyer",
      payload: { orderId: AGGREGATE_ID },
      idempotencyKey: "outbox-notify-buyer-001",
    });
    let calls = 0;
    const dispatcher = new OutboxDispatcher({
      repository,
      now,
      leaseDurationMs: 5_000,
      baseRetryDelayMs: 1_000,
      maximumRetryDelayMs: 8_000,
      handlers: {
        NotifyBuyer: async () => {
          calls += 1;
          if (calls === 1) throw new OutboxDeliveryError("REMOTE_TIMEOUT", true);
        },
      },
    });

    await expect(dispatcher.runOnce({ workerId: "dispatcher_a" })).resolves.toEqual({
      claimed: 1,
      published: 0,
      retried: 1,
      deadLettered: 0,
    });
    expect(await repository.getById(event.id)).toMatchObject({
      status: "RETRY",
      attemptCount: 1,
      availableAt: "2026-08-02T07:20:01.000Z",
      lastErrorCode: "REMOTE_TIMEOUT",
    });
    await expect(dispatcher.runOnce({ workerId: "dispatcher_a" })).resolves.toMatchObject({ claimed: 0 });
    nowMs += 1_000;
    await expect(dispatcher.runOnce({ workerId: "dispatcher_a" })).resolves.toEqual({
      claimed: 1,
      published: 1,
      retried: 0,
      deadLettered: 0,
    });
    expect(await repository.getById(event.id)).toMatchObject({ status: "PUBLISHED", attemptCount: 2 });
  });

  it("dead-letters non-retryable and unexpected terminal failures with sanitized codes", async () => {
    let idSequence = 500;
    const now = () => new Date("2026-08-02T07:30:00.000Z");
    const repository = new InMemoryOutboxRepository({ leaseToken: () => `lease_${idSequence}` });
    const writer = new TransactionalOutboxWriter({ now, id: () => uuid(++idSequence) });
    const invalid = await writer.append(repository, {
      aggregateType: "Order",
      aggregateId: AGGREGATE_ID,
      eventType: "InvalidDestination",
      payload: {},
      idempotencyKey: "outbox-invalid-destination-001",
    });
    const unexpected = await writer.append(repository, {
      aggregateType: "Order",
      aggregateId: AGGREGATE_ID,
      eventType: "UnexpectedFailure",
      payload: {},
      idempotencyKey: "outbox-unexpected-failure-001",
    });
    const dispatcher = new OutboxDispatcher({
      repository,
      now,
      maximumAttempts: 1,
      handlers: {
        InvalidDestination: async () => {
          throw new OutboxDeliveryError("INVALID_DESTINATION", false);
        },
        UnexpectedFailure: async () => {
          throw new Error("secret provider response must not persist");
        },
      },
    });
    await expect(dispatcher.runOnce({ workerId: "dispatcher_terminal" })).resolves.toEqual({
      claimed: 2,
      published: 0,
      retried: 0,
      deadLettered: 2,
    });
    expect(await repository.getById(invalid.id)).toMatchObject({ status: "DEAD_LETTER", lastErrorCode: "INVALID_DESTINATION" });
    expect(await repository.getById(unexpected.id)).toMatchObject({ status: "DEAD_LETTER", lastErrorCode: "UNEXPECTED_HANDLER_ERROR" });
  });
});
