import { OutboxDeliveryError, OutboxValidationError } from "./errors";
import type { ClaimedOutboxEvent, OutboxHandler, OutboxRepository } from "./types";
import { validateWorkerId } from "./validation";

export interface OutboxDispatcherDependencies {
  readonly repository: OutboxRepository;
  readonly handlers: Readonly<Record<string, OutboxHandler>>;
  readonly now?: () => Date;
  readonly leaseDurationMs?: number;
  readonly maximumAttempts?: number;
  readonly baseRetryDelayMs?: number;
  readonly maximumRetryDelayMs?: number;
}

export interface DispatchBatchResult {
  readonly claimed: number;
  readonly published: number;
  readonly retried: number;
  readonly deadLettered: number;
}

function validatePositiveInteger(value: number, field: string, maximum: number): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new OutboxValidationError(`${field} is outside the allowed range`);
  }
}

export class OutboxDispatcher {
  private readonly repository: OutboxRepository;
  private readonly handlers: Readonly<Record<string, OutboxHandler>>;
  private readonly now: () => Date;
  private readonly leaseDurationMs: number;
  private readonly maximumAttempts: number;
  private readonly baseRetryDelayMs: number;
  private readonly maximumRetryDelayMs: number;

  constructor(dependencies: OutboxDispatcherDependencies) {
    this.repository = dependencies.repository;
    this.handlers = dependencies.handlers;
    this.now = dependencies.now ?? (() => new Date());
    this.leaseDurationMs = dependencies.leaseDurationMs ?? 30_000;
    this.maximumAttempts = dependencies.maximumAttempts ?? 5;
    this.baseRetryDelayMs = dependencies.baseRetryDelayMs ?? 1_000;
    this.maximumRetryDelayMs = dependencies.maximumRetryDelayMs ?? 5 * 60_000;
    validatePositiveInteger(this.leaseDurationMs, "leaseDurationMs", 60 * 60_000);
    validatePositiveInteger(this.maximumAttempts, "maximumAttempts", 100);
    validatePositiveInteger(this.baseRetryDelayMs, "baseRetryDelayMs", 60 * 60_000);
    validatePositiveInteger(this.maximumRetryDelayMs, "maximumRetryDelayMs", 24 * 60 * 60_000);
    if (this.maximumRetryDelayMs < this.baseRetryDelayMs) {
      throw new OutboxValidationError("maximumRetryDelayMs must not be less than baseRetryDelayMs");
    }
  }

  async runOnce(input: Readonly<{ workerId: string; batchSize?: number }>): Promise<DispatchBatchResult> {
    validateWorkerId(input.workerId);
    const batchSize = input.batchSize ?? 20;
    validatePositiveInteger(batchSize, "batchSize", 100);
    const claimed = await this.repository.claimBatch({
      workerId: input.workerId,
      now: this.now().toISOString(),
      limit: batchSize,
      leaseDurationMs: this.leaseDurationMs,
    });
    let published = 0;
    let retried = 0;
    let deadLettered = 0;

    for (const event of claimed) {
      if (event.attemptCount > this.maximumAttempts) {
        await this.deadLetter(event, "LEASE_ATTEMPTS_EXHAUSTED");
        deadLettered += 1;
        continue;
      }
      const handler = this.handlers[event.eventType];
      if (handler === undefined) {
        await this.deadLetter(event, "HANDLER_NOT_REGISTERED");
        deadLettered += 1;
        continue;
      }
      try {
        await handler(event);
        await this.repository.markPublished({
          eventId: event.id,
          leaseToken: event.leaseToken,
          processedAt: this.now().toISOString(),
        });
        published += 1;
      } catch (error) {
        const failure = error instanceof OutboxDeliveryError
          ? error
          : new OutboxDeliveryError("UNEXPECTED_HANDLER_ERROR", true);
        if (!failure.retryable || event.attemptCount >= this.maximumAttempts) {
          await this.deadLetter(event, failure.code);
          deadLettered += 1;
          continue;
        }
        const exponential = this.baseRetryDelayMs * 2 ** Math.max(0, event.attemptCount - 1);
        const delay = Math.min(this.maximumRetryDelayMs, exponential);
        const failedAt = this.now();
        await this.repository.markRetry({
          eventId: event.id,
          leaseToken: event.leaseToken,
          errorCode: failure.code,
          failedAt: failedAt.toISOString(),
          availableAt: new Date(failedAt.getTime() + delay).toISOString(),
        });
        retried += 1;
      }
    }
    return Object.freeze({ claimed: claimed.length, published, retried, deadLettered });
  }

  private async deadLetter(event: ClaimedOutboxEvent, errorCode: string): Promise<void> {
    await this.repository.markDeadLetter({
      eventId: event.id,
      leaseToken: event.leaseToken,
      processedAt: this.now().toISOString(),
      errorCode,
    });
  }
}
