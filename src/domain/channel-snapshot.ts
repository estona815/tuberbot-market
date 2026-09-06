import { z } from "zod";

export const CHANNEL_SYNC_VERSION = 1;
export const CHANNEL_SYNC_CRON = "10 18 * * *"; // 03:10 Asia/Seoul every day.
export const DETAIL_REFRESH_MS = 6 * 60 * 60 * 1000;
// Purge one day before the ordinary 30-day YouTube API refresh/delete boundary.
export const CHANNEL_RETENTION_MS = 29 * 24 * 60 * 60 * 1000;
export const MAX_REGISTERED_CHANNELS = 1000;
export const channelIdSchema = z.string().regex(/^UC[A-Za-z0-9_-]{22}$/u);
const timestamp = z.string().datetime();
const count = z.string().regex(/^\d{1,20}$/u).nullable();
export const channelMetricsSchema = z.strictObject({
  title: z.string().min(1).max(300),
  thumbnailUrl: z.string().url().max(2048).nullable(),
  subscriberCount: count, viewCount: count, videoCount: count,
  hiddenSubscriberCount: z.boolean(),
}).refine((value) => !value.hiddenSubscriberCount || value.subscriberCount === null);
export type ChannelMetrics = z.infer<typeof channelMetricsSchema>;
export const channelRecordSchema = z.strictObject({
  youtubeId: channelIdSchema,
  observedAt: timestamp,
  state: z.enum(["AVAILABLE", "UNAVAILABLE", "EXPIRED"]),
  data: channelMetricsSchema.nullable(),
}).refine((value) => (value.state === "AVAILABLE") === (value.data !== null));
export type ChannelRecord = z.infer<typeof channelRecordSchema>;
export const syncErrorSchema = z.enum(["QUOTA_LIMIT", "API_CONFIGURATION", "UPSTREAM_ERROR", "INVALID_RESPONSE", "DEADLINE", "STORAGE_UNAVAILABLE"]);
export type SyncErrorCode = z.infer<typeof syncErrorSchema>;
export const syncDocumentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  records: z.array(channelRecordSchema).max(MAX_REGISTERED_CHANNELS),
  lastAttemptAt: timestamp.nullable(), lastCompleteAt: timestamp.nullable(),
  lastError: syncErrorSchema.nullable(), retryAfter: timestamp.nullable(),
  lease: z.strictObject({ token: z.string().uuid(), expiresAt: timestamp }).nullable(),
  allowance: z.strictObject({ day: z.string(), reservedRequests: z.number().int().min(0).max(10000) }),
}).refine((doc) => new Set(doc.records.map((record) => record.youtubeId)).size === doc.records.length);
export type SyncDocument = z.infer<typeof syncDocumentSchema>;
export function emptySyncDocument(): SyncDocument {
  return { schemaVersion: 1, records: [], lastAttemptAt: null, lastCompleteAt: null, lastError: null, retryAfter: null, lease: null, allowance: { day: "", reservedRequests: 0 } };
}
export function nextChannelSync(now: Date): string {
  const next = new Date(now); next.setUTCHours(18, 10, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}
/** Remove API names, images and counters, not just their visibility, at retention expiry. */
export function pruneChannelRecords(records: ChannelRecord[], allowedIds: string[], now: Date): ChannelRecord[] {
  const allowed = new Set(allowedIds);
  return records.filter((record) => allowed.has(record.youtubeId)).map((record) => {
    const age = now.getTime() - Date.parse(record.observedAt);
    return record.state === "AVAILABLE" && (age >= CHANNEL_RETENTION_MS || age < -60_000)
      ? { ...record, state: "EXPIRED" as const, data: null } : record;
  });
}
export const catalogSchema = z.strictObject({
  schemaVersion: z.literal(1), source: z.literal("YOUTUBE_DATA_API_V3"), configured: z.boolean(),
  status: z.enum(["NOT_CONFIGURED", "WAITING_FOR_FIRST_SYNC", "READY", "DEGRADED", "STORAGE_UNAVAILABLE"]),
  servedAt: timestamp, nextScheduledAt: timestamp,
  scheduleKst: z.literal("매일 03:10 (한국시간)"), detailRefreshHours: z.literal(6),
  lastAttemptAt: timestamp.nullable(), lastCompleteAt: timestamp.nullable(),
  lastError: syncErrorSchema.nullable(), retryAfter: timestamp.nullable(),
  registeredCount: z.number().int().min(0).max(MAX_REGISTERED_CHANNELS),
  records: z.array(channelRecordSchema).max(MAX_REGISTERED_CHANNELS),
});
export type ChannelCatalog = z.infer<typeof catalogSchema>;
export function publicCatalog(doc: SyncDocument, ids: string[], configured: boolean, now = new Date(), storageUnavailable = false): ChannelCatalog {
  const records = pruneChannelRecords(doc.records, ids, now);
  return {
    schemaVersion: 1, source: "YOUTUBE_DATA_API_V3", configured,
    status: storageUnavailable ? "STORAGE_UNAVAILABLE" : !configured ? "NOT_CONFIGURED" : doc.lastError ? "DEGRADED" : doc.lastCompleteAt ? "READY" : "WAITING_FOR_FIRST_SYNC",
    servedAt: now.toISOString(), nextScheduledAt: nextChannelSync(now),
    scheduleKst: "매일 03:10 (한국시간)", detailRefreshHours: 6,
    lastAttemptAt: doc.lastAttemptAt, lastCompleteAt: doc.lastCompleteAt,
    lastError: storageUnavailable ? "STORAGE_UNAVAILABLE" : doc.lastError,
    retryAfter: doc.retryAfter, registeredCount: ids.length, records,
  };
}
export function isFreshRecord(record: ChannelRecord | undefined, now: Date, ttl = DETAIL_REFRESH_MS): boolean {
  if (!record || record.state === "EXPIRED") return false;
  const age = now.getTime() - Date.parse(record.observedAt);
  return age >= 0 && age < ttl;
}
/** Counters stay decimal strings from source to UI; no inferred zero or unsafe Number conversion. */
export function displayYouTubeCount(value: string | null): string {
  return value === null ? "비공개·미제공" : BigInt(value).toLocaleString("ko-KR");
}
