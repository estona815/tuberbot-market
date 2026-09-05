"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { z } from "zod";
import { AD_TYPES, PHASES, appendWorkspaceCommand, contractText, deriveWorkspace, exportWorkspaceFile, importWorkspaceFile, newWorkspace, type Party, type Terms, type WorkspaceAction, type WorkspaceDocument, type WorkspaceState } from "@/domain/workspace";
import { TermsEditor, emptyTerms, USAGE_LABELS } from "./terms-editor";
import s from "./workspace.module.css";
const STORAGE_KEY = "tuberbot-workspaces-v1";
const ROLE = { ADVERTISER: "광고주", CREATOR: "크리에이터" } as const;
const WON = (value: string) => `${BigInt(value).toLocaleString("ko-KR")}원`;
const EVENT = { PROPOSE: "제안", COUNTER: "역제안", ACCEPT: "개별 수락", SANDBOX_PAY: "모의 결제", SUBMIT: "제출", REVISE: "수정 요청", APPROVE: "최종 승인", PUBLISH: "게시 기록", CONFIRM: "구매 확인", DISPUTE: "분쟁 보류", MESSAGE: "메시지", CANCEL: "취소" } as const;
function download(name: string, text: string, type = "application/json;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function message(error: unknown): string {
  return error instanceof z.ZodError ? `입력 조건을 확인하세요. ${error.issues[0]?.path.join(" · ") ?? "파일 형식"}` : error instanceof Error ? error.message : "작업을 처리하지 못했습니다.";
}
function Summary({ terms }: { terms: Terms }) {
  return <dl className={s.summary}>
    <div><dt>제안 금액</dt><dd>{WON(terms.amountKrw)} <small>부가세 {terms.taxBasis === "INCLUDED" ? "포함" : "별도"}</small></dd></div>
    <div><dt>유형·카테고리</dt><dd>{AD_TYPES[terms.adType]} / {terms.category}</dd></div>
    <div><dt>제작물</dt><dd>{terms.deliverable}</dd></div>
    <div><dt>납기·수정</dt><dd>{terms.deadline} / {terms.revisionLimit}회</dd></div>
    <div><dt>사용권</dt><dd>{USAGE_LABELS[terms.usage]} / {terms.usageDays}일</dd></div>
  </dl>;
}
export function ProjectWorkspace() {
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [states, setStates] = useState<Record<string, WorkspaceState>>({});
  const [selected, setSelected] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false), stored = useRef<string | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [actor, setActor] = useState<Party>("ADVERTISER");
  const [draft, setDraft] = useState<Terms>(() => emptyTerms());
  const [comment, setComment] = useState(""), [url, setUrl] = useState(""), [reason, setReason] = useState("");
  const [disclosure, setDisclosure] = useState(false);
  const [method, setMethod] = useState<"TOSS_PAY" | "KAKAO_PAY" | "NAVER_PAY" | "CARD">("TOSS_PAY");
  const [pending, setPending] = useState<WorkspaceDocument[] | null>(null);
  const [deleteCheck, setDeleteCheck] = useState(false);
  const document = documents.find((doc) => doc.seed.id === selected);
  const state = states[selected];
  const latest = state?.proposals.at(-1);

  async function install(docs: WorkspaceDocument[], active?: string) {
    const entries = await Promise.all(docs.map(async (doc) => [doc.seed.id, await deriveWorkspace(doc)] as const));
    const map = Object.fromEntries(entries);
    setDocuments(docs); setStates(map);
    const id = active && map[active] ? active : docs[0]?.seed.id ?? "";
    setSelected(id); setDraft(map[id]?.proposals.at(-1)?.terms ?? emptyTerms());
  }
  async function reload() {
    setError("");
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      const docs = text ? await importWorkspaceFile(text) : [];
      stored.current = text; await install(docs, selected); setLoaded(true);
      setNotice("이 브라우저에 저장된 내용을 불러왔습니다.");
    } catch (caught) { setError(`${message(caught)} 기존 저장 내용은 덮어쓰지 않았습니다.`); }
  }
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const text = localStorage.getItem(STORAGE_KEY);
        const docs = text ? await importWorkspaceFile(text) : [];
        const entries = await Promise.all(docs.map(async (doc) => [doc.seed.id, await deriveWorkspace(doc)] as const));
        if (cancelled) return;
        stored.current = text; setDocuments(docs); setStates(Object.fromEntries(entries));
        setSelected(docs[0]?.seed.id ?? ""); setDraft(entries[0]?.[1].proposals.at(-1)?.terms ?? emptyTerms()); setLoaded(true);
      } catch (caught) { if (!cancelled) setError(`${message(caught)} 저장 공간 접근 또는 파일 복구가 필요합니다. 기존 데이터는 유지했습니다.`); }
    })();
    const changed = (event: StorageEvent) => { if (event.key === STORAGE_KEY) setError("다른 탭에서 기록이 바뀌었습니다. ‘저장 내용 새로고침’으로 동기화하세요."); };
    window.addEventListener("storage", changed);
    return () => { cancelled = true; window.removeEventListener("storage", changed); };
  }, []);

  async function persist(docs: WorkspaceDocument[], active?: string) {
    if (docs.length > 30) throw new Error("작업은 최대 30개입니다. 보관 파일을 받은 뒤 사용하지 않는 작업을 삭제하세요.");
    // Compute and validate before touching persistent data. Failed imports do not erase existing work.
    const text = exportWorkspaceFile(docs);
    await importWorkspaceFile(text);
    if (localStorage.getItem(STORAGE_KEY) !== stored.current) throw new Error("다른 탭의 변경이 있습니다. 저장 내용 새로고침 후 다시 진행하세요.");
    localStorage.setItem(STORAGE_KEY, text); stored.current = text;
    await install(docs, active); setNotice("이 브라우저에 저장했습니다. 상대방에게 전송하거나 실제 결제를 실행하지 않았습니다.");
  }
  async function task(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await fn(); } catch (caught) { setError(message(caught)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function create(sample = false) {
    await task(async () => {
      const doc = newWorkspace({ id: crypto.randomUUID(), mode: "LOCAL_REVIEW", createdAt: new Date().toISOString(), advertiserLabel: "검토용 광고주", creatorLabel: "검토용 크리에이터", feeBps: 1200 });
      await persist([doc, ...documents], doc.seed.id); setActor("ADVERTISER");
      if (sample) setDraft({ ...emptyTerms(), title: "가상 브랜드 신제품 캠페인", brand: "가상 브랜드", category: "라이프스타일", adType: "PPL", amountKrw: "1000000", deliverable: "60초 쇼츠 1편 · 제품 사용 장면 포함" });
    });
  }
  async function act(action: WorkspaceAction) {
    if (!document || !state) return;
    await task(async () => {
      const result = await appendWorkspaceCommand(document, { key: crypto.randomUUID(), expectedRevision: state.revision, actor, action, at: new Date().toISOString() });
      await persist(documents.map((doc) => doc.seed.id === selected ? result.document : doc), selected);
      setComment(""); setReason(""); setUrl(""); setDisclosure(false);
    });
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    await task(async () => {
      if (file.size > 2_000_000) throw new Error("파일은 2 MB 이하여야 합니다.");
      const docs = await importWorkspaceFile(await file.text()); setPending(docs);
    });
  }
  function select(doc: WorkspaceDocument) {
    setSelected(doc.seed.id); setDraft(states[doc.seed.id]?.proposals.at(-1)?.terms ?? emptyTerms());
    setError(""); setNotice(""); setComment(""); setReason(""); setUrl(""); setDisclosure(false); setDeleteCheck(false);
  }
  const nextActor: Party = !state || ["DRAFT", "CONTRACTED", "REVIEW", "PUBLISHED", "SETTLEMENT_READY"].includes(state.phase) ? "ADVERTISER" : "CREATOR";

  return <div className={`page-shell ${s.workspace}`} data-testid="project-workspace">
    <header className={s.heading}><div><h1>광고 협업 워크스페이스</h1><p>조건을 정하고, 버전을 합의하고, 제작의 끝까지 기록하세요.</p></div><Link className="button button--secondary button--small" href="/launch">운영 연결 현황</Link></header>
    <div className={s.mode}><strong>검토 모드</strong><span>이 브라우저에만 저장됩니다. 역할 전환은 체험용이며 상대방 전송·실제 계약·청구·지급은 없습니다. 개인정보와 실제 기밀은 입력하지 마세요.</span></div>
    <div className={s.toolbar}>
      <button className="button button--small" disabled={busy || !loaded} onClick={() => void create()} type="button">새 캠페인</button>
      <button className="button button--secondary button--small" disabled={busy || !documents.length} onClick={() => download("tuberbot-workspaces.json", exportWorkspaceFile(documents))} type="button">작업 파일 받기</button>
      <label className={s.fileButton}>작업 파일 가져오기<input type="file" accept=".json,application/json" disabled={busy || !loaded} onChange={(event) => void importFile(event)} /></label>
      <button className={s.textButton} disabled={busy} onClick={() => void task(reload)} type="button">저장 내용 새로고침</button>
    </div>
    {error && <p role="alert" className={s.error}>{error}</p>}
    {notice && <p role="status" className={s.notice}>{notice}</p>}
    {pending && <section className={s.importConfirm}><h2>{pending.length}개 작업을 확인했습니다.</h2><p>가져오기를 확정하면 현재 브라우저의 {documents.length}개 작업 전체를 교체합니다. 필요한 기록은 먼저 ‘작업 파일 받기’로 보관하세요.</p><div className={s.actions}><button className="button" disabled={busy} type="button" onClick={() => void task(async () => { await persist(pending); setPending(null); })}>확인 후 교체</button><button className="button button--secondary" type="button" onClick={() => setPending(null)}>가져오기 취소</button></div></section>}
    {!loaded && !error && <p role="status">저장된 작업을 확인하고 있습니다.</p>}
    {loaded && documents.length === 0 ? <section className={s.empty}><span className={s.emptyMark} aria-hidden="true">01</span><h2>첫 캠페인부터 시작하세요.</h2><p>직접 조건을 쓰거나 가상 캠페인으로 제안부터 정산 준비까지 체험할 수 있습니다.<br />거래마다 금액·납기·사용권·수정 횟수가 하나의 버전으로 묶입니다.</p><div className={s.actions}><button className="button" type="button" disabled={busy} onClick={() => void create()}>캠페인 직접 작성</button><button className="button button--secondary" type="button" disabled={busy} onClick={() => void create(true)}>가상 캠페인으로 체험</button></div><Link href="/search">먼저 유튜버 탐색하기 →</Link></section> : null}
    {document && state && <div className={s.layout}>
      <aside className={s.sidebar} aria-label="캠페인 목록"><h2>내 작업 <span>{documents.length}</span></h2>{documents.map((doc) => <button type="button" key={doc.seed.id} disabled={busy} onClick={() => select(doc)} aria-pressed={doc.seed.id === selected} className={s.project}><strong>{states[doc.seed.id]?.proposals.at(-1)?.terms.title ?? "새 캠페인 초안"}</strong><span>{PHASES[states[doc.seed.id]?.phase ?? "DRAFT"]}{states[doc.seed.id]?.hold ? " · 분쟁 보류" : ""}</span></button>)}<p>저장 데이터는 계정 간 동기화되지 않습니다. 같은 기기·브라우저에서 이어서 작업하거나 파일로 옮기세요.</p></aside>
      <article className={s.main}>
        <header className={s.projectHeader}><div><span className={s.phase}>{PHASES[state.phase]}</span><h2>{latest?.terms.title ?? "새 캠페인 초안"}</h2><p>기록 {state.revision}개 · 조건 {state.proposals.length}개 버전</p></div><div className={s.roleSwitch} aria-label="체험 역할">{(["ADVERTISER", "CREATOR"] as const).map((role) => <button key={role} type="button" disabled={busy} aria-pressed={actor === role} onClick={() => setActor(role)}>{ROLE[role]}</button>)}<small>실제 로그인 역할 아님</small></div></header>
        {state.hold && <div role="status" className={s.error}><strong>분쟁 보류</strong><p>{state.hold}</p><span>진행·정산은 중단되었습니다. 이 체험 화면에서는 보류를 해제하지 않습니다.</span></div>}
        <div className={s.columns}>
          <section className={s.flow} aria-label="현재 단계 작업">
            {!state.hold && state.phase === "DRAFT" && <form noValidate onSubmit={(e) => { e.preventDefault(); void act({ type: "PROPOSE", terms: draft }); }}><h3>광고주 제안 작성</h3><TermsEditor value={draft} onChange={setDraft} disabled={busy} /><p className={s.helper}>금액은 직접 입력한 제안입니다. 시장 예상 단가를 자동 적용하지 않습니다.</p><button className="button" type="submit" disabled={busy || actor !== "ADVERTISER"}>제안 보내기</button></form>}
            {!state.hold && state.phase === "NEGOTIATING" && latest && <>
              <h3>조건 v{latest.version} · {ROLE[latest.author]} 제안</h3><Summary terms={latest.terms} />
              <div className={s.acceptance}>{(["ADVERTISER", "CREATOR"] as const).map((role) => <span key={role}>{ROLE[role]} {latest.accepted.includes(role) ? "수락 완료" : "수락 대기"}</span>)}</div>
              <button className="button" type="button" disabled={busy || latest.accepted.includes(actor)} onClick={() => void act({ type: "ACCEPT", version: latest.version })}>{ROLE[actor]}가 v{latest.version} 수락</button>
              {actor !== latest.author && <details className={s.details}><summary>조건을 바꿔 역제안하기</summary><form noValidate onSubmit={(e) => { e.preventDefault(); void act({ type: "COUNTER", terms: draft }); }}><TermsEditor value={draft} onChange={setDraft} disabled={busy} /><p className={s.helper}>역제안하면 양측이 새 버전을 다시 수락해야 합니다.</p><button className="button button--secondary" disabled={busy} type="submit">역제안 보내기</button></form></details>}
            </>}
            {!state.hold && state.phase === "CONTRACTED" && <><h3>계약 합의 완료</h3><p className={s.helper}>양측이 동일한 버전을 수락했습니다. 다음은 실제 청구 없는 결제 흐름 확인입니다.</p><label className={s.label}>모의 결제 수단<select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}><option value="TOSS_PAY">토스페이</option><option value="KAKAO_PAY">카카오페이</option><option value="NAVER_PAY">네이버페이</option><option value="CARD">카드</option></select></label><p className={s.helper}>실제 결제사 창을 열지 않으며 결제 정보를 받지 않습니다.</p><button className="button" type="button" disabled={busy || actor !== "ADVERTISER"} onClick={() => void act({ type: "SANDBOX_PAY", method })}>실제 청구 없이 결제 단계 확인</button></>}
            {!state.hold && ["FUNDED", "REVISION"].includes(state.phase) && <><h3>{state.phase === "REVISION" ? "수정본 제출" : "초안 제출"}</h3><label className={s.label}>제출 설명<textarea maxLength={1500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="반영한 요구사항과 확인할 내용을 적으세요." /></label><label className={s.label}>검토용 HTTPS 링크 · 선택<input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." maxLength={2048} /></label><p className={s.helper}>파일은 업로드하지 않습니다. 공유 권한을 확인한 링크만 기록하세요.</p><button className="button" type="button" disabled={busy || actor !== "CREATOR"} onClick={() => void act({ type: "SUBMIT", note: comment, url })}>검수 요청</button></>}
            {!state.hold && state.phase === "REVIEW" && <><h3>콘텐츠 검수</h3><div className={s.delivery}><strong>제출본 {state.deliveries.length}</strong><p>{state.deliveries.at(-1)?.note}</p>{state.deliveries.at(-1)?.url && <a href={state.deliveries.at(-1)?.url} target="_blank" rel="noopener noreferrer">제출 링크 열기 ↗</a>}</div><label className={s.check}><input type="checkbox" checked={disclosure} onChange={(e) => setDisclosure(e.target.checked)} />제작물과 광고 표시를 확인했습니다.</label><button className="button" type="button" disabled={busy || actor !== "ADVERTISER" || !disclosure} onClick={() => void act({ type: "APPROVE", disclosureChecked: true })}>최종 승인</button><details className={s.details}><summary>수정 요청 · {state.revisionCount}/{state.contract?.terms.revisionLimit}회 사용</summary><label className={s.label}>수정 요청 사항<textarea maxLength={1500} value={reason} onChange={(e) => setReason(e.target.value)} /></label><button className="button button--secondary" type="button" disabled={busy || actor !== "ADVERTISER" || state.revisionCount >= (state.contract?.terms.revisionLimit ?? 0)} onClick={() => void act({ type: "REVISE", note: reason })}>수정 요청 보내기</button></details></>}
            {!state.hold && state.phase === "APPROVED" && <><h3>게시 완료 기록</h3><p className={s.helper}>YouTube에 게시하는 기능이 아니라, 게시한 영상의 링크를 기록하는 단계입니다. URL 존재 여부는 자동 검증하지 않습니다.</p><label className={s.label}>게시한 YouTube URL<input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={2048} placeholder="https://www.youtube.com/watch?v=..." /></label><button className="button" type="button" disabled={busy || actor !== "CREATOR"} onClick={() => void act({ type: "PUBLISH", url })}>게시 링크 기록</button></>}
            {!state.hold && state.phase === "PUBLISHED" && <><h3>광고주 최종 확인</h3><a className={s.external} href={state.publicationUrl ?? undefined} target="_blank" rel="noopener noreferrer">게시 영상 확인 ↗</a><p className={s.helper}>게시 상태를 직접 확인한 뒤 구매 확인 기록을 남기세요. 이 버튼은 실제 지급을 실행하지 않습니다.</p><button className="button" type="button" disabled={busy || actor !== "ADVERTISER"} onClick={() => void act({ type: "CONFIRM" })}>구매 확인 · 정산 준비</button></>}
            {state.phase === "SETTLEMENT_READY" && <><h3>정산 준비까지 기록했습니다.</h3><p className={s.helper}>합의 금액과 수수료 가정을 고정해 정산 검토 자료를 만듭니다. 판매자 확인·PG 계약·세무 검토·대사 완료 전에는 지급할 수 없습니다.</p><div className={s.blocked}>실제 지급 비활성화{state.hold ? " · 분쟁 보류" : ""}</div><button className="button button--secondary" type="button" onClick={() => download("tuberbot-settlement-review.txt", contractText(document, state), "text/plain;charset=utf-8")}>정산 검토자료 받기</button></>}
            {state.phase === "CANCELLED" && <><h3>취소된 작업입니다.</h3><p className={s.helper}>기존 버전과 기록은 남아 있습니다. 새 캠페인에서 다시 시작할 수 있습니다.</p></>}
            {!state.hold && !["NEGOTIATING", "SETTLEMENT_READY", "CANCELLED"].includes(state.phase) && actor !== nextActor && <p className={s.helper}>다음 작업은 {ROLE[nextActor]} 역할입니다. <button type="button" className={s.textButton} onClick={() => setActor(nextActor)}>{ROLE[nextActor]}로 전환</button></p>}
          </section>
          <aside className={s.contract} aria-label="계약 스냅샷"><span>CONTRACT RECORD</span><h3>{state.contract ? `합의된 계약 v${state.contract.version}` : "양측 수락 후 계약 고정"}</h3>{state.contract ? <><Summary terms={state.contract.terms} /><dl className={s.summary}><div><dt>수수료 가정 {state.contract.feeBps / 100}%</dt><dd>{WON(state.contract.feeKrw)}</dd></div><div><dt>공제 후 참고 금액</dt><dd>{WON(state.contract.creatorKrw)}</dd></div></dl><p className={s.helper}>세무 조정 전 단순 가정입니다. 실제 정산액이 아닙니다.</p><details><summary>내용 해시 SHA-256</summary><code>{state.contract.sha256}</code><p>내용 변경 확인용 해시입니다. 전자서명이나 본인인증 증명이 아닙니다.</p></details><button type="button" className="button button--secondary button--small" onClick={() => download("tuberbot-contract-review.txt", contractText(document, state), "text/plain;charset=utf-8")}>계약 검토본 받기</button></> : <p>금액·납기·제작물·수정 횟수·사용권을 같은 버전으로 합의해야 합니다. 조건 변경 시 양측 수락이 초기화됩니다.</p>}</aside>
        </div>
        <section className={s.history}><h3>조건 버전</h3>{state.proposals.length === 0 ? <p className={s.helper}>제안을 보내면 버전이 생성됩니다.</p> : state.proposals.map((proposal) => <details key={proposal.version}><summary>v{proposal.version} · {ROLE[proposal.author]} · {WON(proposal.terms.amountKrw)}<span>{proposal.accepted.length}/2 수락</span></summary><Summary terms={proposal.terms} /></details>)}</section>
        <section className={s.history}><h3>협업 기록 <span>{state.events.length}</span></h3><div className={s.timeline}>{state.events.slice().reverse().map((event) => <article key={event.sequence}><div><strong>{EVENT[event.type]}</strong><span>{ROLE[event.actor]} · {new Date(event.at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST</span></div><p>{event.detail}</p></article>)}</div>{state.phase !== "CANCELLED" && <form onSubmit={(event) => { event.preventDefault(); void act({ type: "MESSAGE", note: comment }); }} className={s.messageForm}><label className={s.label}>메시지 기록<textarea value={comment} maxLength={1500} onChange={(e) => setComment(e.target.value)} placeholder="체험용 기록입니다. 실제 상대방에게 전송되지 않습니다." /></label><button className="button button--secondary button--small" type="submit" disabled={busy}>{ROLE[actor]} 메시지 기록</button></form>}</section>
        <footer className={s.management}>{state.contract && !state.hold && <details><summary>분쟁 사유를 남기고 진행 보류</summary><label className={s.label}>분쟁 사유<textarea maxLength={1500} value={reason} onChange={(e) => setReason(e.target.value)} /></label><p className={s.helper}>체험 작업에서도 보류 후 진행·지급은 잠깁니다.</p><button className="button button--secondary button--small" type="button" disabled={busy} onClick={() => void act({ type: "DISPUTE", note: reason })}>분쟁 보류 기록</button></details>}{["DRAFT", "NEGOTIATING"].includes(state.phase) && <button className={s.textButton} disabled={busy || actor !== "ADVERTISER"} type="button" onClick={() => void act({ type: "CANCEL", note: "광고주가 합의 전 캠페인을 취소했습니다." })}>합의 전 캠페인 취소</button>}
          {!deleteCheck ? <button type="button" className={s.textButton} onClick={() => setDeleteCheck(true)}>이 브라우저의 작업 삭제</button> : <div className={s.actions}><span>내보내지 않은 기록은 복구할 수 없습니다.</span><button type="button" className={s.textButton} disabled={busy} onClick={() => void task(async () => { await persist(documents.filter((doc) => doc.seed.id !== selected)); setDeleteCheck(false); })}>삭제 확인</button><button type="button" className={s.textButton} onClick={() => setDeleteCheck(false)}>유지</button></div>}
        </footer>
      </article>
    </div>}
  </div>;
}
