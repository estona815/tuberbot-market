import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { StatusLabel } from "@/components/status-label";
import { marketplacePackages } from "@/lib/market-data";

export const metadata: Metadata = {
  title: "유튜버 검색",
  description: "샘플 프로필로 튜버봇 유튜버 탐색 화면을 미리 확인하는 제품 프리뷰입니다.",
  alternates: { canonical: "/creators" },
  robots: { index: false, follow: false },
};

export default function LegacySearchPage() {
  return (
    <div className="legacy-search page-shell">
      <div className="legacy-search__head"><div><h1>유튜버 검색 프리뷰</h1><p>샘플 프로필로 검색 화면 구조를 확인합니다. 실제 채널 소유권·판매 가능 상태가 아닙니다.</p></div><form action="/search"><label className="search-control"><SearchIcon /><span className="sr-only">유튜버 검색</span><input name="q" placeholder="샘플 유튜버를 검색하세요" /></label></form></div>
      <p className="policy-callout">샘플 데이터 · 거래 불가 · 예상 광고 단가와 CPV 비공개</p>
      <div className="creator-table" role="table" aria-label="유튜버 목록">
        <div className="creator-table__row creator-table__header" role="row"><span>채널명</span><span>카테고리</span><span>상태</span><span>광고 상품</span></div>
        {marketplacePackages.map((item) => <Link className="creator-table__row" href={`/creators/${item.creatorSlug}`} key={item.creatorSlug} role="row"><strong>{item.creatorName}</strong><span>{item.category}</span><span><StatusLabel tone="info">샘플 프로필</StatusLabel></span><span>거래 불가 · {item.title}</span></Link>)}
      </div>
    </div>
  );
}
