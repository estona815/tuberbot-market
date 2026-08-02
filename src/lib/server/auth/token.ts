import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type TokenPurpose = "session" | "csrf";

const TOKEN_BYTES = 32;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const digestPattern = /^[0-9a-f]{64}$/u;

export function createOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function isOpaqueToken(value: unknown): value is string {
  return typeof value === "string" && tokenPattern.test(value);
}

export function digestToken(token: string, purpose: TokenPurpose, pepper: string): string {
  if (!isOpaqueToken(token)) throw new TypeError("Invalid opaque token");
  if (pepper.length < 32) throw new TypeError("Session hash pepper is too short");

  return createHmac("sha256", pepper)
    .update(`tuberbot-auth:${purpose}:v1\0`, "utf8")
    .update(token, "utf8")
    .digest("hex");
}

export function tokensEqual(left: string, right: string): boolean {
  if (!isOpaqueToken(left) || !isOpaqueToken(right)) return false;
  return timingSafeEqual(Buffer.from(left, "ascii"), Buffer.from(right, "ascii"));
}

export function digestsEqual(left: string, right: string): boolean {
  if (!digestPattern.test(left) || !digestPattern.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
