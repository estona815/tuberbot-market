import { lookupYouTubeChannel, parseYouTubeChannelInput } from "@/providers/youtube";
import { authenticateSessionRequest } from "@/lib/server/auth/runtime";
import { getRequestId, noStoreJson, publicApiError } from "@/lib/server/api-envelope";
import { consumeServiceLimit } from "@/lib/server/service-limits";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const id = getRequestId(request);
  try {
    if (process.env.ENABLE_YOUTUBE_LOOKUP !== "true" || !process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_POLICY_REVIEW_CONFIRMED !== "true") return publicApiError("YOUTUBE_CONNECTION_REQUIRED", 503, id);
    const auth = await authenticateSessionRequest(request);
    if (!auth || auth.session.authMethod !== "EXTERNAL_PROVIDER") return publicApiError("LOGIN_REQUIRED", 401, id);
    const raw = new URL(request.url).searchParams.get("channel") ?? "";
    try { parseYouTubeChannelInput(raw); } catch { return publicApiError("INVALID_CHANNEL_INPUT", 400, id); }
    if (!await consumeServiceLimit(`youtube:${auth.actor.userId}`, 20, 3600) || !await consumeServiceLimit("youtube:daily-global", 1000, 86400)) return publicApiError("QUOTA_LIMIT", 429, id);
    const channel = await lookupYouTubeChannel(raw, process.env.YOUTUBE_API_KEY);
    return noStoreJson({ channel }, { status: channel ? 200 : 404, requestId: id });
  } catch { return publicApiError("YOUTUBE_LOOKUP_UNAVAILABLE", 503, id); }
}
