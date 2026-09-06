import {
  DETAIL_REFRESH_MS, MAX_REGISTERED_CHANNELS, channelIdSchema, emptySyncDocument,
  isFreshRecord, pruneChannelRecords, publicCatalog, syncDocumentSchema,
  type ChannelCatalog, type ChannelRecord, type SyncDocument, type SyncErrorCode,
} from "../../domain/channel-snapshot";
import { fetchYouTubeBatch, YouTubeSyncError } from "../../providers/youtube-batch";
export interface ChannelStore {
  read(): Promise<{ value: unknown; etag: string } | null>;
  compareAndSet(value: SyncDocument, etag: string | null): Promise<boolean>;
}
export type SyncServiceOptions = {
  ids: string[]; store: ChannelStore; apiKey?: string; enabled?: boolean;
  request?: typeof fetch; now?: () => Date; requestLimit?: number;
};
const LEASE_MS = 90_000;
const RETRY_MS = 15 * 60_000;
/** One strongly consistent document binds quota reservation, lease, and persisted results. */
export class ChannelSyncService {
  private readonly ids: string[];
  private readonly now: () => Date;
  readonly configured: boolean;
  constructor(private readonly options: SyncServiceOptions) {
    this.ids = [...new Set(options.ids)];
    if (!this.ids.length || this.ids.length > MAX_REGISTERED_CHANNELS || this.ids.some((id) => !channelIdSchema.safeParse(id).success)) throw new Error("INVALID_CHANNEL_REGISTRY");
    this.now = options.now ?? (() => new Date());
    this.configured = options.enabled !== false && Boolean(options.apiKey);
    if (options.requestLimit !== undefined && (!Number.isInteger(options.requestLimit) || options.requestLimit < 1 || options.requestLimit > 200)) throw new Error("INVALID_SYNC_LIMIT");
  }
  private async read() {
    const saved = await this.options.store.read();
    return { doc: saved ? syncDocumentSchema.parse(saved.value) : emptySyncDocument(), etag: saved?.etag ?? null };
  }
  async catalog(): Promise<ChannelCatalog> {
    try { return publicCatalog((await this.read()).doc, this.ids, this.configured, this.now()); }
    catch { return publicCatalog(emptySyncDocument(), this.ids, this.configured, this.now(), true); }
  }
  private async cleanup(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      const { doc, etag } = await this.read(), now = this.now();
      if (doc.lease && Date.parse(doc.lease.expiresAt) > now.getTime()) return;
      const records = pruneChannelRecords(doc.records, this.ids, now);
      if (JSON.stringify(records) === JSON.stringify(doc.records)) return;
      if (await this.options.store.compareAndSet({ ...doc, records }, etag)) return;
    }
    throw new Error("CACHE_CLEANUP_CONFLICT");
  }
  /** Also called without credentials, so retention cleanup is not disabled with API access. */
  async refresh(reason: "scheduled" | "page" = "page"): Promise<ChannelCatalog> {
    const started = this.now();
    try {
      await this.cleanup();
      if (!this.configured) return this.catalog();
      const batches: string[][] = [];
      for (let i = 0; i < this.ids.length; i += 50) batches.push(this.ids.slice(i, i + 50));
      const allowance = batches.length * 2, token = crypto.randomUUID();
      let acquired = false;
      for (let i = 0; i < 3; i++) {
        const { doc, etag } = await this.read(), now = this.now();
        if (doc.lease && Date.parse(doc.lease.expiresAt) > now.getTime()) return publicCatalog(doc, this.ids, this.configured, now);
        if (doc.retryAfter && Date.parse(doc.retryAfter) > now.getTime()) return publicCatalog(doc, this.ids, this.configured, now);
        const byId = new Map(doc.records.map((record) => [record.youtubeId, record]));
        if (this.ids.every((id) => isFreshRecord(byId.get(id), now, DETAIL_REFRESH_MS))) return publicCatalog(doc, this.ids, this.configured, now);
        const day = now.toISOString().slice(0, 10);
        const used = doc.allowance.day === day ? doc.allowance.reservedRequests : 0;
        if (used + allowance > (this.options.requestLimit ?? 200)) {
          const tomorrow = new Date(now); tomorrow.setUTCHours(24, 0, 0, 0);
          if (await this.options.store.compareAndSet({ ...doc, lastError: "QUOTA_LIMIT", retryAfter: tomorrow.toISOString() }, etag)) return this.catalog();
          continue;
        }
        const next: SyncDocument = { ...doc, lastAttemptAt: now.toISOString(),
          lease: { token, expiresAt: new Date(now.getTime() + LEASE_MS).toISOString() },
          allowance: { day, reservedRequests: used + allowance } };
        acquired = await this.options.store.compareAndSet(next, etag);
        if (acquired) break;
      }
      if (!acquired) return this.catalog();
      const budget = AbortSignal.timeout(22_000);
      const updated: ChannelRecord[] = [], errors: SyncErrorCode[] = [];
      let nextBatch = 0;
      const worker = async () => {
        while (nextBatch < batches.length) {
          const batch = batches[nextBatch++];
          if (!batch) break;
          if (budget.aborted) { errors.push("DEADLINE"); break; }
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              updated.push(...await fetchYouTubeBatch(batch, this.options.apiKey!, {
                request: this.options.request, now: this.now,
                signal: AbortSignal.any([budget, AbortSignal.timeout(4500)]),
              }));
              break;
            } catch (error) {
              const problem = error instanceof YouTubeSyncError ? error : new YouTubeSyncError("UPSTREAM_ERROR");
              if (attempt === 0 && problem.retryable && !budget.aborted) { await new Promise((resolve) => setTimeout(resolve, 150)); continue; }
              errors.push(problem.code); break;
            }
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, batches.length) }, worker));
      for (let i = 0; i < 3; i++) {
        const { doc, etag } = await this.read(), now = this.now();
        if (doc.lease?.token !== token) return publicCatalog(doc, this.ids, this.configured, now);
        const merged = new Map(pruneChannelRecords(doc.records, this.ids, now).map((record) => [record.youtubeId, record]));
        for (const record of updated) merged.set(record.youtubeId, record);
        const failure = errors.includes("QUOTA_LIMIT") ? "QUOTA_LIMIT" : errors.includes("API_CONFIGURATION") ? "API_CONFIGURATION" : errors[0] ?? null;
        const complete = !failure && updated.length === this.ids.length;
        const code = complete ? null : failure ?? "DEADLINE";
        const retryMs = code === "QUOTA_LIMIT" ? 24 * 60 * 60_000 : code === "API_CONFIGURATION" ? 60 * 60_000 : RETRY_MS;
        const next: SyncDocument = { ...doc, records: [...merged.values()], lease: null,
          lastCompleteAt: complete ? now.toISOString() : doc.lastCompleteAt,
          lastError: code, retryAfter: code ? new Date(now.getTime() + retryMs).toISOString() : null };
        if (await this.options.store.compareAndSet(next, etag)) return publicCatalog(next, this.ids, this.configured, now);
      }
      return this.catalog();
    } catch {
      const fallback = await this.catalog();
      return { ...fallback, status: "STORAGE_UNAVAILABLE", lastError: "STORAGE_UNAVAILABLE", servedAt: started.toISOString() };
    } finally { void reason; }
  }
}
