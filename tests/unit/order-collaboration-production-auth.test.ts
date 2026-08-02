import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

function cookieValue(setCookie: string, name: string): string {
  const value = setCookie.match(new RegExp(`(?:^|,\\s*)${name}=([^;]+)`, "u"))?.[1];
  if (value === undefined) throw new Error(`${name} cookie was not issued`);
  return value;
}

describe("order collaboration production auth wiring", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("PAYMENT_MODE", "sandbox");
    vi.stubEnv("ENABLE_LIVE_PAYMENTS", "false");
    vi.stubEnv("ENABLE_LOCAL_DEMO_AUTH", "true");
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
    vi.stubEnv(
      "SESSION_HASH_PEPPER",
      "order-collaboration-test-pepper-2026-08-02-secure-value",
    );
    vi.stubEnv("TUBERBOT_ORDER_DEMO_MODE", "true");
    vi.stubEnv("DATABASE_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the real demo session cookie and its bound CSRF token", async () => {
    const [{ getAuthHttpHandlers }, { productionOrderCollaborationHandlers }] =
      await Promise.all([
        import("../../src/lib/server/auth/runtime"),
        import("../../src/app/api/orders/_shared/production"),
      ]);
    const sessionResponse = await getAuthHttpHandlers().createDemoSession(
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
    const setCookie = sessionResponse.headers.get("set-cookie") ?? "";
    const sessionToken = cookieValue(setCookie, "tb_session");
    const csrfToken = cookieValue(setCookie, "tb_csrf");
    const cookie = `tb_session=${sessionToken}; tb_csrf=${csrfToken}`;
    const params = {
      params: Promise.resolve({ id: "TBM-20260802-001" }),
    };

    const workspace = await productionOrderCollaborationHandlers.workspace(
      new Request(
        "http://localhost:3000/api/orders/TBM-20260802-001/workspace",
        { headers: { cookie } },
      ),
      params,
    );
    const message = await productionOrderCollaborationHandlers.messages(
      new Request(
        "http://localhost:3000/api/orders/TBM-20260802-001/messages",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie,
            "idempotency-key": "production-auth-message-1",
            origin: "http://localhost:3000",
            "sec-fetch-site": "same-origin",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            body: "실제 세션으로 보낸 메시지입니다.",
            clientMessageId: "production-auth-message-1",
            expectedVersion: 1,
          }),
        },
      ),
      params,
    );

    expect(sessionResponse.status).toBe(201);
    expect(workspace.status).toBe(200);
    expect(await workspace.json()).toMatchObject({
      workspace: { order: { orderNumber: "TBM-20260802-001" } },
    });
    expect(message.status).toBe(200);
    expect(await message.json()).toMatchObject({
      replayed: false,
      workspace: { messages: [{ clientMessageId: "production-auth-message-1" }] },
    });
  });

  it("rejects a CSRF header that is not bound to the session", async () => {
    const [{ getAuthHttpHandlers }, { productionOrderCollaborationHandlers }] =
      await Promise.all([
        import("../../src/lib/server/auth/runtime"),
        import("../../src/app/api/orders/_shared/production"),
      ]);
    const sessionResponse = await getAuthHttpHandlers().createDemoSession(
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
    const setCookie = sessionResponse.headers.get("set-cookie") ?? "";
    const sessionToken = cookieValue(setCookie, "tb_session");
    const csrfToken = cookieValue(setCookie, "tb_csrf");
    const response = await productionOrderCollaborationHandlers.messages(
      new Request(
        "http://localhost:3000/api/orders/TBM-20260802-001/messages",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `tb_session=${sessionToken}; tb_csrf=${csrfToken}`,
            "idempotency-key": "production-auth-invalid-csrf",
            origin: "http://localhost:3000",
            "sec-fetch-site": "same-origin",
            "x-csrf-token": `${csrfToken}changed`,
          },
          body: JSON.stringify({
            body: "전송되면 안 됩니다.",
            clientMessageId: "invalid-csrf-message",
            expectedVersion: 1,
          }),
        },
      ),
      { params: Promise.resolve({ id: "TBM-20260802-001" }) },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "ORIGIN_OR_CSRF_REJECTED" },
    });
  });

  it.each([
    "http://localhost:3001",
    "https://localhost:3000",
  ])("does not expose the demo repository on mismatched origin %s", async (origin) => {
    const [{ getAuthHttpHandlers }, { productionOrderCollaborationHandlers }] =
      await Promise.all([
        import("../../src/lib/server/auth/runtime"),
        import("../../src/app/api/orders/_shared/production"),
      ]);
    const sessionResponse = await getAuthHttpHandlers().createDemoSession(
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
    const setCookie = sessionResponse.headers.get("set-cookie") ?? "";
    const cookie = [
      `tb_session=${cookieValue(setCookie, "tb_session")}`,
      `tb_csrf=${cookieValue(setCookie, "tb_csrf")}`,
    ].join("; ");

    const response = await productionOrderCollaborationHandlers.workspace(
      new Request(`${origin}/api/orders/TBM-20260802-001/workspace`, {
        headers: { cookie },
      }),
      { params: Promise.resolve({ id: "TBM-20260802-001" }) },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: { code: "INTERNAL_ERROR" },
    });
  });
});
