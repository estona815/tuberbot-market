import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { AuthRuntimeConfig } from "../../src/lib/server/auth/config";
import { createAuthHttpHandlers } from "../../src/lib/server/auth/http-handlers";
import {
  authenticateSessionRequest,
  getAuthHttpHandlers,
  requireSessionRequestCsrf,
} from "../../src/lib/server/auth/runtime";
import {
  FailClosedRateLimiter,
  FixedWindowMemoryRateLimiter,
} from "../../src/lib/server/auth/rate-limit";
import { MemorySessionRepository } from "../../src/lib/server/auth/repository";
import { AuthSessionService } from "../../src/lib/server/auth/service";
import { digestToken } from "../../src/lib/server/auth/token";
import { DEFAULT_SESSION_POLICY, type NewSessionRecord } from "../../src/lib/server/auth/types";

const pepper = "9c52cdef50f247e58e3df80ce522d795b0c93b9ef9a582884e5880897a2d495b";
const config: AuthRuntimeConfig = {
  applicationOrigin: "http://localhost:3000",
  cookieSecure: false,
  enableLocalDemoAuth: true,
  sessionHashPepper: pepper,
  sessionPolicy: DEFAULT_SESSION_POLICY,
};

function getSetCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

function getAuthTokens(response: Response): { sessionToken: string; csrfToken: string } {
  const cookies = getSetCookies(response);
  const sessionToken = cookies.join("\n").match(/tb_session=([A-Za-z0-9_-]{43})/u)?.[1];
  const csrfToken = cookies.join("\n").match(/tb_csrf=([A-Za-z0-9_-]{43})/u)?.[1];
  if (!sessionToken || !csrfToken) throw new Error("Expected auth cookies");
  return { sessionToken, csrfToken };
}

function cookieHeader(tokens: Readonly<{ sessionToken: string; csrfToken: string }>): string {
  return `tb_session=${tokens.sessionToken}; tb_csrf=${tokens.csrfToken}`;
}

function mutationHeaders(tokens?: Readonly<{ sessionToken: string; csrfToken: string }>): HeadersInit {
  return {
    ...(tokens ? { cookie: cookieHeader(tokens), "x-csrf-token": tokens.csrfToken } : {}),
    origin: config.applicationOrigin,
    "sec-fetch-site": "same-origin",
  };
}

