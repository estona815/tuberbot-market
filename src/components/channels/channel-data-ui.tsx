"use client";
import Link from "next/link";
import { CHANNEL_RETENTION_MS, displayYouTubeCount, type ChannelRecord } from "@/domain/channel-snapshot";
import { useChannelCatalog, refreshChannelCatalog } from "./use-channel-catalog";
import s from "./channel-data.module.css";
/** Pure projection using the shared external-store clock, advanced only by events. */
export function usableRecord(record: ChannelRecord | undefined, nowMs: number) {
  if (!record) return undefined;
  const age = nowMs - Date.parse(record.observedAt);
  if (record.state === "AVAILABLE" && (age >= CHANNEL_RETENTION_MS || age < -60_000)) return { ...record, state: "EXPIRED" as const, data: null };
  return record;
}
export function checkedTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}
export function ChannelRecordLabel({ record }: { record?: ChannelRecord }) {
  const { nowMs } = useChannelCatalog();
  const safe = usableRecord(record, nowMs);
  if (!safe) return <span className={s.stamp}>보관 자료 · 2026.08.02 확인</span>;
  const delayed = nowMs - Date.parse(safe.observedAt) >= 24 * 60 * 60_000;
  return <span className={s.stamp} data-testid="channel-checked-at">YouTube · {checkedTime(safe.observedAt)} 확인 (KST){safe.state === "EXPIRED" ? " · 정보 만료" : safe.state === "UNAVAILABLE" ? " · 조회 불가" : delayed ? " · 갱신 지연" : ""}</span>;
}
export function ChannelUpdateNotice() {
  const { catalog, loading, failed } = useChannelCatalog();
  const text = !catalog ? loading ? "채널 정보 확인 중" : "보관 자료 표시" : !catalog.configured ? "보관 자료 표시 · 자동 갱신 연결 대기" : catalog.lastCompleteAt ? `전체 갱신 ${checkedTime(catalog.lastCompleteAt)} (KST)${catalog.status === "DEGRADED" || failed ? " · 재확인 대기" : ""}` : "첫 데이터 갱신 대기";
  return <p className={s.notice}><span>{text}</span><Link href="/data-status">업데이트 안내</Link></p>;
}
/** Callers pass a retention-filtered record. Missing API data never silently becomes zero. */
export function apiMetric(record: ChannelRecord | undefined, name: "subscriberCount" | "videoCount" | "viewCount", archived: number | null): string {
  if (!record) return archived === null ? "자료 없음" : archived.toLocaleString("ko-KR");
  if (record.state !== "AVAILABLE" || !record.data) return "정보 확인 대기";
  return displayYouTubeCount(record.data[name]);
}
export function ChannelDataStatusPage() {
  const { catalog, loading, failed } = useChannelCatalog();
  return <div className={`page-shell ${s.page}`}><h1>채널 데이터 업데이트</h1>
    <p>기존에 등록된 채널을 YouTube 공식 API로 확인합니다. 새 채널 발굴, 섭외 확정, 예상 광고비 계산과는 별개입니다.</p>
    <section className={s.panel} aria-label="자동 갱신 상태">
      <h2>{failed ? "데이터 연결 확인 필요" : !catalog ? "연결 상태 확인 중" : !catalog.configured ? "운영 API 키 등록 대기" : catalog.status === "READY" ? "자동 갱신 연결됨" : catalog.status === "DEGRADED" ? "갱신 재시도 대기" : "첫 갱신 확인 대기"}</h2>
      {catalog && !catalog.configured && <p>수집·저장·화면 반영 코드는 배포되어 있지만, 키 연결 전에는 기존 보관 자료를 최신 데이터로 표시하지 않습니다.</p>}
      <dl>
        <div><dt>전체 갱신 일정</dt><dd>매일 03:10 (한국시간)</dd></div>
        <div><dt>화면 조회 시 재확인</dt><dd>마지막 확인으로부터 6시간 이상 경과 시</dd></div>
        <div><dt>등록 채널</dt><dd>{catalog?.registeredCount ?? "확인 중"}</dd></div>
        <div><dt>마지막 전체 갱신 성공</dt><dd>{catalog?.lastCompleteAt ? `${checkedTime(catalog.lastCompleteAt)} (KST)` : "아직 없음"}</dd></div>
        <div><dt>마지막 수집 시도</dt><dd>{catalog?.lastAttemptAt ? `${checkedTime(catalog.lastAttemptAt)} (KST)` : "아직 없음"}</dd></div>
        <div><dt>다음 예약</dt><dd>{catalog?.nextScheduledAt ? `${checkedTime(catalog.nextScheduledAt)} (KST)` : "확인 중"}</dd></div>
      </dl>
      {catalog?.lastError && <p role="status">현재 상태: {catalog.lastError}. 기존 정보의 확인 시각은 바뀌지 않습니다.</p>}
      {failed && <p role="status">정보 연결을 확인하지 못했습니다. 표시된 값을 최신 정보로 간주하지 마세요.</p>}
      <button className="button button--secondary" type="button" disabled={loading} onClick={() => void refreshChannelCatalog()}>{loading ? "확인 중…" : "연결 상태 다시 확인"}</button>
    </section>
    <h2>제공하는 데이터</h2><p>채널명, 프로필 이미지, 공개 구독자 수, 공개 영상 수, 누적 조회수와 확인 시각을 제공합니다. 구독자 수는 YouTube의 공개 표시 정밀도를 따르며, 비공개·미제공 수치를 임의로 추정하지 않습니다. 캐시된 데이터이므로 초 단위 실시간 지표는 아닙니다.</p>
    <h2>보관·삭제와 출처</h2><p>YouTube API에서 가져온 정보는 서버 캐시에 저장하며 29일 동안 갱신하지 못하면 이름·이미지·수치를 제거합니다. 실패한 조회로 확인 날짜를 새로 만들지 않습니다. 브라우저에는 API 수치를 영구 저장하지 않으며, 관심 목록에는 등록된 채널 ID만 저장합니다. 기존 보관 자료는 별도 출처로 구분합니다.</p>
    <p>API 정보를 이용하는 기능에는 <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube 이용약관</a> 및 <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google 개인정보처리방침</a>이 적용됩니다. 공개 데이터 삭제·정정 요청은 <a href="mailto:kwonj0815@gmail.com">kwonj0815@gmail.com</a>으로 보내세요. 본 서비스는 YouTube 비밀번호나 크리에이터 계정 로그인을 수집하지 않습니다.</p>
    <Link className="button" href="/search">채널 목록으로</Link>
  </div>;
}
