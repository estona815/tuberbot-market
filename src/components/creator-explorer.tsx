"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { StatusLabel } from "@/components/status-label";
import {
  formatCreatorCount,
  formatLegacyKrw,
  legacyCreators,
} from "@/lib/creator-data";
import styles from "./creator-explorer.module.css";

function normalizeQuery(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR");
}

export function CreatorExplorer({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const filteredCreators = useMemo(() => {
    const normalizedQuery = normalizeQuery(deferredQuery);
    if (!normalizedQuery) return legacyCreators;

    return legacyCreators.filter((creator) => [
      creator.name,
      creator.handle ?? "",
      creator.youtubeId,
      creator.legacyId,
      ...creator.categories,
    ].some((value) => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery)));
  }, [deferredQuery]);

  return (
    <>
      <div className="legacy-search__head">
        <div><h1>기존 유튜버 아카이브</h1><p>원본 공개 화면에서 확인한 채널을 누락 없이 보존했습니다. 소유 확인 전에는 제안·주문·결제를 열지 않습니다.</p></div>
        <label className="search-control">
          <SearchIcon />
          <span className="sr-only">보존된 유튜버 검색</span>
          <input
            autoComplete="off"
            name="q"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="채널명, 카테고리 또는 YouTube ID 검색"
            type="search"
            value={query}
          />
        </label>
      </div>
      <p className="policy-callout">레거시 탐색 자료 · DISCOVERY ONLY · UNCLAIMED · 표시 가격은 과거 원본 예상값이며 현재 견적이 아닙니다.</p>
      <p aria-live="polite" className={styles.searchSummary}>
        원본 공개 화면에서 확인한 {legacyCreators.length}개 중 {filteredCreators.length}개 표시
      </p>
      {filteredCreators.length > 0 ? (
        <div className={styles.tableViewport} role="region" tabIndex={0} aria-label="유튜버 목록 가로 스크롤 영역">
          <table className={styles.table}>
            <caption className="sr-only">튜버봇 원본 사이트에서 확인한 보존 유튜버 목록</caption>
            <thead>
              <tr>
                <th scope="col">채널</th>
                <th scope="col">구독자</th>
                <th scope="col">카테고리</th>
                <th scope="col">원본 가격 표시</th>
                <th scope="col">보존 상태</th>
              </tr>
            </thead>
            <tbody>
              {filteredCreators.map((creator) => (
                <tr key={creator.legacyId}>
                  <th data-label="채널" scope="row">
                    <Link className={styles.channelLink} href={`/channel/${creator.legacyId}`}>
                      <strong>{creator.name}</strong>
                      <span>{creator.handle ?? creator.youtubeId}</span>
                    </Link>
                  </th>
                  <td data-label="구독자">{formatCreatorCount(creator.subscriberCount)}</td>
                  <td data-label="카테고리">{creator.categories.length > 0 ? creator.categories.join(" · ") : <span className={styles.muted}>검색 원본 미표시</span>}</td>
                  <td data-label="원본 가격 표시">
                    {creator.priceProvenance.access === "PUBLIC_AT_SOURCE" ? (
                      <span className={styles.price}>
                        <strong>{formatLegacyKrw(creator.priceProvenance.legacyEstimatedPriceKrw)}</strong>
                        <span className={styles.sourceNote}>2024 원본 예상값 · 견적 아님</span>
                      </span>
                    ) : (
                      <span className={styles.price}>
                        <strong>로그인하여 보기</strong>
                        <span className={styles.sourceNote}>원본 접근 제한 · 값 미수집</span>
                      </span>
                    )}
                  </td>
                  <td data-label="보존 상태">
                    <span className="status-row">
                      <StatusLabel tone="info">탐색 보존</StatusLabel>
                      <StatusLabel tone="warning">미확인 · 거래 불가</StatusLabel>
                    </span>
                    {creator.sourceContactLabel ? <span className={styles.sourceNote}>원본 ‘연락가능’ 표기 · 검증 아님</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.empty}>
          <strong>일치하는 보존 유튜버가 없습니다.</strong>
          <p>다른 채널명이나 YouTube ID로 검색해 보세요.</p>
        </div>
      )}
    </>
  );
}
