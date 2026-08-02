import { validateIdempotencyKey } from "@/domain/idempotency";

import { OutboxValidationError } from "./errors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,99}$/u;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/u;

function canonicalJson(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new OutboxValidationError("Outbox payload contains a non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value !== "object") throw new OutboxValidationError("Outbox payload must contain only JSON values");
  if (ancestors.has(value)) throw new OutboxValidationError("Outbox payload must not contain cycles");
  ancestors.add(value);
  let result: string;
  if (Array.isArray(value)) {
    result = `[${value.map((item) => canonicalJson(item, ancestors)).join(",")}]`;
  } else {
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new OutboxValidationError("Outbox payload must use plain objects");
    }
    const record = value as Record<string, unknown>;
    result = `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], ancestors)}`)
      .join(",")}}`;
  }
  ancestors.delete(value);
  return result;
}

export function canonicalizeOutboxPayload(payload: Readonly<Record<string, unknown>>): string {
  if (Array.isArray(payload) || payload === null || typeof payload !== "object") {
    throw new OutboxValidationError("Outbox payload must be a JSON object");
  }
  const serialized = canonicalJson(payload, new Set());
  if (new TextEncoder().encode(serialized).byteLength > 64 * 1024) {
    throw new OutboxValidationError("Outbox payload exceeds 64 KiB");
  }
  return serialized;
}

function deepFreezeJson(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreezeJson(item));
  } else {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreezeJson(item));
  }
  return Object.freeze(value);
}

export function cloneOutboxPayload(payload: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const parsed = JSON.parse(canonicalizeOutboxPayload(payload)) as Record<string, unknown>;
  return deepFreezeJson(parsed) as Readonly<Record<string, unknown>>;
}

export function validateOutboxType(value: string, field: string): void {
  if (!TYPE_PATTERN.test(value)) throw new OutboxValidationError(`${field} is invalid`);
}

export function validateOutboxUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) throw new OutboxValidationError(`${field} must be a UUID`);
}

export function validateOutboxIdempotencyKey(value: string): void {
  try {
    validateIdempotencyKey(value);
  } catch {
    throw new OutboxValidationError("idempotencyKey is invalid");
  }
}

export function validateErrorCode(value: string): void {
  if (!ERROR_CODE_PATTERN.test(value)) throw new OutboxValidationError("errorCode is invalid");
}

export function parseOutboxTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new OutboxValidationError(`${field} must be an ISO-8601 timestamp`);
  return parsed;
}

export function validateWorkerId(value: string): void {
  if (!/^[A-Za-z0-9_-]{1,100}$/u.test(value)) throw new OutboxValidationError("workerId is invalid");
}
