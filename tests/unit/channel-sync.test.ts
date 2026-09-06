import { describe, expect, it, vi } from "vitest";
import { CHANNEL_RETENTION_MS, DETAIL_REFRESH_MS, emptySyncDocument, nextChannelSync, publicCatalog, type ChannelRecord, type SyncDocument } from "@/domain/channel-snapshot";
import { ChannelSyncService, type ChannelStore } from "@/lib/channels/sync-service";
import { fetchYouTubeBatch } from "@/providers/youtube-batch";
const ID = `UC${"a".repeat(22)}`, OTHER = `UC${"b".repeat(22)}`;
const KEY = "test-only-no-real-key";
const START = new Date("2026-09-06T00:00:00.000Z");
const data = { title: "테스트 채널", thumbnailUrl: null, subscriberCount: "123000", viewCount: "999999999", videoCount: "200", hiddenSubscriberCount: false };
const record = (now = START): ChannelRecord => ({ youtubeId: ID, observedAt: now.toISOString(), state: "AVAILABLE", data: { ...data } });
const item = (id = ID) => ({ id, snippet: { title: "갱신 채널", thumbnails: { default: { url: "https://yt3.ggpht.com/test-image" } } }, statistics: { subscriberCount: "456000", hiddenSubscriberCount: false, viewCount: "9007199254740995", videoCount: "250" } });
const response = (ids = [ID]) => new Response(JSON.stringify({ items: ids.map(item) }));
class MemoryStore implements ChannelStore {
  version = 0; value: SyncDocument | null = null;
  async read() { return this.value ? { value: structuredClone(this.value), etag: String(this.version) } : null; }
  async compareAndSet(value: SyncDocument, etag: string | null) {
    if (etag !== (this.value ? String(this.version) : null)) return false;
    this.value = structuredClone(value); this.version++; return true;
  }
}
function setup(initial?: SyncDocument, options: { ids?: string[]; requestLimit?: number; key?: string } = {}) {
  const store = new MemoryStore(); store.value = initial ?? null;
  const time = { now: new Date(START) };
  const request = vi.fn<typeof fetch>().mockImplementation(async (url) => response(new URL(String(url)).searchParams.get("id")!.split(",")));
  const service = new ChannelSyncService({ store, ids: options.ids ?? [ID], apiKey: options.key ?? KEY, request, requestLimit: options.requestLimit, now: () => new Date(time.now) });
  return { store, time, request, service };
}
describe("official channel batch provider", () => {
  it("preserves raw counters, source title and hidden counts without unsafe number conversion", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response());
    const records = await fetchYouTubeBatch([ID], KEY, { request, now: () => START });
    expect(records[0]?.data?.viewCount).toBe("9007199254740995");
    expect(records[0]?.observedAt).toBe(START.toISOString());
    expect(new URL(String(request.mock.calls[0]?.[0])).origin).toBe("https://www.googleapis.com");
    expect(request.mock.calls[0]?.[1]?.redirect).toBe("error");
    const hidden = item(); hidden.statistics.hiddenSubscriberCount = true;
    request.mockResolvedValue(new Response(JSON.stringify({ items: [hidden] })));
    expect((await fetchYouTubeBatch([ID], KEY, { request }))[0]?.data?.subscriberCount).toBeNull();
  });
  it("marks an omitted channel unavailable rather than inventing zero statistics", async () => {
    const rows = await fetchYouTubeBatch([ID], KEY, { request: vi.fn<typeof fetch>().mockResolvedValue(response([])), now: () => START });
    expect(rows).toEqual([{ youtubeId: ID, observedAt: START.toISOString(), state: "UNAVAILABLE", data: null }]);
  });
  it.each([[], ["https://localhost/"], [ID, ID], Array(51).fill(ID)])("rejects invalid batches before network access", async (ids) => {
    const request = vi.fn<typeof fetch>();
    await expect(fetchYouTubeBatch(ids, KEY, { request })).rejects.toThrow(); expect(request).not.toHaveBeenCalled();
  });
  it.each([
    { items: [item(OTHER)] }, { items: [item(), item()] }, { items: [{ ...item(), statistics: { subscriberCount: "NaN" } }] },
    { items: [{ ...item(), snippet: null }] }, {},
  ])("rejects mismatched IDs, duplicate IDs and malformed provider data", async (value) => {
    await expect(fetchYouTubeBatch([ID], KEY, { request: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(value))) })).rejects.toThrow("INVALID_RESPONSE");
  });
  it("drops non-YouTube thumbnail URLs and bounds response bytes", async () => {
    const row = item(); row.snippet.thumbnails.default.url = "https://evil.example/track";
    expect((await fetchYouTubeBatch([ID], KEY, { request: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ items: [row] }))) }))[0]?.data?.thumbnailUrl).toBeNull();
    await expect(fetchYouTubeBatch([ID], KEY, { request: vi.fn<typeof fetch>().mockResolvedValue(new Response("x".repeat(256001))) })).rejects.toThrow("INVALID_RESPONSE");
  });
  it("redacts raw Google errors and categorizes quota errors without trying alternate credentials", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: KEY, errors: [{ reason: "quotaExceeded" }] } }), { status: 403 }));
    await expect(fetchYouTubeBatch([ID], KEY, { request })).rejects.toThrow("QUOTA_LIMIT"); expect(request).toHaveBeenCalledTimes(1);
  });
});
describe("scheduled and read-through synchronization", () => {
  it("persists a source snapshot and reuses it for six hours", async () => {
    const { service, request, time, store } = setup();
    const first = await service.refresh();
    expect(first.status).toBe("READY"); expect(first.records[0]?.data?.subscriberCount).toBe("456000");
    expect(store.value?.allowance.reservedRequests).toBe(2);
    await service.refresh(); time.now = new Date(START.getTime() + DETAIL_REFRESH_MS - 1); await service.refresh();
    expect(request).toHaveBeenCalledTimes(1);
    time.now = new Date(START.getTime() + DETAIL_REFRESH_MS); await service.refresh("scheduled"); expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(await service.catalog())).not.toContain(KEY);
  });
  it("has no network side effects without a key and does not invent a successful update", async () => {
    const { service, request } = setup(undefined, { key: "" });
    const catalog = await service.refresh("scheduled"); expect(catalog.configured).toBe(false); expect(catalog.status).toBe("NOT_CONFIGURED");
    expect(catalog.lastCompleteAt).toBeNull(); expect(request).not.toHaveBeenCalled();
  });
  it("deduplicates concurrent page and scheduled refreshes using an atomic lease", async () => {
    const { service, request, store } = setup();
    await Promise.all(Array.from({ length: 30 }, (_, i) => service.refresh(i % 2 ? "page" : "scheduled")));
    expect(request).toHaveBeenCalledTimes(1); expect(store.value?.lease).toBeNull(); expect((await service.catalog()).status).toBe("READY");
  });
  it("batches 101 IDs into three requests and reserves quota before each run", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `UC${String(i).padStart(22, "0")}`);
    const { service, request, store } = setup(undefined, { ids });
    const result = await service.refresh(); expect(result.records).toHaveLength(101); expect(request).toHaveBeenCalledTimes(3);
    expect(store.value?.allowance.reservedRequests).toBe(6);
    for (const [url] of request.mock.calls) expect(new URL(String(url)).searchParams.get("id")!.split(",").length).toBeLessThanOrEqual(50);
  });
  it("preserves last success times and prior values on upstream failure, with bounded backoff", async () => {
    const original = { ...emptySyncDocument(), records: [record(new Date(START.getTime() - 86400000))], lastCompleteAt: "2026-09-05T00:00:00.000Z" };
    const { service, request, time } = setup(original); request.mockImplementation(async () => new Response("upstream unavailable", { status: 500 }));
    const result = await service.refresh(); expect(result.status).toBe("DEGRADED"); expect(result.lastCompleteAt).toBe(original.lastCompleteAt);
    expect(result.records[0]?.observedAt).toBe(original.records[0]?.observedAt);
    expect(result.records[0]?.data?.subscriberCount).toBe("123000"); expect(request).toHaveBeenCalledTimes(2);
    time.now = new Date(START.getTime() + 60_000); await service.refresh(); expect(request).toHaveBeenCalledTimes(2);
  });
  it("does not retain old source names or counters after 29 days, even with sync disabled", async () => {
    const old = record(new Date(START.getTime() - CHANNEL_RETENTION_MS));
    const { service, store, request } = setup({ ...emptySyncDocument(), records: [old] }, { key: "" });
    await service.refresh("scheduled"); expect(store.value?.records[0]?.state).toBe("EXPIRED"); expect(store.value?.records[0]?.data).toBeNull();
    expect(JSON.stringify(store.value)).not.toContain("테스트 채널"); expect(request).not.toHaveBeenCalled();
  });
  it("removes deleted/private channel numbers as soon as a successful response omits the ID", async () => {
    const { service, request } = setup({ ...emptySyncDocument(), records: [record(new Date(START.getTime() - 86400000))] });
    request.mockImplementation(async () => response([]));
    const result = await service.refresh(); expect(result.records[0]?.data).toBeNull(); expect(result.records[0]?.state).toBe("UNAVAILABLE");
  });
  it("retains successful batches during partial failure without marking a complete refresh", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `UC${String(i).padStart(22, "0")}`);
    const { service, request } = setup(undefined, { ids });
    request.mockImplementation(async (url) => {
      const group = new URL(String(url)).searchParams.get("id")!.split(",");
      return group.length === 50 ? response(group) : new Response("{}", { status: 403 });
    });
    const result = await service.refresh(); expect(result.records).toHaveLength(50); expect(result.lastCompleteAt).toBeNull(); expect(result.status).toBe("DEGRADED");
  });
  it("blocks external API calls when the daily budget cannot be reserved", async () => {
    const { service, request } = setup(undefined, { requestLimit: 1 });
    expect((await service.refresh()).lastError).toBe("QUOTA_LIMIT"); expect(request).not.toHaveBeenCalled();
  });
  it("never overwrites a newer worker's lease with a late response", async () => {
    const { service, request, store } = setup();
    request.mockImplementation(async () => {
      store.value = { ...store.value!, lease: { token: crypto.randomUUID(), expiresAt: "2026-09-06T00:05:00.000Z" } }; store.version++;
      return response();
    });
    await service.refresh(); expect(store.value?.records).toEqual([]); expect(store.value?.lease).not.toBeNull();
  });
  it("fails closed on store errors and never spends quota before durable reservation", async () => {
    const request = vi.fn<typeof fetch>();
    const service = new ChannelSyncService({ ids: [ID], apiKey: KEY, request, store: { read: async () => { throw new Error(KEY); }, compareAndSet: async () => false } });
    const result = await service.refresh(); expect(result.status).toBe("STORAGE_UNAVAILABLE"); expect(request).not.toHaveBeenCalled(); expect(JSON.stringify(result)).not.toContain(KEY);
  });
  it("does not repair a corrupt durable cache by silently dropping stored records", async () => {
    const store = new MemoryStore(); store.value = { records: "wrong" } as unknown as SyncDocument;
    const service = new ChannelSyncService({ ids: [ID], store, apiKey: KEY });
    expect((await service.refresh()).status).toBe("STORAGE_UNAVAILABLE"); expect(store.version).toBe(0);
  });
  it("computes a daily UTC cron that corresponds to 03:10 KST", () => {
    expect(nextChannelSync(new Date("2026-09-06T18:09:00.000Z"))).toBe("2026-09-06T18:10:00.000Z");
    expect(nextChannelSync(new Date("2026-09-06T18:10:00.000Z"))).toBe("2026-09-07T18:10:00.000Z");
  });
  it("public projections never expose expired metadata or internal leases", () => {
    const result = publicCatalog({ ...emptySyncDocument(), records: [record(new Date(START.getTime() - CHANNEL_RETENTION_MS))], lease: { token: crypto.randomUUID(), expiresAt: "2026-09-06T12:00:00.000Z" } }, [ID], true, START);
    expect(result.records[0]?.data).toBeNull(); expect(result).not.toHaveProperty("lease"); expect(result).not.toHaveProperty("allowance");
  });
});
