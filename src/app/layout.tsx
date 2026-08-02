import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./globals.css";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN ?? "https://tuberbot.co.kr"),
  title: {
    default: "튜버봇 | 유튜버 탐색부터 광고 거래까지",
    template: "%s | 튜버봇",
  },
  description: "원본 유튜버 정보를 탐색하고 제안, 역제안, 계약, 샌드박스 결제와 콘텐츠 검수 흐름을 확인하세요.",
  applicationName: "튜버봇",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "튜버봇",
    title: "튜버봇 | 유튜버 탐색부터 광고 거래까지",
    description: "유튜버 탐색과 광고 거래 전 과정을 한곳에서 확인하는 공개 제품 프리뷰.",
    images: [
      {
        url: "/og-tuberbot.png",
        width: 1200,
        height: 630,
        alt: "튜버봇 — 유튜버 탐색부터 광고 거래까지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "튜버봇 | 유튜버 탐색부터 광고 거래까지",
    description: "제안, 계약, 샌드박스 결제와 제작 검수 흐름을 한곳에서 확인하세요.",
    images: ["/og-tuberbot.png"],
  },
  robots: process.env.ENABLE_PUBLIC_INDEXING === "true"
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  return (
    <html data-scroll-behavior="smooth" lang="ko">
      <body>
        <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
