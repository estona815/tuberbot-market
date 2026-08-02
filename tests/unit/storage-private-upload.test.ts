import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type StorageProviderModule = typeof import("../../src/providers/storage");
type StorageServerModule = typeof import("../../src/lib/server/storage");

let providers: StorageProviderModule;
let storageServer: StorageServerModule;

const ATTACHMENT_ID = "00000000-0000-4000-8000-000000000001";
const ORDER_ID = "00000000-0000-4000-8000-000000000002";
const FIXED_TIME = Date.parse("2026-08-02T06:00:00.000Z");
const MP4_BYTES = Uint8Array.of(
  0x00, 0x00, 0x00, 0x10,
  0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d,
  0x00, 0x00, 0x00, 0x00,
);
const PNG_BYTES = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

beforeAll(async () => {
  [providers, storageServer] = await Promise.all([
    import("../../src/providers/storage"),
    import("../../src/lib/server/storage"),
  ]);
});

function createFixture(filename = "광고시안.mp4", expectedSizeBytes = MP4_BYTES.byteLength) {
  let tokenSequence = 0;
  const now = () => new Date(FIXED_TIME);
  const storage = new providers.SandboxPrivateObjectStorage({
    now,
    token: (purpose) => `${purpose}_token_${++tokenSequence}`,
  });
  const repository = new storageServer.InMemoryPrivateUploadRepository();
  const authorization = {
    assertCanUpload: vi.fn(async () => undefined),
    assertCanDownload: vi.fn(async () => undefined),
  };
  const service = new storageServer.PrivateUploadService({
    storage,
    repository,
    authorization,
    now,
    attachmentId: () => ATTACHMENT_ID,
    opaqueObjectId: () => "opaqueObjectIdentifier000000000001",
  });
  return { authorization, repository, service, storage, filename, expectedSizeBytes };
}

