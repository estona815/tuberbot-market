import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type ApiEnvelopeModule = typeof import("../../src/lib/server/api-envelope");
let api: ApiEnvelopeModule;

beforeAll(async () => {
  api = await import("../../src/lib/server/api-envelope");
});

describe("bounded JSON request parsing", () => {
  it("accepts JSON with an explicit content type", async () => {
    const request = new Request("https://market.example/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ action: "APPROVE" }),
    });
    await expect(api.parseBoundedJson(request, 100)).resolves.toEqual({ action: "APPROVE" });
  });

  it("rejects unsupported content types, malformed JSON, and oversized bodies", async () => {
    await expect(api.parseBoundedJson(new Request("https://market.example/api", { method: "POST", body: "{}" }))).rejects.toMatchObject({ code: "CONTENT_TYPE_REQUIRED", status: 415 });
    await expect(api.parseBoundedJson(new Request("https://market.example/api", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }))).rejects.toMatchObject({ code: "INVALID_JSON", status: 400 });
    await expect(api.parseBoundedJson(new Request("https://market.example/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: "too long" }) }), 8)).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE", status: 413 });
  });

  it("cancels a chunked body as soon as the byte limit is exceeded", async () => {
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"value":"'));
        controller.enqueue(new TextEncoder().encode("far-too-long"));
      },
      cancel() {
        canceled = true;
      },
    });
    const request = new Request("https://market.example/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(api.parseBoundedJson(request, 12)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
      status: 413,
    });
    expect(canceled).toBe(true);
  });
});

describe("API response envelope", () => {
  it("echoes only safe request IDs and marks JSON responses no-store", async () => {
    const accepted = api.getRequestId(new Request("https://market.example/api", { headers: { "x-request-id": "request_12345678" } }));
    const replaced = api.getRequestId(new Request("https://market.example/api", { headers: { "x-request-id": "../../etc/passwd" } }));
    expect(accepted).toBe("request_12345678");
    expect(replaced).toMatch(/^[0-9a-f-]{36}$/u);

    const response = api.publicApiError("INVALID_REQUEST", 400, accepted);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-request-id")).toBe(accepted);
    expect(await response.json()).toEqual({ error: { code: "INVALID_REQUEST" }, requestId: accepted });
  });
});
