import type { Config, Context } from "@netlify/functions";
import { createChannelService } from "../lib/channel-runtime";
import { registeredChannelIds } from "../../src/lib/channels/registry";
import { emptySyncDocument, publicCatalog } from "../../src/domain/channel-snapshot";
export default async function channelData(request: Request, context: Context) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" };
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), { status: 405, headers });
  const params = new URL(request.url).searchParams, ids = registeredChannelIds();
  if ([...params.keys()].some((name) => name !== "id") || params.getAll("id").length > 1 || (params.has("id") && !ids.includes(params.get("id")!))) {
    return new Response(JSON.stringify({ error: "UNKNOWN_CHANNEL" }), { status: 404, headers });
  }
  try {
    const service = createChannelService(context);
    const catalog = await service.refresh("page");
    return new Response(JSON.stringify(catalog), { headers: { ...headers,
      "Netlify-CDN-Cache-Control": "public, max-age=60, must-revalidate",
    } });
  } catch {
    const configured = context.deploy.context === "production" && Boolean(Netlify.env.get("YOUTUBE_API_KEY")) && Netlify.env.get("YOUTUBE_SYNC_ENABLED") !== "false";
    return new Response(JSON.stringify(publicCatalog(emptySyncDocument(), ids, configured, new Date(), true)), { headers });
  }
}
export const config: Config = {
  path: "/api/channel-data",
  rateLimit: { action: "rate_limit", aggregateBy: ["domain", "ip"], windowLimit: 60, windowSize: 60 },
};
