import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookmarkIcon, ShieldIcon } from "@/components/icons";
import { PackageMedia } from "@/components/package-media";
import { StatusLabel } from "@/components/status-label";
import { formatKrw, marketplacePackages } from "@/lib/market-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = marketplacePackages.find((entry) => entry.creatorSlug === slug);
  return item
    ? {
        title: `${item.creatorName} 샘플 프로필`,
        description: "실제 채널 인증이나 거래 정보가 아닌 샘플 유튜버 프로필입니다.",
        alternates: { canonical: `/creators/${slug}` },
        robots: { index: false, follow: false },
      }
    : { title: "유튜버를 찾을 수 없음", robots: { index: false } };
}

export default async function CreatorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = marketplacePackages.find((entry) => entry.creatorSlug === slug);
  if (!item) notFound();
  return (
    <div className="creator-profile page-shell">
      <section className="creator-profile__hero">
        <div className="creator-avatar">{item.creatorName.slice(0, 1)}</div>
        <div><h1>{item.creatorName}</h1><p>{item.category} 샘플 프로필</p><div className="status-row"><StatusLabel tone="info">제품 프리뷰</StatusLabel><StatusLabel tone="warning">미인증 · 거래 불가</StatusLabel></div></div>
        <div className="creator-profile__actions"><button className="button" disabled type="button">광고 제안 준비 중</button><button className="button button--quiet" disabled type="button">찜 기능 준비 중</button></div>
      </section>
      <section className="trust-facts" aria-label="샘플 프로필 상태"><div><strong>응답 시간</strong><span>실데이터 없음</span></div><div><strong>거래 완료</strong><span>실데이터 없음</span></div><div><strong>후기</strong><span>기능 준비 중</span></div><div><strong>최근 활동</strong><span>실데이터 연결 전</span></div></section>
      <section className="creator-profile__packages"><h2>샘플 광고 상품 구성</h2><Link className="package-card" href={`/packages/${item.id}`}><PackageMedia item={item} priority /><div className="package-card__content"><span className="package-card__creator">샘플 프로필 · {item.creatorName}</span><h3>{item.title}</h3><span className="package-card__meta">샘플 조건 · {item.leadTimeDays}일 · 수정 {item.revisionCount}회</span><span className="package-card__price">예시 {formatKrw(item.priceKrw)}<BookmarkIcon size={18} /></span></div></Link></section>
      <section className="profile-policy"><ShieldIcon /><div><h2>제품 프리뷰 안내</h2><p>이 프로필과 상품 조건은 화면 검수용 샘플입니다. 실제 채널 인증, 판매자 확인, 거래 이력 또는 예약 가능 상태를 의미하지 않습니다.</p></div></section>
    </div>
  );
}
