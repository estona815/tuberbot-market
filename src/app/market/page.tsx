import type { Metadata } from "next";
import { MarketExplorer } from "@/components/market-explorer";
import { marketplacePackages } from "@/lib/market-data";

export const metadata: Metadata = {
  title: "광고 상품 구성 미리보기",
  description: "실제 거래 정보가 아닌 샘플 데이터로 튜버봇 광고 상품 화면을 미리 확인하세요.",
  alternates: { canonical: "/market" },
  robots: { index: false, follow: false },
};

type MarketSearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MarketPage({ searchParams }: { searchParams: MarketSearchParams }) {
  const params = await searchParams;
  const category = first(params.category);
  const format = first(params.format);
  return (
    <MarketExplorer
      initialCategory={["라이프스타일", "IT·테크", "뷰티"].includes(category ?? "") ? category : "전체"}
      initialFormat={["SHORTS", "LONGFORM_INTEGRATION", "UGC"].includes(format ?? "") ? format : "전체"}
      initialQuery={first(params.q) ?? ""}
      items={marketplacePackages}
    />
  );
}