describe("auth session service", () => {
  it("stores only token digests, constrains last-seen writes, rotates, and revokes", async () => {
    const repository = new MemorySessionRepository();
    const service = new AuthSessionService(repository, config);
    const startedAt = new Date("2026-08-02T08:00:00.000Z");
    const issued = await service.issueLocalDemo("ADVERTISER", startedAt);

    expect(issued.actor.roles).toEqual(["ADVERTISER"]);
    expect(issued.actor.organizationIds).toEqual([]);
    expect(issued.actor.mfaVerified).toBe(false);
    expect(issued.session.tokenDigest).toBe(digestToken(issued.sessionToken, "session", pepper));
    expect(issued.session.csrfTokenDigest).toBe(digestToken(issued.csrfToken, "csrf", pepper));
    expect(JSON.stringify(issued.session)).not.toContain(issued.sessionToken);
    expect(JSON.stringify(issued.session)).not.toContain(issued.csrfToken);

    await service.authenticate(issued.sessionToken, new Date(startedAt.getTime() + 4 * 60_000));
    const beforeTouch = await repository.findSessionByTokenDigest(issued.session.tokenDigest);
    expect(beforeTouch?.lastSeenAt).toEqual(startedAt);

    const touchTime = new Date(startedAt.getTime() + 5 * 60_000);
    await service.authenticate(issued.sessionToken, touchTime);
    const afterTouch = await repository.findSessionByTokenDigest(issued.session.tokenDigest);
    expect(afterTouch?.lastSeenAt).toEqual(touchTime);
    expect(afterTouch?.idleExpiresAt).toEqual(new Date(touchTime.getTime() + 30 * 60_000));

    const authenticated = await service.authenticate(issued.sessionToken, touchTime);
    expect(authenticated).not.toBeNull();
    const rotated = await service.rotate(authenticated!, new Date(touchTime.getTime() + 1_000));
    expect(rotated).not.toBeNull();
    expect(rotated?.session.rotationGeneration).toBe(1);
    expect(rotated?.session.rotatedFromSessionId).toBe(issued.session.id);
    expect(rotated?.session.absoluteExpiresAt).toEqual(issued.session.absoluteExpiresAt);
    expect(await service.authenticate(issued.sessionToken, new Date(touchTime.getTime() + 2_000))).toBeNull();
    expect(await service.authenticate(rotated!.sessionToken, new Date(touchTime.getTime() + 2_000))).not.toBeNull();

    const rotatedAuthentication = await service.authenticate(
      rotated!.sessionToken,
      new Date(touchTime.getTime() + 2_000),
    );
    expect(await service.revoke(rotatedAuthentication!, new Date(touchTime.getTime() + 3_000))).toBe(true);
    expect(await service.authenticate(rotated!.sessionToken, new Date(touchTime.getTime() + 4_000))).toBeNull();
  });

  it("does not revive a predecessor when a replacement digest collides", async () => {
    const repository = new MemorySessionRepository();
    const service = new AuthSessionService(repository, config);
    const startedAt = new Date("2026-08-02T08:00:00.000Z");
    const predecessor = await service.issueLocalDemo("ADVERTISER", startedAt);
    const existing = await service.issueLocalDemo("CREATOR", startedAt);
    const rotatedAt = new Date(startedAt.getTime() + 60_000);
    const replacement: NewSessionRecord = {
      userId: predecessor.session.userId,
      tokenDigest: existing.session.tokenDigest,
      csrfTokenDigest: predecessor.session.csrfTokenDigest,
      authMethod: predecessor.session.authMethod,
      demoRole: predecessor.session.demoRole,
      rotatedFromSessionId: predecessor.session.id,
      rotationGeneration: predecessor.session.rotationGeneration + 1,
      expiresAt: predecessor.session.expiresAt,
      idleExpiresAt: predecessor.session.idleExpiresAt,
      absoluteExpiresAt: predecessor.session.absoluteExpiresAt,
      lastSeenAt: rotatedAt,
      mfaVerifiedAt: predecessor.session.mfaVerifiedAt,
      createdAt: rotatedAt,
      updatedAt: rotatedAt,
    };

    await expect(
      repository.rotateSession({
        currentSessionId: predecessor.session.id,
        currentTokenDigest: predecessor.session.tokenDigest,
        replacement,
        rotatedAt,
      }),
    ).resolves.toBeNull();
    const stillActive = await repository.findSessionByTokenDigest(predecessor.session.tokenDigest);
    expect(stillActive?.revokedAt).toBeNull();
    expect(stillActive?.revokeReason).toBeNull();
  });

  it("expires an untouched session at its idle boundary", async () => {
    const repository = new MemorySessionRepository();
    const service = new AuthSessionService(repository, config);
    const startedAt = new Date("2026-08-02T08:00:00.000Z");
    const issued = await service.issueLocalDemo("CREATOR", startedAt);
    expect(
      await service.authenticate(issued.sessionToken, new Date(startedAt.getTime() + 30 * 60_000)),
    ).toBeNull();
  });
});

