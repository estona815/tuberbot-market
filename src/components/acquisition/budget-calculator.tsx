"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowIcon } from "@/components/icons";
import { budgetFromQuery, budgetQuery, budgetText, campaignBudget, CATEGORY_LABELS, DEFAULT_BUDGET, FORMAT_LABELS, USAGE_LABELS, type BudgetInput, type BudgetResult } from "@/domain/campaign-budget";
import { getLegacyCreatorById } from "@/lib/creator-data";
import { FormatIcon } from "./format-icon";
import s from "./presentation.module.css";

export const formatWon = (value: string) => BigInt(value).toLocaleString("ko-KR");
export function BudgetAmount({ result }: { result: BudgetResult }) {
  return <strong className={s.amount} data-testid="planning-amount">{formatWon(result.amountKrw)}<small>원</small></strong>;
}
export function saveText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
export function BudgetHero() {
  const [input,setInput] = useState<BudgetInput>({ ...DEFAULT_BUDGET });
  const result = campaignBudget(input);
  return <aside className={s.heroPanel} aria-label="빠른 예산 계산">
    <div className={s.panelHead}><h2>내 캠페인, 예산은 얼마나?</h2><span className={s.pill}>즉시 계산</span></div>
    <div className={s.formRow}>
      <label className={s.field}>콘텐츠 형식<select aria-label="콘텐츠 형식" value={input.format} onChange={(event) => setInput({ ...input, format: event.target.value as BudgetInput["format"] })}>{Object.entries(FORMAT_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className={s.field}>희망 채널 규모<select aria-label="희망 채널 규모" value={input.subscribers} onChange={(event) => setInput({ ...input, subscribers: Number(event.target.value) })}><option value={10000}>1만 명</option><option value={50000}>5만 명</option><option value={100000}>10만 명</option><option value={300000}>30만 명</option></select></label>
    </div>
    <div className={s.heroAmount} aria-live="polite"><span>자체 기준 예상 예산</span><BudgetAmount result={result} /><p className={s.note}>1편 · 라이프스타일 · 채널 게시만 · 부가세 별도</p></div>
    <Link className={s.primary} href={`/inquiry?${budgetQuery(input)}`}>이 예산으로 문의 <ArrowIcon size={17} /></Link>
    <p className={s.note}>초기 기획을 위한 가정값으로, 특정 채널의 판매가가 아닙니다.</p>
  </aside>;
}
export function BudgetCalculator() {
  const params = useSearchParams();
  const candidate = params.get("channel");
  const channelId = candidate && getLegacyCreatorById(candidate) ? candidate : null;
  const withChannel = (query: string) => query + (channelId ? `&channel=${encodeURIComponent(channelId)}` : "");
  const [input,setInput] = useState<BudgetInput>(() => budgetFromQuery(new URLSearchParams(params.toString())));
  const [size,setSize] = useState(String(input.subscribers));
  const [notice,setNotice] = useState("");
  const validSize = /^\d{1,7}$/u.test(size) && Number(size) <= 1_000_000;
  const result = validSize ? campaignBudget({ ...input, subscribers: Number(size) }) : null;
  function set<K extends keyof BudgetInput>(field: K, value: BudgetInput[K]) { setNotice(""); setInput((old) => ({ ...old, [field]: value })); }
  async function copy() {
    if (!result) return;
    try { const url = `${window.location.origin}${window.location.hash ? "/#" : ""}/budget?${withChannel(budgetQuery(result.input))}`; await navigator.clipboard.writeText(url); setNotice("현재 조건의 링크를 복사했습니다."); }
    catch { setNotice("클립보드 사용이 차단되어 있습니다. 기획안을 파일로 보관하세요."); }
  }
  return <div className={s.scope} data-testid="budget-page"><div className={s.wrap}>
    <header className={s.title}><nav className={s.breadcrumb} aria-label="현재 위치"><Link href="/">홈</Link><ArrowIcon /><span>예산 계산</span></nav><h1>광고 예산, 바로 계산해 보세요.</h1><p>콘텐츠 형식과 희망 채널 규모를 정하면 기획 예산이 바로 바뀝니다.</p></header>
    <div className={s.budgetLayout}>
      <section className={s.config} aria-label="예산 조건"><h2>어떤 캠페인을 준비하시나요?</h2>
        <div className={s.formatOptions} aria-label="콘텐츠 형식">{Object.entries(FORMAT_LABELS).map(([key,label]) => <button key={key} type="button" aria-pressed={input.format === key} onClick={() => set("format",key as BudgetInput["format"])}><FormatIcon format={key as BudgetInput["format"]} size={25} />{label}</button>)}</div>
        <label className={s.field}>브랜드 분야<select aria-label="브랜드 분야" value={input.category} onChange={(event) => set("category",event.target.value as BudgetInput["category"])}>{Object.entries(CATEGORY_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <div className={s.formRow}>
          <label className={s.field}>희망 채널 규모 · 명<input aria-label="희망 채널 규모 · 명" value={size} inputMode="numeric" maxLength={9} onChange={(event) => { setSize(event.target.value.replaceAll(",","")); setNotice(""); }} aria-invalid={!validSize} aria-describedby="budget-size-help" /></label>
          <label className={s.field}>콘텐츠 수량<select aria-label="콘텐츠 수량" value={input.quantity} onChange={(event) => set("quantity",Number(event.target.value))}>{Array.from({ length:10 },(_,index) => <option key={index} value={index + 1}>{index + 1}편</option>)}</select></label>
        </div>
        <p className={s.note} id="budget-size-help">0~100만 명을 입력하세요. 특정 채널의 현재 구독자 수가 아니라 직접 정하는 기획 조건입니다.</p>
        <label className={s.field}>콘텐츠 사용 범위<select aria-label="콘텐츠 사용 범위" value={input.usage} onChange={(event) => set("usage",event.target.value as BudgetInput["usage"])}>{Object.entries(USAGE_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <details className={s.formula}><summary>산정 기준 보기</summary><p>모델: planning-2026-09-v1. 초기 예산 기획용으로 직접 정한 a·b에 분야, 사용 범위, 수량을 반영합니다. 시장 거래 자료나 YouTube API 통계에서 학습한 가격이 아닙니다.</p>{result && <p>기본식: ({result.baseA} × {size} + {formatWon(result.baseB)}) × 분야 {result.categoryFactor} × 사용 범위 {result.usageFactor} × {input.quantity}편. 원 단위 반올림.</p>}<p>단순 기획 계산에는 배송비·출장비·독점 조건·수정 횟수·사용권 기간에 따른 추가 비용을 넣지 않았습니다. 문의 내용에 필요한 범위를 적어 주세요.</p></details>
        <p className={s.note}>직접 a·b를 입력하거나 거래 자료로 보정하려면 <Link className={s.textLink} href="/rate-studio">상세 계산 도구</Link>를 이용하세요.</p>
      </section>
      <aside className={s.result} aria-label="기획 예산 결과" aria-live="polite">
        {result ? <><h2>자체 기준 예상 예산</h2><BudgetAmount result={result} /><p className={s.note}>부가세 별도 · {FORMAT_LABELS[input.format]} {input.quantity}편</p><dl className={s.resultFacts}><div><dt>기획 여유범위 ±20%</dt><dd>{formatWon(result.lowerKrw)}~{formatWon(result.upperKrw)}원</dd></div><div><dt>부가세</dt><dd>{formatWon(result.vatKrw)}원</dd></div><div><dt>부가세 포함</dt><dd>{formatWon(result.totalWithVatKrw)}원</dd></div></dl><Link className={s.primary} href={`/inquiry?${withChannel(budgetQuery(result.input))}`}>이 조건으로 광고 문의 <ArrowIcon size={17} /></Link><button type="button" className={s.secondary} onClick={() => saveText("튜버봇_예산기획안.txt",budgetText(result))}>예산 기획안 받기</button><button type="button" className={s.textLink} onClick={() => void copy()}>조건 링크 복사</button><p className={s.note}>{result.disclaimer} ±20%는 임의의 여유율이며 통계적 예측구간이 아닙니다.</p></> : <p className={s.error} role="alert">희망 규모를 0~1,000,000 사이의 정수로 입력하세요.</p>}
        {notice && <p className={s.notice} role="status">{notice}</p>}
      </aside>
    </div>
  </div>{result && <aside className={s.mobileBudgetBar} aria-label="모바일 예산 요약"><div><span>자체 기준 예상 예산 · 부가세 별도</span><strong>{formatWon(result.amountKrw)}원</strong></div><Link className={s.primary} href={`/inquiry?${withChannel(budgetQuery(result.input))}`}>이 예산으로 문의</Link></aside>}</div>;
}