describe("private upload service", () => {
  it("uses an opaque key, replays initiation, gates download on a clean scan, and forces attachment disposition", async () => {
    const fixture = createFixture();
    const request = {
      actorId: "actor-advertiser",
      orderId: ORDER_ID,
      filename: fixture.filename,
      declaredMimeType: "video/mp4",
      expectedSizeBytes: fixture.expectedSizeBytes,
      idempotencyKey: "upload-initiate-001",
    } as const;

    const initiated = await fixture.service.initiate(request);
    const replay = await fixture.service.initiate(request);
    expect(replay).toEqual(initiated);
    expect(initiated.upload.expiresAt).toBe("2026-08-02T06:05:00.000Z");
    expect(initiated.upload.requiredHeaders).toEqual({
      "Content-Length": MP4_BYTES.byteLength.toString(),
      "Content-Type": "video/mp4",
    });

    const record = await fixture.repository.findById(ATTACHMENT_ID);
    expect(record?.objectKey).toBe("private/opaqueObjectIdentifier000000000001");
    expect(record?.objectKey).not.toContain(ORDER_ID);
    expect(record?.objectKey).not.toContain(fixture.filename);
    expect(fixture.authorization.assertCanUpload).toHaveBeenCalledWith({ actorId: request.actorId, orderId: ORDER_ID });

    await fixture.storage.putSignedUpload(initiated.upload.url, MP4_BYTES, initiated.upload.requiredHeaders);
    const completed = await fixture.service.complete({
      actorId: request.actorId,
      attachmentId: ATTACHMENT_ID,
      idempotencyKey: "upload-complete-001",
    });
    expect(completed.status).toBe("PENDING");
    expect(completed.detectedMimeType).toBe("video/mp4");
    await expect(fixture.service.createDownload({ actorId: request.actorId, attachmentId: ATTACHMENT_ID })).rejects.toMatchObject({
      code: "SCAN_PENDING",
    });

    const clean = await fixture.service.recordScanResult({
      attachmentId: ATTACHMENT_ID,
      scanEventId: "scan-event-clean-001",
      disposition: "CLEAN",
    });
    expect(clean.status).toBe("CLEAN");
    const download = await fixture.service.createDownload({ actorId: request.actorId, attachmentId: ATTACHMENT_ID });
    expect(download.expiresAt).toBe("2026-08-02T06:01:00.000Z");
    expect(download.responseHeaders["Content-Disposition"]).toMatch(/^attachment;/u);
    expect(download.responseHeaders["Content-Disposition"]).not.toContain("inline");
    expect(download.responseHeaders["Content-Disposition"]).toContain("filename*=UTF-8''");
    expect(download.responseHeaders["X-Content-Type-Options"]).toBe("nosniff");
    const downloaded = await fixture.storage.readSignedDownload(download.url);
    expect(downloaded.body).toEqual(MP4_BYTES);
    expect(fixture.authorization.assertCanDownload).toHaveBeenCalledWith({
      actorId: request.actorId,
      orderId: ORDER_ID,
      attachmentId: ATTACHMENT_ID,
    });
  });

  it("rejects idempotency-key reuse with different facts and upload-token replay with different bytes", async () => {
    const fixture = createFixture();
    const initiated = await fixture.service.initiate({
      actorId: "actor-advertiser",
      orderId: ORDER_ID,
      filename: fixture.filename,
      declaredMimeType: "video/mp4",
      expectedSizeBytes: MP4_BYTES.byteLength,
      idempotencyKey: "upload-initiate-conflict",
    });
    await expect(
      fixture.service.initiate({
        actorId: "actor-advertiser",
        orderId: ORDER_ID,
        filename: "other.mp4",
        declaredMimeType: "video/mp4",
        expectedSizeBytes: MP4_BYTES.byteLength,
        idempotencyKey: "upload-initiate-conflict",
      }),
    ).rejects.toBeInstanceOf(storageServer.PrivateUploadConflictError);

    await fixture.storage.putSignedUpload(initiated.upload.url, MP4_BYTES, initiated.upload.requiredHeaders);
    const changed = Uint8Array.from(MP4_BYTES);
    changed[changed.length - 1] = 1;
    await expect(fixture.storage.putSignedUpload(initiated.upload.url, changed, initiated.upload.requiredHeaders)).rejects.toMatchObject({
      code: "UPLOAD_REPLAY_MISMATCH",
    });
  });

  it("quarantines a declared/detected MIME mismatch and never grants a download", async () => {
    const fixture = createFixture("mismatch.mp4", PNG_BYTES.byteLength);
    const initiated = await fixture.service.initiate({
      actorId: "actor-advertiser",
      orderId: ORDER_ID,
      filename: fixture.filename,
      declaredMimeType: "video/mp4",
      expectedSizeBytes: PNG_BYTES.byteLength,
      idempotencyKey: "upload-initiate-mismatch",
    });
    await fixture.storage.putSignedUpload(initiated.upload.url, PNG_BYTES, initiated.upload.requiredHeaders);
    await expect(
      fixture.service.complete({
        actorId: "actor-advertiser",
        attachmentId: ATTACHMENT_ID,
        idempotencyKey: "upload-complete-mismatch",
      }),
    ).rejects.toMatchObject({ code: "UPLOAD_REJECTED" });
    expect((await fixture.repository.findById(ATTACHMENT_ID))?.status).toBe("QUARANTINED");
    await expect(fixture.service.createDownload({ actorId: "actor-advertiser", attachmentId: ATTACHMENT_ID })).rejects.toMatchObject({
      code: "UPLOAD_REJECTED",
    });
  });

  it("fails closed instead of constructing a live in-memory provider", () => {
    expect(() => providers.createPrivateObjectStorage({ mode: "LIVE" })).toThrow("not configured");
    expect(providers.createPrivateObjectStorage({ mode: "SANDBOX" }).mode).toBe("SANDBOX");
  });

  it("does not reserve storage when the order-scoped authorization hook denies the actor", async () => {
    const fixture = createFixture();
    fixture.authorization.assertCanUpload.mockRejectedValueOnce(new Error("denied"));
    await expect(
      fixture.service.initiate({
        actorId: "cross-tenant-actor",
        orderId: ORDER_ID,
        filename: fixture.filename,
        declaredMimeType: "video/mp4",
        expectedSizeBytes: MP4_BYTES.byteLength,
        idempotencyKey: "upload-initiate-denied",
      }),
    ).rejects.toThrow("denied");
    await expect(fixture.repository.findById(ATTACHMENT_ID)).resolves.toBeNull();
  });
});
