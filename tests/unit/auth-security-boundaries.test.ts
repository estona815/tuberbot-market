import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AuthConfigurationError,
  isLocalDemoRequest,
  loadAuthRuntimeConfig,
  type AuthRuntimeConfig,
} from "../../src/lib/server/auth/config";
import {
  createAuthCookieHeaders,
  createClearedAuthCookieHeaders,
  parseAuthCookies,
} from "../../src/lib/server/auth/cookies";
import {
  FailClosedRateLimiter,
  FixedWindowMemoryRateLimiter,
} from "../../src/lib/server/auth/rate-limit";
import { parseReturnTo } from "../../src/lib/server/auth/return-to";
import {
  createOpaqueToken,
  digestToken,
  digestsEqual,
  isOpaqueToken,
  tokensEqual,
} from "../../src/lib/server/auth/token";
import { DEFAULT_SESSION_POLICY } from "../../src/lib/server/auth/types";

const pepper = "9c52cdef50f247e58e3df80ce522d795b0c93b9ef9a582884e5880897a2d495b";

function localConfig(overrides: Partial<AuthRuntimeConfig> = {}): AuthRuntimeConfig {
  return {
    applicationOrigin: "http://localhost:3000",
    cookieSecure: false,
    enableLocalDemoAuth: true,
    sessionHashPepper: pepper,
    sessionPolicy: DEFAULT_SESSION_POLICY,
    ...overrides,
  };
}

