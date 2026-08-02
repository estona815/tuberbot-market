import "server-only";

export type RateLimitDecision = Readonly<{
  allowed: boolean;
  retryAfterSeconds: number;
}>;

export interface SensitiveActionRateLimiter {
  consume(key: string, now?: Date): Promise<RateLimitDecision>;
}

export class FixedWindowMemoryRateLimiter implements SensitiveActionRateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #entries = new Map<string, { windowStartedAt: number; count: number }>();

  constructor(options: Readonly<{ limit: number; windowMs: number }>) {
    if (!Number.isSafeInteger(options.limit) || options.limit <= 0) {
      throw new TypeError("Rate limit must be a positive safe integer");
    }
    if (!Number.isSafeInteger(options.windowMs) || options.windowMs <= 0) {
      throw new TypeError("Rate-limit window must be a positive safe integer");
    }
    this.#limit = options.limit;
    this.#windowMs = options.windowMs;
  }

  async consume(key: string, now = new Date()): Promise<RateLimitDecision> {
    if (!key || key.length > 256) return Object.freeze({ allowed: false, retryAfterSeconds: 1 });

    const timestamp = now.getTime();
    const existing = this.#entries.get(key);
    const expired = existing === undefined || timestamp - existing.windowStartedAt >= this.#windowMs;
    const entry = expired ? { windowStartedAt: timestamp, count: 0 } : existing;
    entry.count += 1;
    this.#entries.set(key, entry);

    const remainingMs = Math.max(1, this.#windowMs - (timestamp - entry.windowStartedAt));
    return Object.freeze({
      allowed: entry.count <= this.#limit,
      retryAfterSeconds: entry.count <= this.#limit ? 0 : Math.ceil(remainingMs / 1_000),
    });
  }
}

export class FailClosedRateLimiter implements SensitiveActionRateLimiter {
  async consume(key: string, now?: Date): Promise<RateLimitDecision> {
    void key;
    void now;
    return Object.freeze({ allowed: false, retryAfterSeconds: 60 });
  }
}
