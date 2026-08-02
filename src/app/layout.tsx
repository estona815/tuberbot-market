import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./globals.css";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN ?? "https://tuberbot.co.kr"),
  title: {
    default: "튜버봇 마켓 | 유튜브 광고 거래 제품 프리뷰",
    template: "%s | 튜버봇 마켓",
  },
  description: "샘플 데이터로 유튜브 광고 상품 탐색, 제안, 계약 기록과 콘텐츠 검수 화면을 확인하는 제품 프리뷰입니다.",
  applicationName: "튜버봇 마켓",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "튜버봇 마켓",
    title: "튜버봇 마켓",
    description: "샘플 데이터로 확인하는 유튜브 광고 거래 제품 프리뷰.",
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
