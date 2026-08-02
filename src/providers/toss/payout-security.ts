import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { Buffer } from "node:buffer";
import { CompactEncrypt, compactDecrypt } from "jose";

import { canonicalizeJson, type CanonicalJsonValue } from "../../domain/contracts";
import {
  assertPositiveKrwAmount,
  krwToSafeNumber,
  type KrwAmount,
} from "../../domain/money";
import {
  ProviderConfigurationError,
  ProviderValidationError,
  WebhookVerificationError,
} from "../errors";
import type { PayoutScheduleType } from "../types";

const DEFAULT_MAX_JWE_AGE_MS = 5 * 60 * 1_000;
const DEFAULT_MAX_WEBHOOK_AGE_MS = 5 * 60 * 1_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface ReplayGuard {
  /** Atomically returns true only for the first use of key through expiresAt. */
  consume(key: string, expiresAt: string): Promise<boolean>;
}

export interface TossPayoutRequestBody {
  readonly refPayoutId: string;
  readonly destination: string;
  readonly scheduleType: PayoutScheduleType;
  readonly payoutDate?: string;
  readonly amount: Readonly<{ currency: "KRW"; value: number }>;
  readonly transactionDescription: string;
}

export function decodeTossSecurityKey(securityKeyHex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/iu.test(securityKeyHex)) {
    throw new ProviderConfigurationError(
      "Toss security key must be exactly 64 hexadecimal characters",
    );
  }
  return new Uint8Array(Buffer.from(securityKeyHex, "hex"));
}

export function buildTossPayoutRequest(input: {
  readonly refPayoutId: string;
  readonly destination: string;
  readonly scheduleType: PayoutScheduleType;
  readonly payoutDate?: string;
  readonly amountKrw: KrwAmount;
  readonly transactionDescription: string;
}): Readonly<TossPayoutRequestBody> {
  if (input.refPayoutId.length === 0 || input.refPayoutId.length > 50) {
    throw new ProviderValidationError("refPayoutId must contain 1-50 characters");
  }
  if (input.destination.length === 0 || input.destination.length > 35) {
    throw new ProviderValidationError("destination must contain 1-35 characters");
  }
  if (
    input.transactionDescription.length === 0 ||
    input.transactionDescription.length > 7
  ) {
    throw new ProviderValidationError(
      "transactionDescription must contain 1-7 characters",
    );
  }
  assertPositiveKrwAmount(input.amountKrw);
  if (input.amountKrw >= 1_000_000_000n) {
    throw new ProviderValidationError("a Toss payout must be less than KRW 1 billion");
  }
  if (input.scheduleType === "SCHEDULED") {
    if (
      input.payoutDate === undefined ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(input.payoutDate)
    ) {
      throw new ProviderValidationError(
        "SCHEDULED payout requires payoutDate in yyyy-MM-dd format",
      );
    }
  } else if (input.payoutDate !== undefined) {
    throw new ProviderValidationError("EXPRESS payout must not include payoutDate");
  }

  return Object.freeze({
    refPayoutId: input.refPayoutId,
    destination: input.destination,
    scheduleType: input.scheduleType,
    ...(input.payoutDate === undefined ? {} : { payoutDate: input.payoutDate }),
    amount: Object.freeze({
      currency: "KRW" as const,
      value: krwToSafeNumber(input.amountKrw),
    }),
    transactionDescription: input.transactionDescription,
  });
}

export async function encryptTossPayoutJwe(
  payload: CanonicalJsonValue,
  options: {
    readonly securityKeyHex: string;
    readonly now?: Date;
    readonly nonce?: string;
  },
): Promise<string> {
  const key = decodeTossSecurityKey(options.securityKeyHex);
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new TypeError("now is invalid");
  const nonce = options.nonce ?? randomUUID();
  if (!UUID_PATTERN.test(nonce)) {
    throw new ProviderValidationError("JWE nonce must be a UUID");
  }
  const plaintext = new TextEncoder().encode(canonicalizeJson(payload));
  return new CompactEncrypt(plaintext)
    .setProtectedHeader({
      alg: "dir",
      enc: "A256GCM",
      iat: now.toISOString(),
      nonce,
    })
    .encrypt(key);
}

