import Image from "next/image";
import Link from "next/link";
import {
  ArrowIcon,
  ContractIcon,
  LockIcon,
  MessageIcon,
  SearchIcon,
  ShieldIcon,
  UploadIcon,
} from "@/components/icons";
import {
  featuredLegacyCreators,
  formatCreatorCount,
  formatLegacyKrw,
} from "@/lib/creator-data";

const dealStages = [
  { label: "제안", detail: "광고주가 금액·납기·사용권을 제안합니다.", icon: MessageIcon },
  { label: "역제안", detail: "유튜버가 같은 항목으로 조건을 답합니다.", icon: ArrowIcon },
  { label: "계약", detail: "양측이 동일한 버전을 각각 수락합니다.", icon: ContractIcon },
  { label: "샌드박스 결제", detail: "외부 PG 승인 전에는 실제 청구가 없습니다.", icon: LockIcon },
  { label: "제작·검수", detail: "초안, 수정, 승인과 게시 기록을 남깁니다.", icon: UploadIcon },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="home-v2">
        <div className="home-v2__copy">
          <p className="home-v2__eyebrow">CREATOR COMMERCE · KOREA</p>
          <h1>유튜버를 찾고,<br />조건을 합의하고,<br />제작까지 한곳에서.</h1>
          <p className="home-v2__lead">
            원래 튜버봇의 채널 탐색은 그대로 살리고, 제안·역제안·계약·콘텐츠 검수를 하나의 기록으로 연결했습니다.
          </p>

          <form action="/search" className="home-v2__search">
            <SearchIcon size={22} />
            <label className="sr-only" htmlFor="home-creator-search">유튜버 검색</label>
            <input id="home-creator-search" name="q" placeholder="채널명, 카테고리, 키워드로 검색" />
            <button aria-label="유튜버 검색" type="submit"><ArrowIcon /></button>
          </form>

          <div className="home-v2__paths">
            <Link className="home-path home-path--primary" href="/search">
              <span><SearchIcon size={26} /></span>
              <div><strong>유튜버 탐색</strong><small>원본 채널 정보와 출처 확인</small></div>
              <ArrowIcon />
            </Link>
            <Link className="home-path" href="/market">
              <span><ContractIcon size={26} /></span>
              <div><strong>광고 상품</strong><small>유튜버 확정 단가 상품만 분리</small></div>
              <ArrowIcon />
            </Link>
          </div>

          <p className="home-v2__boundary"><ShieldIcon size={18} /> 공개 결제는 샌드박스 · 실제 청구와 지급 없음</p>
        </div>

        <aside className="home-deal-card" aria-label="광고 거래 흐름 미리보기">
          <div className="home-deal-card__head">
            <div><p>거래 흐름</p><h2>조건이 바뀔 때마다<br />기록이 남습니다.</h2></div>
            <span>SANDBOX</span>
          </div>
          <ol className="home-deal-card__steps">
            {dealStages.map(({ label, detail, icon: Icon }, index) => (
              <li key={label}>
                <span className="home-deal-card__icon"><Icon size={20} /></span>
                <div><strong>{label}</strong><small>{detail}</small></div>
                <b>{String(index + 1).padStart(2, "0")}</b>
              </li>
            ))}
          </ol>
          <div className="home-deal-card__foot">
            <p><LockIcon size={16} /> 실제 상대방·결제사와 연결되지 않는 공개 데모입니다.</p>
            <Link href="/deal-demo">전체 흐름 체험 <ArrowIcon size={17} /></Link>
          </div>
        </aside>
      </section>

      <section className="legacy-restore">
        <header className="legacy-restore__head">
          <div><p>ORIGINAL DATA RESTORED</p><h2>처음 제공된 유튜버 정보를 복원했습니다.</h2></div>
          <Link href="/search">전체 유튜버 보기 <ArrowIcon size={17} /></Link>
        </header>

        <div className="legacy-restore__list">
          {featuredLegacyCreators.map((creator) => {
            const price = creator.priceProvenance.access === "PUBLIC_AT_SOURCE"
              ? formatLegacyKrw(creator.priceProvenance.legacyEstimatedPriceKrw)
              : "원본에서 로그인 필요";
            return (
              <Link className="legacy-restore__row" href={`/channel/${creator.legacyId}`} key={creator.legacyId}>
                <div className="legacy-restore__identity">
                  {creator.imageUrl ? <Image alt={`${creator.name} 채널 이미지`} height={56} src={creator.imageUrl} unoptimized width={56} /> : null}
                  <div><strong>{creator.name}</strong><span>DISCOVERY ONLY · 미입점</span></div>
                </div>
                <div className="legacy-restore__category"><small>카테고리</small><span>{creator.categories.join(" · ")}</span></div>
                <div><small>구독자</small><strong>{formatCreatorCount(creator.subscriberCount)}</strong></div>
                <div className="legacy-restore__price"><small>원본 예상 광고 단가</small><strong>{price}</strong></div>
                <div className="legacy-restore__source"><small>원본 공개값 확인</small><span>2026.08.02 · 거래가 아님</span></div>
                <ArrowIcon />
              </Link>
            );
          })}
        </div>

        <p className="legacy-restore__notice">
          <ShieldIcon size={20} />
          위 금액은 원본 사이트가 “예상 광고 단가”로 공개한 과거 표시값을 읽기 전용으로 보존한 것입니다. 유튜버가 직접 확정한 판매가가 아니며, 채널 소유·판매자 인증과 상품 단가 확인 전에는 제안·결제가 열리지 않습니다.
        </p>
      </section>

      <section className="home-demo-band">
        <div>
          <p>WORKING PRODUCT DEMO</p>
          <h2>사장님께 보여줄 수 있게,<br />거래 전 과정을 직접 눌러보세요.</h2>
        </div>
        <div className="home-demo-band__facts">
          <span>제안 v1 → 역제안 v2</span>
          <span>양측 개별 수락 → 계약 해시</span>
          <span>간편결제 선택 → 샌드박스 승인</span>
          <span>초안 → 수정 → 승인 → 정산 차단</span>
        </div>
        <Link className="button" href="/deal-demo">거래 데모 시작 <ArrowIcon /></Link>
      </section>
    </>
  );
}