describe("auth HTTP lifecycle", () => {
  it("issues minimal actor data, rotates with CSRF, and revokes the rotated session", async () => {
    const repository = new MemorySessionRepository();
    const service = new AuthSessionService(repository, config);
    let clock = new Date("2026-08-02T08:00:00.000Z");
    const handlers = createAuthHttpHandlers({
      config,
      service,
      rateLimiter: new FixedWindowMemoryRateLimiter({ limit: 10, windowMs: 60_000 }),
      now: () => new Date(clock),
    });

    const createResponse = await handlers.createDemoSession(
      new Request("http://localhost:3000/api/auth/demo-session", {
        method: "POST",
        headers: {
          ...mutationHeaders(),
          "content-type": "application/json",
          "x-request-id": "authflow-request-001",
        },
        body: JSON.stringify({ persona: "CREATOR", returnTo: "/dashboard?tab=orders" }),
      }),
    );
    expect(createResponse.status).toBe(201);
    expect(createResponse.headers.get("cache-control")).toBe("no-store, max-age=0");
    const createBody = (await createResponse.json()) as {
      actor: Record<string, unknown>;
      returnTo: string;
    };
    expect(createBody.returnTo).toBe("/dashboard?tab=orders");
    expect(createBody.actor).toMatchObject({
      roles: ["CREATOR"],
      role: "CREATOR",
      displayName: "로컬 데모 크리에이터",
      mfaVerified: false,
    });
    expect(createBody.actor).not.toHaveProperty("sessionId");
    expect(createBody.actor).not.toHaveProperty("organizationIds");
    const originalTokens = getAuthTokens(createResponse);
    expect(JSON.stringify(createBody)).not.toContain(originalTokens.sessionToken);
    expect(JSON.stringify(createBody)).not.toContain(originalTokens.csrfToken);
    const setCookies = getSetCookies(createResponse);
    expect(setCookies.find((cookie) => cookie.startsWith("tb_session="))).toContain("HttpOnly");
    expect(setCookies.find((cookie) => cookie.startsWith("tb_csrf="))).not.toContain("HttpOnly");

    const getResponse = await handlers.getSession(
      new Request("http://localhost:3000/api/auth/session", {
        headers: { cookie: cookieHeader(originalTokens) },
      }),
    );
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({ authenticated: true });

    const missingCsrf = await handlers.rotateSession(
      new Request("http://localhost:3000/api/auth/session", {
        method: "PATCH",
        headers: {
          cookie: cookieHeader(originalTokens),
          origin: config.applicationOrigin,
          "sec-fetch-site": "same-origin",
        },
      }),
    );
    expect(missingCsrf.status).toBe(403);

    clock = new Date(clock.getTime() + 1_000);
    const rotateResponse = await handlers.rotateSession(
      new Request("http://localhost:3000/api/auth/session", {
        method: "PATCH",
        headers: mutationHeaders(originalTokens),
      }),
    );
    expect(rotateResponse.status).toBe(200);
    const rotatedTokens = getAuthTokens(rotateResponse);
    expect(rotatedTokens.sessionToken).not.toBe(originalTokens.sessionToken);
    expect(rotatedTokens.csrfToken).not.toBe(originalTokens.csrfToken);

    const replayResponse = await handlers.getSession(
      new Request("http://localhost:3000/api/auth/session", {
        headers: { cookie: cookieHeader(originalTokens) },
      }),
    );
    await expect(replayResponse.json()).resolves.toMatchObject({ authenticated: false });

    clock = new Date(clock.getTime() + 1_000);
    const deleteResponse = await handlers.deleteSession(
      new Request("http://localhost:3000/api/auth/session", {
        method: "DELETE",
        headers: mutationHeaders(rotatedTokens),
      }),
    );
    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(getSetCookies(deleteResponse).every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);

    const revokedResponse = await handlers.getSession(
      new Request("http://localhost:3000/api/auth/session", {
        headers: { cookie: cookieHeader(rotatedTokens) },
      }),
    );
    await expect(revokedResponse.json()).resolves.toMatchObject({ authenticated: false });
  });

  it("rejects cross-origin, unsafe returnTo, unavailable demo, and fail-closed rate limiting", async () => {
    const repository = new MemorySessionRepository();
    const service = new AuthSessionService(repository, config);
    const allowedHandlers = createAuthHttpHandlers({
      config,
      service,
      rateLimiter: new FixedWindowMemoryRateLimiter({ limit: 10, windowMs: 60_000 }),
    });
    const crossOrigin = await allowedHandlers.createDemoSession(
      new Request("http://localhost:3000/api/auth/demo-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
          "sec-fetch-site": "cross-site",
        },
        body: JSON.stringify({ persona: "ADVERTISER" }),
      }),
    );
    expect(crossOrigin.status).toBe(403);

    const unsafeReturnTo = await allowedHandlers.createDemoSession(
      new Request("http://localhost:3000/api/auth/demo-session", {
        method: "POST",
        headers: { ...mutationHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ persona: "ADVERTISER", returnTo: "//evil.example" }),
      }),
    );
    expect(unsafeReturnTo.status).toBe(400);

    const unavailableConfig = { ...config, enableLocalDemoAuth: false };
    const unavailableHandlers = createAuthHttpHandlers({
      config: unavailableConfig,
      service: new AuthSessionService(new MemorySessionRepository(), unavailableConfig),
      rateLimiter: new FailClosedRateLimiter(),
    });
    const unavailable = await unavailableHandlers.createDemoSession(
      new Request("http://localhost:3000/api/auth/demo-session", {
        method: "POST",
        headers: { ...mutationHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ persona: "ADVERTISER" }),
      }),
    );
    expect(unavailable.status).toBe(404);

    const rateLimitedHandlers = createAuthHttpHandlers({
      config,
      service,
      rateLimiter: new FailClosedRateLimiter(),
    });
    const rateLimited = await rateLimitedHandlers.createDemoSession(
      new Request("http://localhost:3000/api/auth/demo-session", {
        method: "POST",
        headers: { ...mutationHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ persona: "ADVERTISER" }),
      }),
    );
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.headers.get("retry-after")).toBe("60");
    expect(rateLimited.headers.get("cache-control")).toBe("no-store, max-age=0");
  });
});

