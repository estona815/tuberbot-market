import { emptySyncDocument, publicCatalog } from "@/domain/channel-snapshot";
import { registeredChannelIds } from "@/lib/channels/registry";
/** Next/local fallback. Production Netlify uses netlify/functions/channel-data.ts. */
export function GET() {
  return Response.json(publicCatalog(emptySyncDocument(), registeredChannelIds(), false), { headers: { "Cache-Control": "no-store" } });
}
