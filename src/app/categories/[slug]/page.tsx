import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketExplorer } from "@/components/market-explorer";
import { marketplacePackages } from "@/lib/market-data";

const categories: Readonly<Record<string, string>> = { tech: "IT·테크", beauty: "뷰티", lifestyle: "라이프스타일" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = categories[slug];
  return category
    ? {
        title: `${category} 광고 상품 구성 미리보기`,
        description: `${category} 샘플 데이터로 광고 상품 화면을 확인하는 제품 프리뷰입니다.`,
        alternates: { canonical: `/categories/${slug}` },
        robots: { index: false, follow: false },
      }
    : { title: "카테고리를 찾을 수 없음", robots: { index: false } };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = categories[slug];
  if (!category) notFound();
  return <MarketExplorer items={marketplacePackages.filter((item) => item.category === category)} />;
}
