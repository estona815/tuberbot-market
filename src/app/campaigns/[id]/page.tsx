import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarIcon, CheckIcon, ContractIcon, ShieldIcon } from "@/components/icons";
import { publicCampaigns } from "@/lib/campaign-data";

type CampaignProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: CampaignProps): Promise<Metadata> {
  const { id } = await params;
  const campaign = publicCampaigns.find((item) => item.id === id);
  return campaign
    ? {
        title: `${campaign.title} 샘플`,
        description: "실제 모집 공고가 아닌 캠페인 화면 검수용 샘플입니다.",
        alternates: { canonical: `/campaigns/${id}` },
        robots: { index: false, follow: false },
      }
    : { title: "캠페인을 찾을 수 없음", robots: { index: false } };
}

export default async function CampaignDetailPage({ params }: CampaignProps) {
  const { id } = await params;
  const campaign = publicCampaigns.find((item) => item.id === id);
  if (!campaign) notFound();
  return (
    <div className="campaign-detail page-shell">
      <header>
        <p>샘플 캠페인 · 모집하지 않음</p>
        <h1>{campaign.title}</h1>
        <span>{campaign.objective} 아래 조건은 화면 검수용 예시입니다.</span>
      </header>
      <div className="campaign-detail__layout">
        <main>
          <section>
            <h2>캠페인 조건</h2>
            <dl className="package-specs"><div><dt>예산</dt><dd>{campaign.budget}</dd></div><div><dt>콘텐츠 형식</dt><dd>{campaign.format}</dd></div><div><dt>게시 희망일</dt><dd>{campaign.date}</dd></div><div><dt>모집 방식</dt><dd>샘플 공개 지원 구조 · 현재 지원 불가</dd></div></dl>
          </section>
          <section>
            <h2>제출 범위</h2>
            <ul>{campaign.deliverables.map((item) => <li key={item}><CheckIcon /> {item}</li>)}</ul>
          </section>
          <aside><ShieldIcon /><p>브랜드명·예산·일정·제출 범위는 모두 샘플 데이터입니다. 실제 광고주, 모집 공고 또는 거래 가능 상태를 의미하지 않습니다.</p></aside>
        </main>
        <aside className="campaign-apply">
          <ContractIcon size={30} />
          <h2>지원 화면 프리뷰</h2>
          <p>향후 희망 금액, 제작 일정, 수정 범위와 사용권 조건을 제안 버전으로 남기도록 설계합니다.</p>
          <button className="button button--full" disabled type="button">지원 기능 준비 중</button>
          <span><CalendarIcon /> 샘플 일정 {campaign.date}</span>
        </aside>
      </div>
    </div>
  );
}
