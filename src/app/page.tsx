import Link from "next/link";
import { ArrowIcon, BookmarkIcon, ContractIcon, LockIcon, MessageIcon, SearchIcon, ShieldIcon, UploadIcon } from "@/components/icons";
import { PackageMedia } from "@/components/package-media";
import { formatKrw, marketplacePackages } from "@/lib/market-data";

const progress = ["제안", "계약", "샌드박스 결제", "제작", "승인"];

export default function HomePage() {
  return (
    <>
      <section className="home-hero">
        <div className="home-hero__copy">
          <h1>유튜브 광고 거래 흐름을, 검색부터 콘텐츠 검수까지 미리보기.</h1>
          <p className="home-hero__lead">샘플 데이터로 채널 탐색, 조건 협상, 계약 기록과 콘텐츠 검수 화면을 확인하세요.</p>
          <div className="home-hero__actions">
            <Link className="button" href="/market">상품 화면 미리보기</Link>
            <Link className="button button--secondary" href="/campaigns/new">캠페인 화면 미리보기</Link>
          </div>
          <Link className="creator-link" href="/for-creators">
            <span>유튜버 화면 미리보기</span><ArrowIcon />
          </Link>
          <p className="protection-note"><ShieldIcon /> 샘플 데이터 기반 제품 프리뷰 · 실제 거래 불가</p>
        </div>

        <div className="proposal-preview" aria-label="구조화된 광고 제안 미리보기">
          <div className="proposal-preview__progress">
            {progress.map((step, index) => (
              <div className={`progress-step ${index === 0 ? "is-active" : ""}`} key={step}>
                <span className="progress-step__dot">{index + 1}</span><span>{step}</span>
              </div>
            ))}
          </div>
          <div className="proposal-preview__body">
            <div className="proposal-list">
              <div className="proposal-list__head"><span>제안 목록</span><small>내 제안</small></div>
              {marketplacePackages.map((item, index) => (
                <div className={`proposal-choice ${index === 0 ? "is-selected" : ""}`} key={item.id}>
                  <div><strong>{item.title}</strong><small>샘플 프로필 · {item.category}</small><b>예시 {formatKrw(item.priceKrw)}</b></div>
                  <BookmarkIcon size={16} />
                </div>
              ))}
            </div>
            <div className="proposal-detail">
              <div className="proposal-detail__head"><h2>15초 Shorts 제품 소개</h2><BookmarkIcon /></div>
              <dl className="detail-list">
                <dt>채널명</dt><dd>하루상점</dd>
                <dt>광고 형식</dt><dd>YouTube Shorts · 15초 이내</dd>
                <dt>제공 내역</dt><dd>스크립트 기획, 촬영, 편집</dd>
                <dt>납기</dt><dd>계약 후 5일 이내</dd>
                <dt>수정 제공</dt><dd>1회</dd>
                <dt>사용권</dt><dd>유튜버 채널 게시</dd>
              </dl>
              <div className="proposal-detail__footer"><Link className="button button--quiet button--small" href="/packages/pkg_shorts_intro">샘플 상세</Link><Link className="button button--small" href="/packages/pkg_shorts_intro#proposal">제안 화면 보기</Link></div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-search-band" aria-label="광고 상품 검색">
        <form className="home-search-band__inner" action="/market">
          <label className="search-control"><SearchIcon /><span className="sr-only">광고 상품 검색</span><input name="q" placeholder="채널명, 카테고리, 광고 형식을 검색하세요" /></label>
          <select className="select-control" aria-label="카테고리" name="category"><option>카테고리</option><option>라이프스타일</option><option>IT·테크</option><option>뷰티</option></select>
          <select className="select-control" aria-label="광고 형식" name="format"><option>광고 형식</option><option>Shorts</option><option>롱폼 통합</option><option>UGC</option></select>
          <button className="button button--small" type="submit">검색</button>
        </form>
      </section>

      <section className="home-packages">
        <div className="home-packages__head"><h2>샘플 광고 상품 구성</h2><Link href="/market">제품 프리뷰 전체 보기 <ArrowIcon size={16} /></Link></div>
        <div className="package-rail">
          {marketplacePackages.map((item, index) => (
            <Link className="package-card" href={`/packages/${item.id}`} key={item.id}>
              <PackageMedia item={item} priority={index === 0} />
              <div className="package-card__content">
                <span className="package-card__creator">{item.creatorName}</span>
                <h3>{item.title}</h3>
                <span className="package-card__meta">샘플 조건 · {item.leadTimeDays}일 · 수정 {item.revisionCount}회</span>
                <span className="package-card__price">예시 {formatKrw(item.priceKrw)}<BookmarkIcon size={18} /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="workflow-band">
        <div className="workflow-band__inner">
          <h2>튜버봇이 준비 중인 광고 집행 흐름</h2>
          <div className="workflow-list">
            <div className="workflow-item"><SearchIcon size={28} /><strong>채널 검색 및 제안</strong><p>샘플 조건을 통해 검색과 제안 화면 구조를 미리 확인합니다.</p></div>
            <div className="workflow-item"><ContractIcon size={28} /><strong>계약 및 기록 관리</strong><p>전자 제안과 이력 관리의 예정 흐름을 보여줍니다.</p></div>
            <div className="workflow-item"><LockIcon size={28} /><strong>샌드박스 결제</strong><p>실제 계약 전 결제 흐름과 보호 조건을 테스트합니다.</p></div>
            <div className="workflow-item"><UploadIcon size={28} /><strong>콘텐츠 검수</strong><p>완성본 승인과 수정 요청을 기록하도록 설계한 프리뷰입니다.</p></div>
            <div className="workflow-item"><MessageIcon size={28} /><strong>정산 및 내역 관리</strong><p>운영 PG 연결 전에는 실제 결제와 정산을 제공하지 않습니다.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}
