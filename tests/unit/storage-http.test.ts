import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type StorageProviderModule = typeof import("../../src/providers/storage");
type StorageServerModule = typeof import("../../src/lib/server/storage");

let providers: StorageProviderModule;
let storageServer: StorageServerModule;

const ATTACHMENT_ID = "00000000-0000-4000-8000-000000000011";
const ORDER_ID = "00000000-0000-4000-8000-000000000012";

beforeAll(async () => {
  [providers, storageServer] = await Promise.all([
    import("../../src/providers/storage"),
    import("../../src/lib/server/storage"),
  ]);
});

function dependencies() {
  const now = () => new Date("2026-08-02T06:30:00.000Z");
  const storage = new providers.SandboxPrivateObjectStorage({ now, token: () => "sandbox_token" });
  const repository = new storageServer.InMemoryPrivateUploadRepository();
  const service = new storageServer.PrivateUploadService({
    storage,
    repository,
    authorization: {
      assertCanUpload: async () => undefined,
      assertCanDownload: async () => undefined,
    },
    now,
    attachmentId: () => ATTACHMENT_ID,
    opaqueObjectId: () => "opaqueObjectIdentifier000000000011",
  });
  const authenticate = vi.fn(async () => ({ userId: "actor-advertiser" }));
  const verifyCsrf = vi.fn(async (request: Request) => request.headers.get("x-csrf-token") === "valid-csrf");
  return { applicationOrigin: "https://tuberbot.co.kr", authenticate, service, verifyCsrf };
}

describe("private upload HTTP boundary", () => {
  it("rejects cross-origin mutation before authentication", async () => {
    const deps = dependencies();
    const response = await storageServer.handleInitiateUpload(
      new Request("https://tuberbot.co.kr/api/uploads/initiate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "upload-http-cross-origin",
          origin: "https://evil.example",
          "sec-fetch-site": "cross-site",
        },
        body: JSON.stringify({
          orderId: ORDER_ID,
          filename: "draft.mp4",
          declaredMimeType: "video/mp4",
          expectedSizeBytes: 16,
        }),
      }),
      deps,
    );
    expect(response.status).toBe(403);
    expect(deps.authenticate).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("requires bounded JSON and an idempotency key, then returns a no-store envelope", async () => {
    const deps = dependencies();
    const missingKey = await storageServer.handleInitiateUpload(
      new Request("https://tuberbot.co.kr/api/uploads/initiate", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://tuberbot.co.kr" },
        body: "{}",
      }),
      deps,
    );
    expect(missingKey.status).toBe(400);

    const response = await storageServer.handleInitiateUpload(
      new Request("https://tuberbot.co.kr/api/uploads/initiate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "upload-http-initiate",
          origin: "https://tuberbot.co.kr",
          "sec-fetch-site": "same-origin",
          "x-csrf-token": "valid-csrf",
          "x-request-id": "request_upload_001",
        },
        body: JSON.stringify({
          orderId: ORDER_ID,
          filename: "draft.mp4",
          declaredMimeType: "video/mp4",
          expectedSizeBytes: 16,
        }),
      }),
      deps,
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe("request_upload_001");
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = (await response.json()) as { upload: { attachmentId: string; upload: Record<string, unknown> } };
    expect(body.upload.attachmentId).toBe(ATTACHMENT_ID);
    expect(body.upload.upload).not.toHaveProperty("objectKey");
  });

  it("requires a session-bound CSRF token before reserving an upload", async () => {
    const deps = dependencies();
    const response = await storageServer.handleInitiateUpload(
      new Request("https://tuberbot.co.kr/api/uploads/initiate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "upload-http-invalid-csrf",
          origin: "https://tuberbot.co.kr",
          "sec-fetch-site": "same-origin",
          "x-csrf-token": "forged-csrf",
        },
        body: JSON.stringify({
          orderId: ORDER_ID,
          filename: "draft.mp4",
          declaredMimeType: "video/mp4",
          expectedSizeBytes: 16,
        }),
      }),
      deps,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "REQUEST_REJECTED" } });
    expect(deps.verifyCsrf).toHaveBeenCalledOnce();
  });
});
