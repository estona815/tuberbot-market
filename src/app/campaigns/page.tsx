import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, ShieldIcon } from "@/components/icons";
import { publicCampaigns } from "@/lib/campaign-data";
export const metadata: Metadata = { title: "광고 캠페인", description: "캠페인 초안과 협업 기록을 만들고 샘플 구성을 확인하세요.", alternates: { canonical: "/campaigns" }, robots: { index: false, follow: false } };
export default function CampaignsPage() {
  return <div className="campaign-page page-shell"><div className="campaign-page__head"><div><h1>광고 캠페인</h1><p>직접 캠페인을 작성하거나 아래 샘플 구성을 참고하세요. 샘플은 실제 모집 공고가 아닙니다.</p></div><Link className="button" href="/workspace">내 캠페인 작성</Link></div><div className="campaign-list">{publicCampaigns.map((item) => <article key={item.id}><div className="campaign-list__body"><span>{item.brand} · {item.category}</span><h2><Link href={`/campaigns/${item.id}`}>{item.title}</Link></h2><dl><div><dt>예산</dt><dd>{item.budget}</dd></div><div><dt>광고 형식</dt><dd>{item.format}</dd></div><div><dt>게시 희망일</dt><dd>샘플 일정 · {item.date}</dd></div></dl><p><ShieldIcon /> 샘플 데이터 · 실제 지원 불가</p></div><Link className="button button--secondary" href={`/campaigns/${item.id}`}>샘플 상세 보기</Link></article>)}</div><aside className="campaign-note"><CheckIcon /><div><strong>실제로 입력하고 보관하는 협업 기록</strong><p>워크스페이스에서 내 제안 조건, 검수 이력, 계약 검토본과 정산 준비 기록을 작성할 수 있습니다. 검토 모드이며 상대방 전송·실제 청구는 없습니다.</p></div></aside></div>;
}
