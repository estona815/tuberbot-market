import { z } from "zod";
import { channelIdSchema, type ChannelRecord, type SyncErrorCode } from "../domain/channel-snapshot";
export class YouTubeSyncError extends Error {
  constructor(readonly code: SyncErrorCode, readonly retryable = false) { super(code); this.name = "YouTubeSyncError"; }
}
const sourceCounter = z.string().regex(/^\d{1,20}$/u).optional();
const responseSchema = z.object({ items: z.array(z.object({
  id: channelIdSchema,
  snippet: z.object({ title: z.string().min(1).max(300), thumbnails: z.record(z.string(), z.object({ url: z.string().max(2048) })).optional() }),
  statistics: z.object({ subscriberCount: sourceCounter, viewCount: sourceCounter, videoCount: sourceCounter, hiddenSubscriberCount: z.boolean().optional() }),
})).max(50) });
async function boundedResponse(response: Response): Promise<string> {
  if (!response.body || Number(response.headers.get("content-length") ?? 0) > 256_000) throw new YouTubeSyncError("INVALID_RESPONSE");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 256_000) { await reader.cancel(); throw new YouTubeSyncError("INVALID_RESPONSE"); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}
function thumbnail(input: string | undefined): string | null {
  if (!input) return null;
  try { const url = new URL(input);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && ["yt3.ggpht.com", "yt3.googleusercontent.com"].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}
/** Fixed official endpoint, whitelist-sized batches, no page scraping or quota/key rotation. */
export async function fetchYouTubeBatch(ids: string[], apiKey: string, options: { request?: typeof fetch; signal?: AbortSignal; now?: () => Date } = {}): Promise<ChannelRecord[]> {
  if (ids.length < 1 || ids.length > 50 || new Set(ids).size !== ids.length || ids.some((id) => !channelIdSchema.safeParse(id).success)) throw new YouTubeSyncError("INVALID_RESPONSE");
  if (!apiKey || apiKey.length > 256 || /\s/u.test(apiKey)) throw new YouTubeSyncError("API_CONFIGURATION");
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.search = new URLSearchParams({ part: "snippet,statistics", id: ids.join(","), maxResults: "50", key: apiKey,
    fields: "items(id,snippet(title,thumbnails),statistics(subscriberCount,hiddenSubscriberCount,viewCount,videoCount))" }).toString();
  try {
    const response = await (options.request ?? fetch)(url, { method: "GET", cache: "no-store", redirect: "error", signal: options.signal ?? AbortSignal.timeout(5000) });
    const text = await boundedResponse(response);
    if (!response.ok) {
      let reason = "";
      try { reason = String(JSON.parse(text)?.error?.errors?.[0]?.reason ?? ""); } catch { /* Never surface upstream bodies. */ }
      if (["quotaExceeded", "dailyLimitExceeded"].includes(reason) || response.status === 429) throw new YouTubeSyncError("QUOTA_LIMIT");
      if (response.status === 400 || response.status === 401 || response.status === 403) throw new YouTubeSyncError("API_CONFIGURATION");
      throw new YouTubeSyncError("UPSTREAM_ERROR", response.status >= 500);
    }
    const parsed = responseSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new YouTubeSyncError("INVALID_RESPONSE");
    const items = new Map(parsed.data.items.map((item) => [item.id, item]));
    if (items.size !== parsed.data.items.length || [...items.keys()].some((id) => !ids.includes(id))) throw new YouTubeSyncError("INVALID_RESPONSE");
    const observedAt = (options.now?.() ?? new Date()).toISOString();
    return ids.map((youtubeId): ChannelRecord => {
      const item = items.get(youtubeId);
      if (!item) return { youtubeId, state: "UNAVAILABLE", data: null, observedAt };
      const hidden = item.statistics.hiddenSubscriberCount === true;
      return { youtubeId, state: "AVAILABLE", observedAt, data: {
        title: item.snippet.title,
        thumbnailUrl: thumbnail(item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url),
        hiddenSubscriberCount: hidden, subscriberCount: hidden ? null : item.statistics.subscriberCount ?? null,
        viewCount: item.statistics.viewCount ?? null, videoCount: item.statistics.videoCount ?? null,
      } };
    });
  } catch (error) {
    if (error instanceof YouTubeSyncError) throw error;
    if (options.signal?.aborted) throw new YouTubeSyncError("DEADLINE");
    if (error instanceof SyntaxError) throw new YouTubeSyncError("INVALID_RESPONSE");
    throw new YouTubeSyncError("UPSTREAM_ERROR", true);
  }
}
