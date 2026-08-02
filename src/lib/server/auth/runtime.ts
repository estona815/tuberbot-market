import "server-only";

import { getDatabase } from "@/lib/server/db/client";
import { loadAuthRuntimeConfig } from "./config";
import type { AuthRuntimeConfig } from "./config";
import { parseAuthCookies } from "./cookies";
import { requireValidCsrf } from "./csrf";
import { createAuthHttpHandlers, type AuthHttpHandlers } from "./http-handlers";
import { PostgresSessionRepository } from "./postgres-repository";
import {
  FailClosedRateLimiter,
  FixedWindowMemoryRateLimiter,
  type SensitiveActionRateLimiter,
} from "./rate-limit";
import { MemorySessionRepository, type SessionRepository } from "./repository";
import { AuthSessionService } from "./service";
import { digestToken, digestsEqual, isOpaqueToken } from "./token";
import type { AuthenticatedSession } from "./types";

type AuthRuntime = Readonly<{
  config: AuthRuntimeConfig;
  service: AuthSessionService;
  handlers: AuthHttpHandlers;
}>;

const authRuntimeGlobal = globalThis as typeof globalThis & {
  __tuberbotAuthRuntime?: AuthRuntime;
  __tuberbotLocalDemoRateLimiter?: SensitiveActionRateLimiter;
  __tuberbotLocalDemoSessionRepository?: SessionRepository;
};

function getDefaultRateLimiter(localDemoEnabled: boolean): SensitiveActionRateLimiter {
  if (!localDemoEnabled) return new FailClosedRateLimiter();
  authRuntimeGlobal.__tuberbotLocalDemoRateLimiter ??= new FixedWindowMemoryRateLimiter({
    limit: 10,
    windowMs: 15 * 60 * 1_000,
  });
  return authRuntimeGlobal.__tuberbotLocalDemoRateLimiter;
}

export function getAuthHttpHandlers(): AuthHttpHandlers {
  return getAuthRuntime().handlers;
}

function getAuthRuntime(): AuthRuntime {
  if (authRuntimeGlobal.__tuberbotAuthRuntime) return authRuntimeGlobal.__tuberbotAuthRuntime;

  const config = loadAuthRuntimeConfig();
  let repository: SessionRepository;
  if (config.enableLocalDemoAuth && !process.env.DATABASE_URL) {
    authRuntimeGlobal.__tuberbotLocalDemoSessionRepository ??= new MemorySessionRepository();
    repository = authRuntimeGlobal.__tuberbotLocalDemoSessionRepository;
  } else {
    // Production and non-demo environments never fall back to process memory.
    repository = new PostgresSessionRepository(getDatabase());
  }
  const service = new AuthSessionService(repository, config);
  const handlers = createAuthHttpHandlers({
    config,
    service,
    rateLimiter: getDefaultRateLimiter(config.enableLocalDemoAuth),
  });
  const runtime = Object.freeze({ config, service, handlers });
  authRuntimeGlobal.__tuberbotAuthRuntime = runtime;
  return runtime;
}

/** Authenticate the opaque session cookie against the shared runtime repository. */
export async function authenticateSessionRequest(
  request: Request,
  now = new Date(),
): Promise<AuthenticatedSession | null> {
  const cookies = parseAuthCookies(request);
  if (cookies.malformed || cookies.sessionToken === null) return null;
  return getAuthRuntime().service.authenticate(cookies.sessionToken, now);
}

/**
 * Bind an authenticated session back to this request's cookie, then enforce
 * exact Origin and the double-submit CSRF token. Throws on any mismatch.
 */
export function requireSessionRequestCsrf(
  request: Request,
  authenticated: AuthenticatedSession,
): void {
  const runtime = getAuthRuntime();
  const cookies = parseAuthCookies(request);
  if (
    cookies.malformed ||
    !isOpaqueToken(cookies.sessionToken) ||
    !digestsEqual(
      digestToken(cookies.sessionToken, "session", runtime.config.sessionHashPepper),
      authenticated.session.tokenDigest,
    )
  ) {
    throw new Error("Session request binding failed");
  }
  requireValidCsrf({
    request,
    applicationOrigin: runtime.config.applicationOrigin,
    csrfCookieToken: cookies.csrfToken,
    storedCsrfDigest: authenticated.session.csrfTokenDigest,
    pepper: runtime.config.sessionHashPepper,
  });
}
