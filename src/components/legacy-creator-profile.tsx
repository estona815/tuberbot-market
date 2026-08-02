import Image from "next/image";
import Link from "next/link";
import { ShieldIcon } from "@/components/icons";
import { StatusLabel } from "@/components/status-label";
import {
  formatCreatorCount,
  formatLegacyKrw,
  type LegacyCreator,
} from "@/lib/creator-data";

export function LegacyCreatorProfile({ creator }: { creator: LegacyCreator }) {
  const provenance = creator.priceProvenance;

  return (
    <div className="creator-profile page-shell">
      <section className="creator-profile__hero">
        {creator.imageUrl ? (
          <Image
            alt={`${creator.name} 원본 채널 썸네일`}
            className="creator-avatar"
            height={120}
            src={creator.imageUrl}
            unoptimized
            width={120}
          />
        ) : (
          <div className="creator-avatar" aria-hidden="true">{creator.name.slice(0, 1)}</div>
        )}
        <div>
          <h1>{creator.name}</h1>
          <p>{creator.handle ?? creator.youtubeId} · {creator.categories.length > 0 ? creator.categories.join(" · ") : "원본 검색 목록"}</p>
          <div className="status-row">
            <StatusLabel tone="info">DISCOVERY ONLY</StatusLabel>
            <StatusLabel tone="warning">UNCLAIMED · 거래 불가</StatusLabel>
          </div>
        </div>
        <div className="creator-profile__actions">
          <button className="button" disabled type="button">광고 제안 불가</button>
          <Link className="button button--quiet" href="/search">목록으로</Link>
        </div>
      </section>

      <section className="trust-facts" aria-label="원본 공개 채널 정보">
        <div><strong>구독자</strong><span>{formatCreatorCount(creator.subscriberCount)}</span></div>
        <div><strong>영상</strong><span>{formatCreatorCount(creator.videoCount)}</span></div>
        <div><strong>누적 조회수</strong><span>{formatCreatorCount(creator.viewCount)}</span></div>
        <div><strong>원본 수정일</strong><span>{creator.lastEditedOnKst ?? "원본 미표시"}</span></div>
      </section>

      <section className="creator-profile__packages" aria-labelledby="legacy-price-heading">
        <h2 id="legacy-price-heading">원본 사이트 가격 보존값</h2>
        {provenance.access === "PUBLIC_AT_SOURCE" ? (
          <div className="empty-state">
            <h3>예상 광고 단가 {formatLegacyKrw(provenance.legacyEstimatedPriceKrw)}</h3>
            <p>예상 CPV {provenance.legacyEstimatedCpv} /회 · 2026-08-02 KST 원본 사이트 확인</p>
            <p>과거 공개 표시값이며 현재 거래 견적이 아닙니다.</p>
          </div>
        ) : (
          <div className="empty-state">
            <h3>로그인하여 보기</h3>
            <p>원본 검색 화면이 가격과 CPV를 로그인 뒤에만 표시해 값을 수집하지 않았습니다.</p>
          </div>
        )}
      </section>

      <section className="profile-policy">
        <ShieldIcon />
        <div>
          <h2>레거시 탐색 자료 · 거래 불가</h2>
          <p>
            이 정보는 기존 탐색 경로를 보존하기 위해 원본 사이트 공개 화면에서 옮긴 자료입니다.
            채널 소유자 확인, 판매자 확인, 가격 산식 감사 또는 현재 유효성을 뜻하지 않으며 주문·결제에 사용할 수 없습니다.
            {creator.sourceContactLabel ? " 원본의 ‘연락가능’ 문구 역시 검증 상태가 아닙니다." : ""}
          </p>
          <p><a href={provenance.sourceUrl} rel="noreferrer" target="_blank">원본 출처 보기</a> · YouTube ID {creator.youtubeId}</p>
        </div>
      </section>
    </div>
  );
}