describe("opaque auth tokens", () => {
  it("creates high-entropy URL-safe values and stores purpose-separated digests", () => {
    const first = createOpaqueToken();
    const second = createOpaqueToken();

    expect(first).not.toBe(second);
    expect(isOpaqueToken(first)).toBe(true);
    expect(first).toHaveLength(43);

    const sessionDigest = digestToken(first, "session", pepper);
    const csrfDigest = digestToken(first, "csrf", pepper);
    expect(sessionDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(csrfDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(sessionDigest).not.toBe(csrfDigest);
    expect(sessionDigest).not.toContain(first);
    expect(digestsEqual(sessionDigest, sessionDigest)).toBe(true);
    expect(tokensEqual(first, first)).toBe(true);
    expect(tokensEqual(first, second)).toBe(false);
  });

  it("rejects malformed tokens and weak peppers", () => {
    expect(isOpaqueToken("too-short")).toBe(false);
    expect(() => digestToken("too-short", "session", pepper)).toThrow("Invalid opaque token");
    expect(() => digestToken(createOpaqueToken(), "session", "weak")).toThrow("too short");
  });
});

describe("auth runtime configuration", () => {
  it("enables local demo auth only for an explicit loopback sandbox", () => {
    const enabled = loadAuthRuntimeConfig({
      APP_ORIGIN: "http://localhost:3000",
      ENABLE_LOCAL_DEMO_AUTH: "true",
      ENABLE_LIVE_PAYMENTS: "false",
      NODE_ENV: "development",
      PAYMENT_MODE: "sandbox",
      SESSION_COOKIE_SECURE: "false",
      SESSION_HASH_PEPPER: pepper,
    });
    expect(enabled.enableLocalDemoAuth).toBe(true);
    expect(enabled.cookieSecure).toBe(false);

    const publicHost = loadAuthRuntimeConfig({
      APP_ORIGIN: "https://tuberbot.co.kr",
      ENABLE_LOCAL_DEMO_AUTH: "true",
      ENABLE_LIVE_PAYMENTS: "false",
      NODE_ENV: "development",
      PAYMENT_MODE: "sandbox",
      SESSION_COOKIE_SECURE: "false",
      SESSION_HASH_PEPPER: pepper,
    });
    expect(publicHost.enableLocalDemoAuth).toBe(false);
    expect(publicHost.cookieSecure).toBe(true);

    expect(isLocalDemoRequest(enabled, new Request("http://127.0.0.1:3000/api/auth/session"))).toBe(true);
    expect(isLocalDemoRequest(enabled, new Request("http://localhost:3001/api/auth/session"))).toBe(false);
  });

  it("forces secure cookies in production and rejects unsafe production origins", () => {
    const production = loadAuthRuntimeConfig({
      APP_ORIGIN: "https://tuberbot.co.kr",
      ENABLE_LOCAL_DEMO_AUTH: "true",
      NODE_ENV: "production",
      PAYMENT_MODE: "sandbox",
      SESSION_COOKIE_SECURE: "false",
      SESSION_HASH_PEPPER: pepper,
    });
    expect(production.cookieSecure).toBe(true);
    expect(production.enableLocalDemoAuth).toBe(false);

    expect(() =>
      loadAuthRuntimeConfig({
        APP_ORIGIN: "http://tuberbot.co.kr",
        NODE_ENV: "production",
        SESSION_HASH_PEPPER: pepper,
      }),
    ).toThrow(AuthConfigurationError);
  });

  it("rejects malformed origins, boolean flags, and example peppers", () => {
    expect(() =>
      loadAuthRuntimeConfig({
        APP_ORIGIN: "http://localhost:3000/path",
        SESSION_HASH_PEPPER: pepper,
      }),
    ).toThrow(AuthConfigurationError);
    expect(() =>
      loadAuthRuntimeConfig({
        APP_ORIGIN: "http://localhost:3000",
        ENABLE_LOCAL_DEMO_AUTH: "yes",
        SESSION_HASH_PEPPER: pepper,
      }),
    ).toThrow(AuthConfigurationError);
    expect(() =>
      loadAuthRuntimeConfig({
        APP_ORIGIN: "http://localhost:3000",
        SESSION_HASH_PEPPER: "replace-with-secret-manager-value",
      }),
    ).toThrow(AuthConfigurationError);
  });
});

describe("returnTo and cookie boundaries", () => {
  it("accepts a local path and rejects scheme-relative, encoded, and control boundaries", () => {
    expect(parseReturnTo("/dashboard?tab=orders#active")).toBe("/dashboard?tab=orders#active");
    expect(parseReturnTo(undefined, "/dashboard")).toBe("/dashboard");

    for (const invalid of [
      "https://evil.example/",
      "//evil.example/",
      "/\\evil.example",
      "/%2fevil.example",
      "/%252fevil.example",
      "/dashboard\u0000",
      "dashboard",
      `/${"x".repeat(2_049)}`,
    ]) {
      expect(() => parseReturnTo(invalid)).toThrow("Invalid returnTo");
    }
  });

  it("sets HttpOnly only on the session cookie and honors the secure policy", () => {
    const sessionToken = createOpaqueToken();
    const csrfToken = createOpaqueToken();
    const expiresAt = new Date("2026-08-02T09:00:00.000Z");
    const now = new Date("2026-08-02T08:00:00.000Z");
    const local = createAuthCookieHeaders(localConfig(), sessionToken, csrfToken, expiresAt, now);

    expect(local[0]).toContain("tb_session=");
    expect(local[0]).toContain("HttpOnly");
    expect(local[0]).toContain("SameSite=Lax");
    expect(local[0]).not.toContain("Secure");
    expect(local[1]).toContain("tb_csrf=");
    expect(local[1]).not.toContain("HttpOnly");

    const secure = createAuthCookieHeaders(
      localConfig({ cookieSecure: true }),
      sessionToken,
      csrfToken,
      expiresAt,
      now,
    );
    expect(secure.every((cookie) => cookie.includes("Secure"))).toBe(true);
    expect(createClearedAuthCookieHeaders(localConfig())[0]).toContain("Max-Age=0");
  });

  it("fails closed on duplicate or malformed auth cookies", () => {
    const token = createOpaqueToken();
    const duplicate = parseAuthCookies(
      new Request("http://localhost:3000/api/auth/session", {
        headers: { cookie: `tb_session=${token}; tb_session=${token}; tb_csrf=${token}` },
      }),
    );
    expect(duplicate).toMatchObject({ malformed: true, sessionToken: null, csrfToken: null });

    const valid = parseAuthCookies(
      new Request("http://localhost:3000/api/auth/session", {
        headers: { cookie: `tb_session=${token}; tb_csrf=${token}` },
      }),
    );
    expect(valid).toMatchObject({ malformed: false, sessionToken: token, csrfToken: token });
  });
});

describe("sensitive-action rate limiting", () => {
  it("uses a deterministic fixed window for local demo and resets at the boundary", async () => {
    const limiter = new FixedWindowMemoryRateLimiter({ limit: 2, windowMs: 10_000 });
    const startedAt = new Date("2026-08-02T08:00:00.000Z");
    expect((await limiter.consume("demo", startedAt)).allowed).toBe(true);
    expect((await limiter.consume("demo", startedAt)).allowed).toBe(true);
    const denied = await limiter.consume("demo", new Date(startedAt.getTime() + 1_000));
    expect(denied).toEqual({ allowed: false, retryAfterSeconds: 9 });
    expect((await limiter.consume("demo", new Date(startedAt.getTime() + 10_000))).allowed).toBe(true);
  });

  it("fails closed when a distributed production limiter is unavailable", async () => {
    await expect(new FailClosedRateLimiter().consume("login")).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });
});
