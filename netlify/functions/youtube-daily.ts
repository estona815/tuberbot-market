import type { Config, Context } from "@netlify/functions";
import { createChannelService } from "../lib/channel-runtime";
export default async function youtubeDaily(_request: Request, context: Context) {
  const result = await createChannelService(context).refresh("scheduled");
  console.log(JSON.stringify({ event: "youtube_daily_sync", status: result.status,
    registeredCount: result.registeredCount, lastCompleteAt: result.lastCompleteAt, errorCode: result.lastError }));
}
export const config: Config = { schedule: "10 18 * * *" };
