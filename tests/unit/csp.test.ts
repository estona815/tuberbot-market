import { afterEach, describe, expect, it, vi } from "vitest";

import { createContentSecurityPolicy } from "../../src/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("request-scoped Content Security Policy", () => {
  it("uses a nonce and strict-dynamic without unsafe script directives in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://tuberbot.co.kr");

    const policy = createContentSecurityPolicy("nonce-value");

    expect(policy).toContain("script-src 'self' 'nonce-nonce-value' 'strict-dynamic'");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("style-src 'self' 'nonce-nonce-value'");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("allows only the development exceptions required by Next.js debugging", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");

    const policy = createContentSecurityPolicy("dev-nonce");

    expect(policy).toContain("script-src 'self' 'nonce-dev-nonce' 'strict-dynamic' 'unsafe-eval'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });
});
