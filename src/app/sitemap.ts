import type { MetadataRoute } from "next";
import { publicSitePages } from "@/lib/site-pages";

const origin = process.env.APP_ORIGIN ?? "https://tuberbot.co.kr";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date("2026-08-02T00:00:00+09:00");
  const publicPaths = Object.entries(publicSitePages)
    .filter(([, page]) => !page.noIndex)
    .map(([path]) => path);
  return ["", ...publicPaths].map((path) => ({
    url: `${origin}/${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
