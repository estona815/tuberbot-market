import type { MetadataRoute } from "next";

const origin = process.env.APP_ORIGIN ?? "https://tuberbot.co.kr";

export default function robots(): MetadataRoute.Robots {
  if (process.env.ENABLE_PUBLIC_INDEXING !== "true") {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/dashboard/", "/licenses", "/messages", "/notifications", "/onboarding/", "/orders/", "/reviews", "/settings/", "/verification/"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
