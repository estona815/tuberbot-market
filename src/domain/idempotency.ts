import { canonicalizeJson, sha256Hex, type CanonicalJsonValue } from "./contracts";

export const TOSS_IDEMPOTENCY_MAX_LENGTH = 300;
export const TOSS_IDEMPOTENCY_TTL_MS = 15 * 24 * 60 * 60 * 1_000;

export type IdempotencyRecordState = "PROCESSING" | "COMPLETED";

export interface IdempotencyRecord<TResponse> {
  readonly scope: string;
  readonly key: string;
  readonly requestHash: string;
  readonly state: IdempotencyRecordState;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly response?: TResponse;
}

export type IdempotencyDecision<TResponse> =
  | Readonly<{ kind: "ACQUIRE"; expiresAt: string }>
  | Readonly<{ kind: "REACQUIRE_EXPIRED"; expiresAt: string }>
  | Readonly<{ kind: "IN_PROGRESS"; retryAfterMs: number }>
  | Readonly<{ kind: "REPLAY"; response: TResponse }>
  | Readonly<{ kind: "CONFLICT" }>;

export interface IdempotentRequestDescriptor {
  readonly method: string;
  readonly route: string;
  readonly principalId: string;
  readonly body: CanonicalJsonValue;
}

export function validateIdempotencyKey(key: string): void {
  if (key.length === 0 || key.length > TOSS_IDEMPOTENCY_MAX_LENGTH) {
    throw new TypeError(
      `idempotency key must contain 1-${TOSS_IDEMPOTENCY_MAX_LENGTH} characters`,
    );
  }
  if (key.trim() !== key || /[\u0000-\u001f\u007f]/u.test(key)) {
    throw new TypeError("idempotency key contains invalid whitespace or control characters");
  }
}

export function fingerprintIdempotentRequest(
  descriptor: IdempotentRequestDescriptor,
): string {
  if (descriptor.method.trim().length === 0 || descriptor.route.trim().length === 0) {
    throw new TypeError("method and route are required");
  }
  if (descriptor.principalId.trim().length === 0) {
    throw new TypeError("principalId is required");
  }

  return sha256Hex(
    canonicalizeJson({
      body: descriptor.body,
      method: descriptor.method.toUpperCase(),
      principalId: descriptor.principalId,
      route: descriptor.route,
    }),
  );
}

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${field} must be an ISO-8601 timestamp`);
  }
  return parsed;
}

/**
 * Decide under a uniqueness lock on (scope, key). The same key with a different
 * request hash is a conflict; callers must never silently execute it.
 */
export function decideIdempotentRequest<TResponse>(input: {
  readonly scope: string;
  readonly key: string;
  readonly requestHash: string;
  readonly now: string;
  readonly existing?: IdempotencyRecord<TResponse>;
  readonly ttlMs?: number;
}): IdempotencyDecision<TResponse> {
  validateIdempotencyKey(input.key);
  if (input.scope.trim().length === 0 || input.requestHash.length !== 64) {
    throw new TypeError("scope and a SHA-256 requestHash are required");
  }
  const nowMs = timestamp(input.now, "now");
  const ttlMs = input.ttlMs ?? TOSS_IDEMPOTENCY_TTL_MS;
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new RangeError("ttlMs must be a positive safe integer");
  }
  const expiresAt = new Date(nowMs + ttlMs).toISOString();

  if (input.existing === undefined) {
    return Object.freeze({ kind: "ACQUIRE", expiresAt });
  }
  if (
    input.existing.scope !== input.scope ||
    input.existing.key !== input.key
  ) {
    throw new TypeError("existing idempotency record has the wrong scope or key");
  }
  const existingExpiryMs = timestamp(input.existing.expiresAt, "existing.expiresAt");
  if (existingExpiryMs <= nowMs) {
    return Object.freeze({ kind: "REACQUIRE_EXPIRED", expiresAt });
  }
  if (input.existing.requestHash !== input.requestHash) {
    return Object.freeze({ kind: "CONFLICT" });
  }
  if (input.existing.state === "PROCESSING") {
    return Object.freeze({
      kind: "IN_PROGRESS",
      retryAfterMs: Math.max(1, Math.min(1_000, existingExpiryMs - nowMs)),
    });
  }
  if (!("response" in input.existing)) {
    throw new Error("completed idempotency record is missing its response");
  }

  return Object.freeze({ kind: "REPLAY", response: input.existing.response as TResponse });
}
