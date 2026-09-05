import { z } from "zod";
export function parseYouTubeChannelInput(raw: string): { kind: "id" | "forHandle"; value: string } {
  let value = raw.trim().normalize("NFC");
  if (!value || value.length > 300) throw new Error("채널 ID 또는 @핸들을 입력하세요.");
  if (value.startsWith("https://")) {
    const url = new URL(value);
    if (!["youtube.com","www.youtube.com","m.youtube.com"].includes(url.hostname) || url.username || url.password || url.port || url.search || url.hash) throw new Error("YouTube 채널 주소만 지원합니다.");
    value = decodeURIComponent(url.pathname).replace(/^\/channel\//u, "").replace(/^\//u, "").replace(/\/$/u, "");
  }
  if (/^UC[A-Za-z0-9_-]{22}$/u.test(value)) return { kind: "id", value };
  if (/^@[\p{L}\p{N}_.\-·]{3,60}$/u.test(value)) return { kind: "forHandle", value };
  throw new Error("UC로 시작하는 채널 ID 또는 @핸들을 입력하세요. 영상 링크와 임의 웹주소는 지원하지 않습니다.");
}
const counter = z.string().regex(/^\d{1,20}$/u);
const responseSchema = z.object({ items: z.array(z.object({ id: z.string().regex(/^UC[\w-]{22}$/u), snippet: z.object({ title: z.string().max(300), description: z.string().max(10000), customUrl: z.string().optional() }), statistics: z.object({ subscriberCount: counter.optional(), hiddenSubscriberCount: z.boolean().optional(), viewCount: counter.optional(), videoCount: counter.optional() }) })).max(1) });
export async function lookupYouTubeChannel(raw: string, key: string, request: typeof fetch = fetch, now = new Date()) {
  if (!key || key.length < 10) throw new Error("YouTube 연결이 설정되지 않았습니다.");
  const input = parseYouTubeChannelInput(raw);
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.search = new URLSearchParams({ part: "snippet,statistics", [input.kind]: input.value, maxResults: "1", key }).toString();
  const response = await request(url, { signal: AbortSignal.timeout(10000), cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error("YouTube 조회를 완료하지 못했습니다. 연결과 할당량을 확인하세요.");
  const body = await response.text();
  if (body.length > 64000) throw new Error("YouTube 응답이 허용 크기를 넘었습니다.");
  const item = responseSchema.parse(JSON.parse(body)).items[0];
  if (!item) return null;
  return { id: item.id, title: item.snippet.title, description: item.snippet.description, handle: item.snippet.customUrl ?? null, subscribers: item.statistics.hiddenSubscriberCount ? null : item.statistics.subscriberCount ?? null, views: item.statistics.viewCount ?? null, videos: item.statistics.videoCount ?? null, source: "YOUTUBE_DATA_API_V3" as const, observedAt: now.toISOString(), youtubeUrl: `https://www.youtube.com/channel/${item.id}`, ownershipVerified: false, rateEstimate: null };
}