export async function decryptTossPayoutJwe<T>(
  compactJwe: string,
  options: {
    readonly securityKeyHex: string;
    readonly decode: (value: unknown) => T;
    readonly now?: Date;
    readonly maxAgeMs?: number;
    readonly replayGuard?: ReplayGuard;
  },
): Promise<T> {
  if (compactJwe.length === 0 || compactJwe.length > 1_000_000) {
    throw new ProviderValidationError("Compact JWE size is invalid");
  }
  const now = options.now ?? new Date();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_JWE_AGE_MS;
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs <= 0) {
    throw new RangeError("maxAgeMs must be a positive safe integer");
  }
  let result: Awaited<ReturnType<typeof compactDecrypt>>;
  try {
    result = await compactDecrypt(
      compactJwe,
      decodeTossSecurityKey(options.securityKeyHex),
    );
  } catch {
    throw new ProviderValidationError("Toss JWE authentication failed");
  }
  const header = result.protectedHeader;
  if (header.alg !== "dir" || header.enc !== "A256GCM") {
    throw new ProviderValidationError("Toss JWE algorithms are invalid");
  }
  if (typeof header.iat !== "string" || typeof header.nonce !== "string") {
    throw new ProviderValidationError("Toss JWE iat and nonce are required");
  }
  if (!UUID_PATTERN.test(header.nonce)) {
    throw new ProviderValidationError("Toss JWE nonce is invalid");
  }
  const issuedAtMs = Date.parse(header.iat);
  if (
    !Number.isFinite(issuedAtMs) ||
    issuedAtMs > now.getTime() + 30_000 ||
    now.getTime() - issuedAtMs > maxAgeMs
  ) {
    throw new ProviderValidationError("Toss JWE is outside the accepted time window");
  }
  if (options.replayGuard !== undefined) {
    const firstUse = await options.replayGuard.consume(
      `toss-jwe:${header.nonce}`,
      new Date(issuedAtMs + maxAgeMs).toISOString(),
    );
    if (!firstUse) throw new ProviderValidationError("Toss JWE nonce was replayed");
  }

  let parsed: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(result.plaintext);
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new ProviderValidationError("Toss JWE plaintext is invalid JSON");
  }
  return options.decode(parsed);
}

function signatureCandidates(signatureHeader: string): readonly Uint8Array[] {
  const segments = signatureHeader.split(",").map((value) => value.trim());
  const candidates: Uint8Array[] = [];
  for (const [index, segment] of segments.entries()) {
    const encoded = segment.startsWith("v1:")
      ? segment.slice(3)
      : index > 0 && segments[0]?.startsWith("v1:")
        ? segment
        : "";
    if (
      encoded.length === 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded) ||
      encoded.length % 4 !== 0
    ) {
      continue;
    }
    const decoded = new Uint8Array(Buffer.from(encoded, "base64"));
    if (decoded.length === 32) candidates.push(decoded);
  }
  return candidates;
}

/** Constant-time HMAC comparison for payout.changed and seller.changed only. */
export function verifyTossPayoutWebhookHmac(input: {
  readonly rawPayload: string;
  readonly transmissionTime: string;
  readonly signatureHeader: string;
  readonly securityKeyHex: string;
}): boolean {
  const expected = createHmac(
    "sha256",
    decodeTossSecurityKey(input.securityKeyHex),
  )
    .update(`${input.rawPayload}:${input.transmissionTime}`, "utf8")
    .digest();
  const candidates = signatureCandidates(input.signatureHeader);
  let matches = false;
  for (const candidate of candidates) {
    // Do not return early: compare every key-rotation candidate.
    matches = timingSafeEqual(expected, candidate) || matches;
  }
  return matches;
}

export async function verifyTossSignedWebhookDelivery(input: {
  readonly rawPayload: string;
  readonly transmissionTime: string;
  readonly transmissionId: string;
  readonly signatureHeader: string;
  readonly securityKeyHex: string;
  readonly expectedEventType: "payout.changed" | "seller.changed";
  readonly now?: Date;
  readonly maxAgeMs?: number;
  readonly replayGuard?: ReplayGuard;
}): Promise<Readonly<{ eventId: string; eventType: string; payload: unknown }>> {
  if (!verifyTossPayoutWebhookHmac(input)) {
    throw new WebhookVerificationError("Toss payout webhook signature is invalid");
  }
  const now = input.now ?? new Date();
  const sentAtMs = Date.parse(input.transmissionTime);
  const maxAgeMs = input.maxAgeMs ?? DEFAULT_MAX_WEBHOOK_AGE_MS;
  if (
    !Number.isFinite(sentAtMs) ||
    sentAtMs > now.getTime() + 30_000 ||
    now.getTime() - sentAtMs > maxAgeMs
  ) {
    throw new WebhookVerificationError("Toss payout webhook timestamp is invalid");
  }
  if (input.transmissionId.length === 0 || input.transmissionId.length > 200) {
    throw new WebhookVerificationError("Toss payout webhook transmission id is invalid");
  }
  if (input.replayGuard !== undefined) {
    const firstUse = await input.replayGuard.consume(
      `toss-webhook:${input.transmissionId}`,
      new Date(sentAtMs + maxAgeMs).toISOString(),
    );
    if (!firstUse) throw new WebhookVerificationError("Toss payout webhook was replayed");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(input.rawPayload) as unknown;
  } catch {
    throw new WebhookVerificationError("Toss payout webhook body is invalid JSON");
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new WebhookVerificationError("Toss payout webhook body must be an object");
  }
  const record = payload as Record<string, unknown>;
  if (record.eventType !== input.expectedEventType || typeof record.eventId !== "string") {
    throw new WebhookVerificationError("Toss payout webhook event facts are invalid");
  }

  return Object.freeze({
    eventId: record.eventId,
    eventType: input.expectedEventType,
    payload,
  });
}
