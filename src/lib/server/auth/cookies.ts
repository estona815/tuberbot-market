import "server-only";

import type { AuthRuntimeConfig } from "./config";
import { isOpaqueToken } from "./token";

export const SESSION_COOKIE_NAME = "tb_session";
export const CSRF_COOKIE_NAME = "tb_csrf";

export type AuthCookies = Readonly<{
  sessionToken: string | null;
  csrfToken: string | null;
  malformed: boolean;
}>;

function readUniqueCookie(header: string, name: string): { value: string | null; duplicate: boolean } {
  const values: string[] = [];
  for (const segment of header.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    const key = segment.slice(0, separator).trim();
    if (key === name) values.push(segment.slice(separator + 1).trim());
  }
  return { value: values[0] ?? null, duplicate: values.length > 1 };
}

export function parseAuthCookies(request: Request): AuthCookies {
  const header = request.headers.get("cookie") ?? "";
  const session = readUniqueCookie(header, SESSION_COOKIE_NAME);
  const csrf = readUniqueCookie(header, CSRF_COOKIE_NAME);
  const malformed =
    session.duplicate ||
    csrf.duplicate ||
    (session.value !== null && !isOpaqueToken(session.value)) ||
    (csrf.value !== null && !isOpaqueToken(csrf.value));

  return Object.freeze({
    sessionToken: malformed ? null : session.value,
    csrfToken: malformed ? null : csrf.value,
    malformed,
  });
}

function baseAttributes(config: AuthRuntimeConfig): string[] {
  const attributes = ["Path=/", "SameSite=Lax", "Priority=High"];
  if (config.cookieSecure) attributes.push("Secure");
  return attributes;
}

export function createAuthCookieHeaders(
  config: AuthRuntimeConfig,
  sessionToken: string,
  csrfToken: string,
  expiresAt: Date,
  now = new Date(),
): readonly string[] {
  if (!isOpaqueToken(sessionToken) || !isOpaqueToken(csrfToken)) {
    throw new TypeError("Invalid auth cookie token");
  }

  const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1_000));
  const common = [...baseAttributes(config), `Expires=${expiresAt.toUTCString()}`, `Max-Age=${maxAgeSeconds}`];
  return Object.freeze([
    `${SESSION_COOKIE_NAME}=${sessionToken}; ${[...common, "HttpOnly"].join("; ")}`,
    `${CSRF_COOKIE_NAME}=${csrfToken}; ${common.join("; ")}`,
  ]);
}

export function createClearedAuthCookieHeaders(config: AuthRuntimeConfig): readonly string[] {
  const common = [...baseAttributes(config), "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "Max-Age=0"];
  return Object.freeze([
    `${SESSION_COOKIE_NAME}=; ${[...common, "HttpOnly"].join("; ")}`,
    `${CSRF_COOKIE_NAME}=; ${common.join("; ")}`,
  ]);
}