const runtimeGlobals = globalThis as typeof globalThis & {
  __tuberbotAuthRuntime?: unknown;
  __tuberbotLocalDemoRateLimiter?: unknown;
  __tuberbotLocalDemoSessionRepository?: unknown;
};

function resetAuthRuntimeGlobals(): void {
  delete runtimeGlobals.__tuberbotAuthRuntime;
  delete runtimeGlobals.__tuberbotLocalDemoRateLimiter;
  delete runtimeGlobals.__tuberbotLocalDemoSessionRepository;
}

describe.sequential("default auth runtime wiring", () => {
  afterEach(() => {
    resetAuthRuntimeGlobals();
    vi.unstubAllEnvs();
  });

  it("uses shared process memory only for an explicitly enabled DB-less local demo", async () => {
    resetAuthRuntimeGlobals();
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("ENABLE_LOCAL_DEMO_AUTH", "true");
    vi.stubEnv("ENABLE_LIVE_PAYMENTS", "false");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PAYMENT_MODE", "sandbox");
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
    vi.stubEnv("SESSION_HASH_PEPPER", pepper);

    const handlers = getAuthHttpHandlers();
    const response = await handlers.createDemoSession(
      new Request("http://localhost:3000/api/auth/demo-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ persona: "ADVERTISER" }),
      }),
    );
    expect(response.status).toBe(201);
    const tokens = getAuthTokens(response);
    const mutationRequest = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        cookie: cookieHeader(tokens),
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
        "x-csrf-token": tokens.csrfToken,
      },
    });
    const authenticated = await authenticateSessionRequest(mutationRequest);
    expect(authenticated?.actor.roles).toEqual(["ADVERTISER"]);
    expect(() => requireSessionRequestCsrf(mutationRequest, authenticated!)).not.toThrow();

    const forgedRequest = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        cookie: `tb_session=${"A".repeat(43)}; tb_csrf=${tokens.csrfToken}`,
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
        "x-csrf-token": tokens.csrfToken,
      },
    });
    expect(() => requireSessionRequestCsrf(forgedRequest, authenticated!)).toThrow(
      "Session request binding failed",
    );
  });

  it("never falls back to memory for a production or disabled-demo runtime", () => {
    resetAuthRuntimeGlobals();
    vi.stubEnv("APP_ORIGIN", "https://tuberbot.co.kr");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("ENABLE_LOCAL_DEMO_AUTH", "false");
    vi.stubEnv("ENABLE_LIVE_PAYMENTS", "false");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAYMENT_MODE", "sandbox");
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
    vi.stubEnv("SESSION_HASH_PEPPER", pepper);

    expect(() => getAuthHttpHandlers()).toThrow("DATABASE_URL is required");
  });
});
