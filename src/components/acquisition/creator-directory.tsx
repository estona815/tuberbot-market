"use client";
import Link from "next/link";
import Image from "next/image";
import { useDeferredValue, useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { legacyCreators, type LegacyCreator } from "@/lib/creator-data";
import { useShortlist } from "./use-shortlist";
import s from "./presentation.module.css";
export function Avatar({ creator }: { creator: LegacyCreator }) {
  const [failed,setFailed] = useState(false);
  return <span className={s.avatar}>{creator.imageUrl && !failed ? <Image alt="" width={64} height={64} src={creator.imageUrl} unoptimized onError={() => setFailed(true)} /> : <span aria-hidden="true">{creator.name.slice(0,1)}</span>}</span>;
}
const subscriberLabel = (value: number) => value >= 10000 ? `${(Math.round(value/1000)/10).toLocaleString("ko-KR")}만` : value.toLocaleString("ko-KR");
function Bookmark() {
  return <svg aria-hidden="true" width="17" height="19" viewBox="0 0 20 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 2h10a1.5 1.5 0 0 1 1.5 1.5V20L10 16l-6.5 4V3.5A1.5 1.5 0 0 1 5 2Z" /></svg>;
}
export function CreatorTile({ creator }: { creator: LegacyCreator }) {
  const shortlist = useShortlist();
  const saved = shortlist.ids.includes(creator.legacyId);
  return <article className={s.creatorCard}><button type="button" className={s.saveButton} aria-label={`${creator.name} 관심 채널 ${saved ? "저장 해제" : "저장"}`} aria-pressed={saved} onClick={() => shortlist.toggle(creator.legacyId)}><Bookmark /></button>
    <div className={s.creatorHead}><Avatar creator={creator} /><div><h3><Link href={`/channel/${creator.legacyId}`}>{creator.name}</Link></h3><p>{creator.categories.length ? creator.categories.join(" · ") : "분야 정보 미등록"}</p></div></div>
    <div className={s.creatorStats}><span>구독자 기록</span><strong>{subscriberLabel(creator.subscriberCount)}명</strong></div>
    <div className={s.actions}><Link className={s.secondary} href={`/channel/${creator.legacyId}`}>채널 자세히</Link><Link className={s.primary} href={`/inquiry?channel=${encodeURIComponent(creator.legacyId)}`}>문의에 담기</Link></div>
    {shortlist.error && <p role="status" className={s.cardFeedback}>{shortlist.error}</p>}
  </article>;
}
export function CustomerDirectory({ initialQuery="" }: { initialQuery?: string }) {
  const [query,setQuery] = useState(initialQuery), [category,setCategory] = useState("전체"), [sort,setSort] = useState("default");
  const shortlist = useShortlist();
  const [savedOnly,setSavedOnly] = useState(false);
  const deferred = useDeferredValue(query.trim().toLocaleLowerCase("ko-KR"));
  const categories = ["전체",...new Set(legacyCreators.flatMap((creator) => [...creator.categories]))];
  const matches = useMemo(() => {
    const data = legacyCreators.filter((creator) => (!savedOnly || shortlist.ids.includes(creator.legacyId)) && (category === "전체" || creator.categories.includes(category)) && [creator.name,creator.handle ?? "",creator.youtubeId,...creator.categories].some((value) => value.toLocaleLowerCase("ko-KR").includes(deferred)));
    if (sort === "name") data.sort((a,b) => a.name.localeCompare(b.name,"ko"));
    if (sort === "subscribers") data.sort((a,b) => b.subscriberCount-a.subscriberCount);
    return data;
  },[deferred,category,sort,savedOnly,shortlist.ids]);
  return <div className={s.scope} data-testid="customer-directory"><div className={s.wrap}>
    <header className={s.title}><h1>브랜드에 맞는 유튜버 찾기</h1><p>채널을 둘러보고, 관심 있는 채널을 광고 문의에 담아보세요.</p></header>
    <div className={s.directoryTools}><label className={s.search}><SearchIcon size={20} /><span className="sr-only">채널 검색</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} placeholder="채널명·카테고리·YouTube ID" /></label><button type="button" className={s.shortlistFilter} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}><Bookmark />저장한 채널 {shortlist.ids.length}</button><label className={s.sort}>정렬<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="default">기본 순서</option><option value="subscribers">구독자 기록순</option><option value="name">이름순</option></select></label></div>
    <div className={s.filterRow} aria-label="분야 필터">{categories.map((value) => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div>
    <div className={s.directorySummary}><strong role="status">{matches.length}개 채널{savedOnly ? " · 저장 목록" : ""}</strong><p className={s.note}>자료 확인 2026.08.02 · 실시간 통계 아님</p></div>
    <div className={s.section} style={{ paddingTop:0 }}>
      {matches.length ? <div className={s.creatorGrid}>{matches.map((creator) => <CreatorTile key={creator.legacyId} creator={creator} />)}</div> : <div className={s.empty}><h2>일치하는 채널이 없습니다.</h2><p>검색어를 줄이거나 다른 분야로 찾아보세요.</p><button className={s.secondary} type="button" onClick={() => { setQuery(""); setCategory("전체"); setSavedOnly(false); }}>검색 조건 초기화</button></div>}
      <p className={s.note}>저장한 채널은 이 브라우저에만 보관됩니다. 이 목록은 채널 탐색 자료입니다. 제휴·입점·광고 수락을 의미하지 않습니다. 문의는 채널이 아닌 튜버봇 운영팀으로 접수됩니다.</p>
    </div>
  </div></div>;
}
export function CustomerProfile({ creator }: { creator: LegacyCreator }) {
  return <div className={s.scope}><div className={s.wrap}>
    <div className={s.title}><Link className={s.textLink} href="/search">← 채널 목록으로</Link></div>
    <header className={s.profileHead}><Avatar creator={creator} /><div><h1>{creator.name}</h1><p>{creator.handle ?? creator.youtubeId}</p><p>{creator.categories.join(" · ") || "분야 정보 미등록"}</p></div></header>
    <dl className={s.profileStats}>{[["구독자 기록",creator.subscriberCount],["영상 수 기록",creator.videoCount],["조회수 기록",creator.viewCount]].map(([label,value]) => <div key={String(label)}><dt>{label}</dt><dd>{typeof value === "number" ? value.toLocaleString("ko-KR") : "자료 없음"}</dd></div>)}</dl>
    <div className={s.profileCopy}><h2>이 채널로 캠페인을 준비하고 있나요?</h2><p>관심 채널과 브랜드 목표를 함께 문의에 남겨 주세요. 콘텐츠 형식별 예산은 별도 계산 도구에서 기획 조건에 맞춰 확인할 수 있습니다.</p><div className={s.actions}><Link className={s.primary} href={`/inquiry?channel=${encodeURIComponent(creator.legacyId)}`}>이 채널을 담아 문의</Link><a className={s.secondary} href={`https://www.youtube.com/channel/${creator.youtubeId}`} rel="noopener noreferrer" target="_blank">YouTube에서 보기 ↗</a></div><p className={s.note}>2026.08.02에 확인한 탐색 자료 기준이며, 원본 수정일은 {creator.lastEditedOnKst ?? "미표시"}입니다. 현재 통계·채널 제휴·섭외 가능 여부는 별도로 확인합니다. 채널에 문의가 자동 발송되지는 않습니다.</p><details className={s.formula}><summary>채널 자료 출처</summary><p><a className={s.textLink} href={creator.sourceListingUrl} rel="noopener noreferrer" target="_blank">기존 튜버봇의 공개 탐색 자료</a></p></details></div>
  </div></div>;
}
