import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, ShieldIcon } from "@/components/icons";
import { publicCampaigns } from "@/lib/campaign-data";

export const metadata: Metadata = {
  title: "광고 캠페인 구성 미리보기",
  description: "실제 모집 공고가 아닌 샘플 데이터로 캠페인 화면을 확인하는 제품 프리뷰입니다.",
  alternates: { canonical: "/campaigns" },
  robots: { index: false, follow: false },
};

export default function CampaignsPage() {
  return (
    <div className="campaign-page page-shell">
      <div className="campaign-page__head"><div><h1>광고 캠페인 구성 미리보기</h1><p>화면 검수를 위한 샘플 캠페인입니다. 현재 광고주 모집·지원·제출 기능은 제공하지 않습니다.</p></div><Link className="button button--secondary" href="/campaigns/new">등록 화면 미리보기</Link></div>
      <div className="campaign-list">{publicCampaigns.map((item) => <article key={item.id}><div className="campaign-list__body"><span>{item.brand} · {item.category}</span><h2><Link href={`/campaigns/${item.id}`}>{item.title}</Link></h2><dl><div><dt>예산</dt><dd>{item.budget}</dd></div><div><dt>광고 형식</dt><dd>{item.format}</dd></div><div><dt>게시 희망일</dt><dd>샘플 일정 · {item.date}</dd></div></dl><p><ShieldIcon /> 샘플 데이터 · 모집 및 지원 불가</p></div><Link className="button button--secondary" href={`/campaigns/${item.id}`}>샘플 상세 보기</Link></article>)}</div>
      <aside className="campaign-note"><CheckIcon /><div><strong>제품 프리뷰 구조</strong><p>유튜버별 주문·계약·결제·검수·정산 구조를 설명하기 위한 화면이며 실제 거래 상태가 아닙니다.</p></div></aside>
    </div>
  );
}
