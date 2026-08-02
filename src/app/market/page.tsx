import type { Metadata } from "next";
import { MarketExplorer } from "@/components/market-explorer";
import { marketplacePackages } from "@/lib/market-data";

export const metadata: Metadata = {
  title: "광고 상품 구성 미리보기",
  description: "실제 거래 정보가 아닌 샘플 데이터로 튜버봇 광고 상품 화면을 미리 확인하세요.",
  alternates: { canonical: "/market" },
  robots: { index: false, follow: false },
};

export default function MarketPage() {
  return <MarketExplorer items={marketplacePackages} />;
}
