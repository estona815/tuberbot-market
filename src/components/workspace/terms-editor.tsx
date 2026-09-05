"use client";
import { AD_TYPES, type Terms } from "@/domain/workspace";
import s from "./workspace.module.css";
export const USAGE_LABELS = { CHANNEL_ONLY: "크리에이터 채널 게시만", BRAND_ORGANIC: "브랜드 자체 채널 재사용", PAID_MEDIA: "유료 광고 소재 사용" } as const;
export function emptyTerms(): Terms {
  const date = new Date(); date.setUTCDate(date.getUTCDate() + 30);
  return { title: "", brand: "", category: "", adType: "PPL", amountKrw: "", deliverable: "", deadline: date.toISOString().slice(0, 10), revisionLimit: 1, usage: "CHANNEL_ONLY", usageDays: 30, taxBasis: "EXCLUDED" };
}
export function TermsEditor({ value, onChange, disabled }: { value: Terms; onChange: (value: Terms) => void; disabled: boolean }) {
  const set = <K extends keyof Terms>(key: K, next: Terms[K]) => onChange({ ...value, [key]: next });
  return <fieldset className={s.fields} disabled={disabled}>
    <legend className="sr-only">캠페인 조건</legend>
    <label>캠페인명<input maxLength={100} value={value.title} onChange={(e) => set("title", e.target.value)} placeholder="예: 가을 신제품 소개" /></label>
    <div className={s.pair}>
      <label>브랜드<input maxLength={80} value={value.brand} onChange={(e) => set("brand", e.target.value)} /></label>
      <label>카테고리<input maxLength={40} value={value.category} onChange={(e) => set("category", e.target.value)} /></label>
    </div>
    <div className={s.pair}>
      <label>광고 유형<select value={value.adType} onChange={(e) => set("adType", e.target.value as Terms["adType"])}>{Object.entries(AD_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>제안 금액 · 원<input inputMode="numeric" maxLength={13} value={value.amountKrw} onChange={(e) => set("amountKrw", e.target.value.replaceAll(",", ""))} placeholder="직접 정한 금액" /></label>
    </div>
    <label>제작물·수량<input maxLength={240} value={value.deliverable} onChange={(e) => set("deliverable", e.target.value)} placeholder="예: 60초 쇼츠 1편, 제품 사용 장면 포함" /></label>
    <div className={s.pair}>
      <label>납기<input type="date" value={value.deadline} onChange={(e) => set("deadline", e.target.value)} /></label>
      <label>수정 한도 · 회<input type="number" min={0} max={10} value={value.revisionLimit} onChange={(e) => set("revisionLimit", Number(e.target.value))} /></label>
    </div>
    <label>2차 사용 범위<select value={value.usage} onChange={(e) => set("usage", e.target.value as Terms["usage"])}>{Object.entries(USAGE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <div className={s.pair}>
      <label>사용 기간 · 일<input type="number" min={1} max={3650} value={value.usageDays} onChange={(e) => set("usageDays", Number(e.target.value))} /></label>
      <label>부가세 기준<select value={value.taxBasis} onChange={(e) => set("taxBasis", e.target.value as Terms["taxBasis"])}><option value="EXCLUDED">별도</option><option value="INCLUDED">포함</option></select></label>
    </div>
  </fieldset>;
}
