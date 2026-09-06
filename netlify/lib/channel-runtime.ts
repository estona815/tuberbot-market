import { getStore, getDeployStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";
import { ChannelSyncService, type ChannelStore } from "../../src/lib/channels/sync-service";
import { registeredChannelIds } from "../../src/lib/channels/registry";
export function createChannelService(context: Context): ChannelSyncService {
  const production = context.deploy.context === "production";
  const store = production
    ? getStore({ name: "youtube-channel-cache-v1", consistency: "strong" })
    : getDeployStore({ name: "youtube-channel-cache-preview-v1", consistency: "strong" });
  const storage: ChannelStore = {
    async read() {
      const saved = await store.getWithMetadata("snapshot", { type: "json", consistency: "strong" });
      if (!saved) return null;
      // Never downgrade an existing record to an unconditional write if the SDK omits its ETag.
      if (typeof saved.etag !== "string" || !saved.etag) throw new Error("STORAGE_ETAG_REQUIRED");
      return { value: saved.data, etag: saved.etag };
    },
    async compareAndSet(value, etag) {
      const result = await store.setJSON("snapshot", value, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
      return result.modified;
    },
  };
  return new ChannelSyncService({
    ids: registeredChannelIds(), store: storage,
    apiKey: Netlify.env.get("YOUTUBE_API_KEY"),
    enabled: production && Netlify.env.get("YOUTUBE_SYNC_ENABLED") !== "false",
  });
}
