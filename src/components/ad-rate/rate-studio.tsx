"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  calibrateRules, estimateRate, exportEstimateCsv, exportRules, FORMAT_LABELS,
  FORMATS, importRules, MAX_IMPORT_BYTES, ruleKey, validateRule,
  type RateEstimate, type RateRule,
} from "@/domain/ad-rate";
import styles from "./rate-studio.module.css";

type Draft = Pick<RateRule, "category" | "format" | "a" | "bKrw" | "source">;
const EMPTY: Draft = { category: "", format: "integration", a: "", bKrw: "", source: "" };
const won = (value: string) => `${BigInt(value).toLocaleString("ko-KR")}원`;
const count = (value: string) => BigInt(value).toLocaleString("ko-KR");

function download(name: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Result({ result }: { result: RateEstimate | null }) {
  if (!result) return (
    <section className={styles.result} aria-label="산정 결과" aria-live="polite">
      <span className={styles.resultLabel}>계산 결과</span>
      <h2 className={styles.emptyTitle}>계수부터 확인하고,<br />금액은 투명하게.</h2>
      <p className={styles.resultDescription}>카테고리와 a·b를 입력하면 계산식과 근거를 함께 보여드립니다. 기본 시장 단가를 임의로 채우지 않습니다.</p>
      <div className={styles.formula}>Y = aX + b</div>
      <dl className={styles.legend}><div><dt>X</dt><dd>구독자 수</dd></div><div><dt>a</dt><dd>구독자 1명당 계수</dd></div><div><dt>b</dt><dd>카테고리·형식별 절편</dd></div></dl>
      <p className={styles.resultFootnote}>실제 광고비는 크리에이터와 별도로 협의해야 합니다.</p>
    </section>
  );
  return (
    <section className={styles.result} aria-label="산정 결과" aria-live="polite">
      <span className={styles.resultLabel}>{result.rule.category} · {FORMAT_LABELS[result.rule.format]}</span>
      <h2 className={styles.amount} data-testid="estimated-amount">{won(result.amountKrw)}</h2>
      <p className={styles.resultDescription}>입력 계수 기준 산정액 · 확정 견적 아님</p>
      {result.marginBps > 0 && <div className={styles.range}><span>직접 설정한 참고 범위 ±{result.marginBps / 100}%</span><strong>{won(result.lowerKrw)} ~ {won(result.upperKrw)}</strong></div>}
      <div className={styles.calculation}>
        <h3>계산 근거</h3>
        <p data-testid="formula">{result.rule.a} × {count(result.subscribers)} + ({count(result.rule.bKrw)})</p>
        <dl><div><dt>구독자 수 X</dt><dd>{count(result.subscribers)}명</dd></div><div><dt>계수 a</dt><dd>{result.rule.a}원 / 명</dd></div><div><dt>절편 b</dt><dd>{won(result.rule.bKrw)}</dd></div></dl>
        <p className={styles.source}><span>계수 근거</span>{result.rule.source}</p>
      </div>
      {result.rule.calibration && <p className={styles.resultFootnote}>보정 {result.rule.calibration.sampleCount}건 · 표본 범위 {count(result.rule.calibration.subscriberMin)}~{count(result.rule.calibration.subscriberMax)}명 · 학습 평균 절대 오차 {won(result.rule.calibration.trainingMaeKrw)}. 같은 자료에 대한 오차이며 미래 정확도를 뜻하지 않습니다.</p>}
      <div className={styles.warnings}>{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
      <div className={styles.exportRow}>
        <button type="button" onClick={() => download("tuberbot-calculation.json", JSON.stringify(result, null, 2), "application/json;charset=utf-8")}>결과 JSON</button>
        <button type="button" onClick={() => download("tuberbot-calculation.csv", exportEstimateCsv(result), "text/csv;charset=utf-8")}>결과 CSV</button>
        <button type="button" onClick={() => window.print()}>인쇄</button>
      </div>
      <p className={styles.resultFootnote}>부가세·수수료·2차 사용권 비용은 추가 계산하지 않습니다. 입력 자료와 동일한 금액 기준을 사용하세요.</p>
    </section>
  );
}

export function RateStudio() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [subscribers, setSubscribers] = useState("");
  const [margin, setMargin] = useState("0");
  const [rules, setRules] = useState<RateRule[]>([]);
  const [selectedCalibration, setSelectedCalibration] = useState<RateRule["calibration"]>();
  const [result, setResult] = useState<RateEstimate | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"manual" | "calibration">("manual");
  const [evidence, setEvidence] = useState("");
  const [pending, setPending] = useState<RateRule[]>([]);
  const [busy, setBusy] = useState(false);
  const importSequence = useRef(0);

  function clearFeedback() { setError(""); setNotice(""); }
  function update(field: keyof Draft, value: string) {
    clearFeedback(); setResult(null);
    if (field === "a" || field === "bKrw") setSelectedCalibration(undefined);
    if (field === "category" || field === "format") {
      const next = { ...draft, [field]: value };
      const saved = rules.find((rule) => ruleKey(rule) === ruleKey(next));
      setDraft(saved ? { category: saved.category, format: saved.format, a: saved.a, bKrw: saved.bKrw, source: saved.source } : { ...next, a: "", bKrw: "", source: "" });
      setSelectedCalibration(saved?.calibration);
    } else setDraft((current) => ({ ...current, [field]: value }));
  }
  function currentRule(): RateRule {
    return validateRule({ ...draft, updatedAt: new Date().toISOString(), ...(selectedCalibration ? { calibration: selectedCalibration } : {}) });
  }
  function calculate(event: FormEvent) {
    event.preventDefault(); clearFeedback(); setResult(null);
    try {
      if (!/^\d{1,2}$/u.test(margin) || Number(margin) > 50) throw new Error("참고 범위는 0~50%의 정수로 입력하세요.");
      setResult(estimateRate(currentRule(), subscribers, Number(margin) * 100));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "입력값을 확인하세요."); }
  }
  function mergeRules(incoming: RateRule[]) {
    const next = new Map(rules.map((rule) => [ruleKey(rule), rule]));
    for (const rule of incoming) next.set(ruleKey(rule), rule);
    if (next.size > 50) throw new Error("계수표는 최대 50개입니다. 사용하지 않는 계수를 먼저 삭제하세요.");
    setRules([...next.values()]);
  }
  function saveRule() {
    clearFeedback();
    try { mergeRules([currentRule()]); setNotice("현재 계수를 이 화면의 계수표에 저장했습니다. 파일로 내보내면 다음에도 사용할 수 있습니다."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "계수를 저장하지 못했습니다."); }
  }
  function loadRule(rule: RateRule) {
    setDraft({ category: rule.category, format: rule.format, a: rule.a, bKrw: rule.bKrw, source: rule.source });
    setSelectedCalibration(rule.calibration); setResult(null); clearFeedback(); setTab("manual");
    setNotice(`${rule.category} / ${FORMAT_LABELS[rule.format]} 계수를 불러왔습니다.`);
  }
  async function readFile(event: ChangeEvent<HTMLInputElement>, mode: "json" | "csv") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const sequence = ++importSequence.current;
    clearFeedback(); setPending([]); setBusy(true);
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("파일은 128 KB 이하여야 합니다.");
      const input = await file.text();
      const incoming = mode === "json" ? importRules(input) : calibrateRules(input, evidence);
      if (sequence !== importSequence.current) return;
      setPending(incoming); setTab("calibration");
      setNotice(`${incoming.length}개 계수를 읽었습니다. 아래 내용을 확인하고 계수표에 반영하세요.`);
    } catch (caught) {
      if (sequence === importSequence.current) setError(caught instanceof Error ? caught.message : "파일을 읽지 못했습니다.");
    } finally { if (sequence === importSequence.current) setBusy(false); }
  }
  function applyPending() {
    clearFeedback();
    try {
      mergeRules(pending); setResult(null); setPending([]);
      // Existing form coefficients remain explicit user inputs, never silently overwritten.
      setNotice("계수표에 반영했습니다. 사용할 행의 ‘불러오기’를 눌러 계산하세요.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "계수를 반영하지 못했습니다."); }
  }

  return (
    <div className={`page-shell ${styles.studio}`}>
      <header className={styles.heading}>
        <div><h1>광고비 산정 워크스페이스</h1><p>카테고리별 계수로 계산하고, 실제 거래 자료로 보정하세요.</p></div>
        <div className={styles.privacy}>이 도구는 브라우저 안에서 계산합니다.<br />입력값·거래 CSV를 서버로 전송하지 않습니다.</div>
      </header>
      <div className={styles.tabs} aria-label="계수 입력 방법">
        <button type="button" aria-pressed={tab === "manual"} onClick={() => setTab("manual")}>직접 입력</button>
        <button type="button" aria-pressed={tab === "calibration"} onClick={() => setTab("calibration")}>거래 내역으로 보정</button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      <div className={styles.workspace}>
        <div className={styles.inputPanel}>
          {tab === "manual" ? <form onSubmit={calculate} noValidate>
            <h2>산정 조건</h2>
            <p className={styles.helper}>a·b는 실제 운영 자료나 직접 정한 가정값을 입력하세요. 출처를 적어 계산 근거를 남깁니다.</p>
            <div className={styles.twoColumns}>
              <label htmlFor="rate-category">카테고리<input id="rate-category" list="rate-categories" autoComplete="off" maxLength={40} placeholder="예: 게임" value={draft.category} onChange={(event) => update("category", event.target.value)} /></label>
              <datalist id="rate-categories">{[...new Set(rules.map((rule) => rule.category))].map((category) => <option key={category} value={category} />)}</datalist>
              <label htmlFor="rate-format">광고 형식<select id="rate-format" value={draft.format} onChange={(event) => update("format", event.target.value)}>{FORMATS.map((format) => <option key={format} value={format}>{FORMAT_LABELS[format]}</option>)}</select></label>
            </div>
            <label htmlFor="rate-subscribers">구독자 수 X<input id="rate-subscribers" inputMode="numeric" maxLength={20} placeholder="예: 100,000" value={subscribers} onChange={(event) => { setSubscribers(event.target.value); setResult(null); clearFeedback(); }} /></label>
            <div className={styles.twoColumns}>
              <label htmlFor="rate-a">계수 a · 원 / 구독자 1명<input id="rate-a" inputMode="decimal" maxLength={24} placeholder="계수 입력" value={draft.a} onChange={(event) => update("a", event.target.value)} /></label>
              <label htmlFor="rate-b">절편 b · 원<input id="rate-b" inputMode="text" maxLength={20} placeholder="절편 입력" value={draft.bKrw} onChange={(event) => update("bKrw", event.target.value)} /></label>
            </div>
            <label htmlFor="rate-source">계수 근거<input id="rate-source" maxLength={240} placeholder="예: 9월 제안서 12건 / 담당자 가정값" value={draft.source} onChange={(event) => update("source", event.target.value)} /></label>
            <label htmlFor="rate-margin">참고 범위 ± %<input id="rate-margin" inputMode="numeric" maxLength={2} value={margin} onChange={(event) => { setMargin(event.target.value); setResult(null); clearFeedback(); }} aria-describedby="margin-help" /></label>
            <p id="margin-help" className={styles.helper}>0이면 범위를 표시하지 않습니다. 직접 정한 비율이며 통계적 신뢰구간이 아닙니다.</p>
            <div className={styles.actions}><button className="button" type="submit">계산하기</button><button className="button button--secondary" type="button" onClick={saveRule}>현재 계수 저장</button></div>
          </form> : <section aria-label="거래 내역 보정">
            <h2>거래 자료에서 a·b 찾기</h2>
            <p className={styles.helper}>같은 카테고리·광고 형식의 견적 또는 거래 내역으로 최소제곱 선형식을 계산합니다. 조합별로 3건 이상, 서로 다른 구독자 수가 필요합니다.</p>
            <label htmlFor="calibration-evidence">거래 자료 근거<input id="calibration-evidence" maxLength={240} placeholder="예: 2026년 3분기 계약 내역 · 부가세 별도" value={evidence} onChange={(event) => { setEvidence(event.target.value); setPending([]); clearFeedback(); }} disabled={busy} /></label>
            <label htmlFor="quote-csv">거래 CSV 불러오기<input id="quote-csv" type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => void readFile(event, "csv")} /></label>
            <div className={styles.csvSpec}><code>category,format,subscribers,priceKrw</code><p>format: integration / dedicated / shorts / other<br />통화: KRW · 구독자 수와 광고비는 정수<br />부가세·수수료·사용권 조건이 같은 자료만 사용하세요.<br />이름·이메일·연락처 열은 포함하지 마세요.</p></div>
            <button className="button button--secondary button--small" type="button" onClick={() => download("tuberbot-quotes-template.csv", "\uFEFFcategory,format,subscribers,priceKrw\r\n", "text/csv;charset=utf-8")}>빈 CSV 양식</button>
            <p className={styles.helper}>최대 128 KB · 1,000건 · 50개 조합. 숫자·열 형식·표본 조건이 맞지 않으면 전체 파일을 반영하지 않습니다.</p>
            <div className={styles.method}><h3>보정 결과를 읽는 법</h3><p>평균 절대 오차는 사용한 거래 자료에 다시 대입한 오차입니다. 미래 거래의 정확도가 아닙니다. 음수 기울기 또는 전부 같은 구독자 수는 자동 적용을 막습니다.</p></div>
            {pending.length > 0 && <div className={styles.pending}>
              <h3>반영 전 확인 · {pending.length}개</h3>
              {pending.map((rule) => <article key={ruleKey(rule)}><strong>{rule.category} / {FORMAT_LABELS[rule.format]}</strong><p>a = {rule.a} · b = {won(rule.bKrw)}</p>{rule.calibration && <p>{rule.calibration.sampleCount}건 · {count(rule.calibration.subscriberMin)}~{count(rule.calibration.subscriberMax)}명<br />학습 평균 절대 오차 {won(rule.calibration.trainingMaeKrw)}</p>}<p>근거: {rule.source}</p></article>)}
              <p className={styles.helper}>같은 카테고리·광고 형식의 저장 계수는 교체됩니다. 현재 입력 폼은 ‘불러오기’를 눌러야 바뀝니다.</p>
              <button className="button" type="button" onClick={applyPending}>확인한 계수표에 반영</button>
              <button className="button button--quiet" type="button" onClick={() => setPending([])}>취소</button>
            </div>}
          </section>}
        </div>
        <Result result={result} />
      </div>
      <section className={styles.library} aria-labelledby="rate-library-title">
        <header><div><h2 id="rate-library-title">현재 계수표 <span>{rules.length}</span></h2><p>새로고침하면 사라집니다. 계수표 파일을 보관해 다음 작업에서 불러오세요.</p></div><button className="button button--secondary button--small" type="button" disabled={rules.length === 0} onClick={() => download("tuberbot-rate-rules.json", exportRules(rules), "application/json;charset=utf-8")}>계수표 내보내기</button></header>
        {rules.length === 0 ? <div className={styles.libraryEmpty}>아직 저장된 계수가 없습니다. 직접 입력한 계수를 저장하거나 거래 CSV로 보정하세요.</div> : <div className={styles.tableWrap}><table><caption className={styles.srOnly}>카테고리별 광고비 산정 계수표</caption><thead><tr><th>카테고리 / 형식</th><th>계수 a</th><th>절편 b</th><th>근거</th><th>작업</th></tr></thead><tbody>{rules.map((rule) => <tr key={ruleKey(rule)}><td><strong>{rule.category}</strong><span>{FORMAT_LABELS[rule.format]}</span></td><td>{rule.a}</td><td>{won(rule.bKrw)}</td><td>{rule.source}</td><td><div className={styles.rowActions}><button type="button" onClick={() => loadRule(rule)} aria-label={`${rule.category} ${FORMAT_LABELS[rule.format]} 불러오기`}>불러오기</button><button type="button" onClick={() => { setRules((current) => current.filter((item) => ruleKey(item) !== ruleKey(rule))); setNotice("계수표에서 삭제했습니다. 현재 입력값은 유지됩니다."); }} aria-label={`${rule.category} ${FORMAT_LABELS[rule.format]} 삭제`}>삭제</button></div></td></tr>)}</tbody></table></div>}
        <label htmlFor="rules-json" className={styles.importLabel}>저장한 계수표 JSON 불러오기<input id="rules-json" type="file" accept=".json,application/json" disabled={busy} onChange={(event) => void readFile(event, "json")} /></label>
      </section>
      <footer className={styles.disclaimer}>이 워크스페이스는 계산·비교용 도구입니다. 실제 계약, 결제, 정산, YouTube API 조회와 연결되어 있지 않습니다. 가져온 계수와 자료의 정확성·사용 권한은 별도로 확인해야 합니다.</footer>
    </div>
  );
}
