"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { BookmarkIcon, CloseIcon, FilterIcon, InfoIcon, SearchIcon } from "@/components/icons";
import { PackageMedia } from "@/components/package-media";
import { StatusLabel } from "@/components/status-label";
import { formatKrw, type MarketplacePackage } from "@/lib/market-data";

type MarketExplorerProps = {
  items: MarketplacePackage[];
  initialCategory?: string;
  initialFormat?: string;
  initialQuery?: string;
};

export function MarketExplorer({ items, initialCategory = "전체", initialFormat = "전체", initialQuery = "" }: MarketExplorerProps) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState(initialCategory);
  const [format, setFormat] = useState(initialFormat);
  const [sort, setSort] = useState("RECOMMENDED");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());

  const filtered = useMemo(() => {
    const normalized = deferredQuery.trim().toLocaleLowerCase("ko-KR");
    const matches = items.filter((item) => {
      const matchesQuery = !normalized || [item.creatorName, item.title, item.category].some((value) => value.toLocaleLowerCase("ko-KR").includes(normalized));
      const matchesCategory = category === "전체" || item.category === category;
      const matchesFormat = format === "전체" || item.format === format;
      return matchesQuery && matchesCategory && matchesFormat && (!availableOnly || item.available);
    });
    if (sort === "RECOMMENDED") return matches;
    return [...matches].sort((left, right) => {
      if (sort === "PRICE_ASC") return left.priceKrw < right.priceKrw ? -1 : left.priceKrw > right.priceKrw ? 1 : 0;
      if (sort === "LEAD_TIME_ASC") return left.leadTimeDays - right.leadTimeDays;
      return 0;
    });
  }, [availableOnly, category, deferredQuery, format, items, sort]);

  function toggleSaved(id: string) {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const filterContent = (
    <>
      <fieldset className="filter-group">
        <legend>카테고리</legend>
        {["전체", "IT·테크", "뷰티", "라이프스타일"].map((value) => (
          <label key={value}><input checked={category === value} name="category" onChange={() => setCategory(value)} type="radio" /> {value}</label>
        ))}
      </fieldset>
      <fieldset className="filter-group">
        <legend>광고 형식</legend>
        {([[
          "전체", "전체",
        ], ["15초 Shorts", "SHORTS"], ["롱폼 통합 광고", "LONGFORM_INTEGRATION"], ["브랜드 UGC 제작", "UGC"]] as const).map(([label, value]) => (
          <label key={value}><input checked={format === value} name="format" onChange={() => setFormat(value)} type="radio" /> {label}</label>
        ))}
      </fieldset>
      <fieldset className="filter-group">
        <legend>거래 상태</legend>
        <label><input checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} type="checkbox" /> 거래 가능한 상품만 보기 (현재 없음)</label>
      </fieldset>
      <button className="button button--quiet button--full button--small" onClick={() => { setCategory("전체"); setFormat("전체"); setAvailableOnly(false); }} type="button">필터 초기화</button>
    </>
  );

  return (
    <div className="market-page">
      <section className="market-heading">
        <div><h1>광고 상품 구성 미리보기</h1><p>화면 검수를 위한 샘플 데이터입니다. 실제 유튜버·인증·예약·거래 정보가 아닙니다.</p></div>
        <label className="search-control market-search"><SearchIcon /><span className="sr-only">광고 상품 검색</span><input onChange={(event) => setQuery(event.target.value)} placeholder="채널명, 카테고리, 광고 형식을 검색하세요" value={query} /></label>
      </section>

      <div className="market-commandbar">
        <nav aria-label="검색 대상" className="market-tabs">
          <span aria-current="page" className="is-active">광고 상품</span>
          <Link href="/search">유튜버</Link>
        </nav>
        <button className="filter-trigger" onClick={() => setFilterOpen(true)} type="button"><FilterIcon /> 필터 <span>{Number(availableOnly) + Number(category !== "전체") + Number(format !== "전체")}</span></button>
        <select aria-label="정렬" className="select-control" onChange={(event) => setSort(event.target.value)} value={sort}><option value="RECOMMENDED">추천순</option><option value="PRICE_ASC">낮은 가격순</option><option value="LEAD_TIME_ASC">빠른 제작순</option></select>
      </div>

      <div className="market-layout">
        <aside className="filter-rail" aria-label="광고 상품 필터"><h2><FilterIcon /> 필터</h2>{filterContent}<Link className="legacy-link" href="/search">기존 유튜버 목록 보기</Link></aside>
        <section className="market-results" aria-live="polite">
          <div className="result-summary">
            <div>{availableOnly ? <button className="active-filter" onClick={() => setAvailableOnly(false)} type="button">거래 가능 <CloseIcon size={15} /></button> : null}</div>
            <div><h2>샘플 상품 {filtered.length}개</h2><p><InfoIcon size={16} /> 제품 프리뷰 · 실제 거래 불가 · 예상 광고 단가와 CPV 비공개</p></div>
          </div>

          <div aria-busy={query !== deferredQuery} className="result-list">
            {filtered.map((item, index) => (
              <article className={`market-result ${index === 0 ? "is-recommended" : ""}`} key={item.id}>
                <PackageMedia item={item} priority={index === 0} />
                <div className="market-result__body">
                  <div className="market-result__identity">
                    <div><span>{item.creatorName}</span><div className="status-row"><StatusLabel tone="info">샘플 프로필</StatusLabel><StatusLabel tone="warning">거래 불가</StatusLabel></div></div>
                    <button aria-label={`${item.title} ${saved.has(item.id) ? "찜 취소" : "찜"}`} aria-pressed={saved.has(item.id)} className="icon-button" onClick={() => toggleSaved(item.id)} type="button"><BookmarkIcon filled={saved.has(item.id)} /></button>
                  </div>
                  <h3><Link href={`/packages/${item.id}`}>{item.title}</Link></h3>
                  <dl className="condition-grid">
                    <div><dt>광고 형식</dt><dd>{item.format === "SHORTS" ? "15초 Shorts" : item.format === "UGC" ? "브랜드 UGC 제작" : "롱폼 통합 광고"}</dd></div>
                    <div><dt>제작 기간</dt><dd>{item.leadTimeDays}일 이내</dd></div>
                    <div><dt>사용권</dt><dd>{item.usageRight}</dd></div>
                    <div><dt>거래 상태</dt><dd>제품 프리뷰</dd></div>
                  </dl>
                  {index === 0 ? <p className="recommendation-reason">☆ {item.reason}</p> : null}
                </div>
                <div className="market-result__action"><strong>예시 {formatKrw(item.priceKrw)}</strong><span>샘플 제작 조건</span><Link className="button" href="/deal-demo">거래 흐름 데모</Link></div>
              </article>
            ))}
            {filtered.length === 0 ? <div className="empty-state"><h3>조건에 맞는 상품이 없습니다.</h3><p>검색어나 필터를 조정해 보세요.</p></div> : null}
          </div>
        </section>
      </div>

      {filterOpen ? (
        <div className="filter-drawer" role="dialog" aria-modal="true" aria-labelledby="filter-drawer-title">
          <button aria-label="필터 닫기" className="filter-drawer__backdrop" onClick={() => setFilterOpen(false)} type="button" />
          <div className="filter-drawer__panel"><div className="filter-drawer__head"><h2 id="filter-drawer-title">필터</h2><button aria-label="필터 닫기" className="icon-button" onClick={() => setFilterOpen(false)} type="button"><CloseIcon /></button></div>{filterContent}<button className="button button--full" onClick={() => setFilterOpen(false)} type="button">{filtered.length}개 상품 보기</button></div>
        </div>
      ) : null}
    </div>
  );
}
