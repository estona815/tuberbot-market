import "server-only";

import { isIP } from "node:net";
import { validateIdempotencyKey } from "@/domain/idempotency";

export class UnsafeRequestError extends Error {
  constructor(message = "Request rejected") {
    super(message);
    this.name = "UnsafeRequestError";
  }
}

export function requireSameOrigin(request: Request, applicationOrigin: string): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== new URL(applicationOrigin).origin || (fetchSite !== null && !["same-origin", "same-site"].includes(fetchSite))) {
    throw new UnsafeRequestError("Cross-site state change rejected");
  }
}

export function requireIdempotencyHeader(request: Request): string {
  const key = request.headers.get("idempotency-key") ?? "";
  validateIdempotencyKey(key);
  return key;
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  const [a, b] = parts;
  if (parts.length !== 4 || a === undefined || b === undefined || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
}

function isBlockedIp(address: string): boolean {
  if (isIP(address) === 4) return isBlockedIpv4(address);
  if (isIP(address) !== 6) return true;
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mapped !== undefined ? isBlockedIpv4(mapped) : false;
}

export type AddressLookup = (hostname: string) => Promise<readonly string[]>;

/** Resolve immediately before connecting and use the returned IP for the socket. */
export async function resolveSafeHttpTarget(rawUrl: string, lookup: AddressLookup): Promise<Readonly<{ url: URL; addresses: readonly string[] }>> {
  if (rawUrl.length > 2_048) throw new UnsafeRequestError("URL is too long");
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new UnsafeRequestError("Only HTTPS product URLs are accepted");
  if (url.username || url.password || url.port) throw new UnsafeRequestError("URL credentials and custom ports are not accepted");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "metadata.google.internal") throw new UnsafeRequestError("Private host rejected");
  const addresses = isIP(hostname) ? [hostname] : await lookup(hostname);
  if (addresses.length === 0 || addresses.some(isBlockedIp)) throw new UnsafeRequestError("Private or unresolved address rejected");
  return Object.freeze({ url, addresses: Object.freeze([...addresses]) });
}
