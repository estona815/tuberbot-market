import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarIcon, CheckIcon, ShieldIcon } from "@/components/icons";
import { PackageMedia } from "@/components/package-media";
import { StatusLabel } from "@/components/status-label";
import { formatKrw, marketplacePackages } from "@/lib/market-data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = marketplacePackages.find((entry) => entry.id === id);
  if (!item) return { title: "광고 상품을 찾을 수 없음", robots: { index: false } };
  return {
    title: `${item.title} 샘플`,
    description: "실제 등록 상품이 아닌 튜버봇 상품 화면 검수용 샘플입니다.",
    alternates: { canonical: `/packages/${item.id}` },
    robots: { index: false, follow: false },
  };
}

export default async function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = marketplacePackages.find((entry) => entry.id === id);
  if (!item) notFound();
  return (
    <div className="package-detail page-shell">
      <div className="package-detail__media"><PackageMedia item={item} priority /></div>
      <section className="package-detail__main">
        <p className="package-detail__creator"><Link href={`/creators/${item.creatorSlug}`}>샘플 프로필 · {item.creatorName}</Link></p>
        <h1>{item.title}</h1>
        <div className="status-row"><StatusLabel tone="info">샘플 상품</StatusLabel><StatusLabel tone="warning">미인증 · 거래 불가</StatusLabel></div>
        <p className="package-detail__description">화면 검수를 위한 샘플 상품 구성입니다. 표시된 가격·일정·사용권은 실제 유튜버가 등록한 거래 조건이 아닙니다.</p>
        <dl className="package-specs"><div><dt>광고 형식</dt><dd>{item.format === "SHORTS" ? "YouTube Shorts" : item.format === "UGC" ? "브랜드 UGC" : "롱폼 통합 광고"}</dd></div><div><dt>제작 기간</dt><dd>{item.leadTimeDays}일 이내</dd></div><div><dt>수정 횟수</dt><dd>{item.revisionCount}회</dd></div><div><dt>기본 사용권</dt><dd>{item.usageRight}</dd></div><div><dt>제품 배송</dt><dd>제안에서 협의</dd></div><div><dt>게시 유지</dt><dd>계약에서 확정</dd></div></dl>
      </section>
      <aside className="package-detail__purchase" id="proposal"><span>예시 시작 가격</span><strong>{formatKrw(item.priceKrw)}</strong><p><CalendarIcon /> 샘플 제작 조건 · {item.leadTimeDays}일</p><Link className="button button--full" href="/deal-demo">거래 흐름 데모 보기</Link><button className="button button--quiet" disabled type="button">찜 기능 준비 중</button><small><ShieldIcon /> 샘플 데이터 기반 제품 프리뷰 · 실제 거래 및 결제 불가</small></aside>
      <section className="package-detail__terms"><h2>포함 내용</h2><ul><li><CheckIcon /> 광고 브리프 확인과 구조화된 조건 합의</li><li><CheckIcon /> 계약 스냅샷과 변경 이력 보존</li><li><CheckIcon /> 초안 제출 및 계약된 수정 횟수 내 검수</li><li><CheckIcon /> 게시 URL과 광고 표시 체크리스트 기록</li></ul><h2>별도 협의가 필요한 권리</h2><p>브랜드 SNS 재게시, 유료 광고 소재 사용, 편집·자막·더빙, 해외 사용과 독점은 기본 사용권에 포함되지 않습니다.</p></section>
    </div>
  );
}
