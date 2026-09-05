"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { PHASES, contractText, deriveWorkspace, workspaceDocumentSchema, type Terms, type WorkspaceAction, type WorkspaceState } from "@/domain/workspace";
import { csrfHeader } from "./account-panel";
import { TermsEditor, emptyTerms } from "./terms-editor";
import s from "./workspace.module.css";
const projectSchema = z.object({ document: workspaceDocumentSchema, role: z.enum(["ADVERTISER", "CREATOR"]) });
const listSchema = z.object({ mode: z.literal("SERVER_SANDBOX"), userId: z.string().uuid(), projects: z.array(projectSchema).max(30), hasMore: z.boolean() });
type Entry = z.infer<typeof projectSchema> & { state: WorkspaceState };
const ROLE = { ADVERTISER: "광고주", CREATOR: "크리에이터" } as const;
async function responseBody(response: Response): Promise<unknown> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const safe = z.object({ error: z.object({ message: z.string().max(300).optional() }) }).safeParse(body);
    const fallback = response.status === 401 ? "운영 계정으로 다시 로그인하세요." : response.status === 403 ? "권한 또는 세션 확인이 필요합니다." : response.status === 409 ? "다른 변경사항이 있습니다. 최신 작업을 다시 불러오세요." : response.status === 503 ? "서버 협업 연결이 아직 준비되지 않았습니다." : response.status === 429 ? "요청이 많습니다. 잠시 후 다시 시도하세요." : "입력값과 연결 상태를 확인하세요.";
    throw new Error(safe.success && safe.data.error.message ? safe.data.error.message : fallback);
  }
  return response.json();
}
async function fetchProjects(signal?: AbortSignal) {
  const response = await fetch("/api/projects", { cache: "no-store", credentials: "same-origin", signal });
  if (response.status === 401) return { kind: "login" as const };
  if (response.status === 503) return { kind: "unconfigured" as const };
  const body = listSchema.parse(await responseBody(response));
  const entries = await Promise.all(body.projects.map(async (entry) => ({ ...entry, state: await deriveWorkspace(entry.document) })));
  return { kind: "ready" as const, body, entries };
}
function plainFile(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "tuberbot-server-contract.txt"; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ConnectedWorkspace() {
  const [entries, setEntries] = useState<Entry[]>([]), [selected, setSelected] = useState("");
  const [userId, setUserId] = useState("");
  const [phase, setPhase] = useState<"loading" | "ready" | "unconfigured" | "login">("loading");
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false), [creatorId, setCreatorId] = useState("");
  const [draft, setDraft] = useState<Terms>(() => emptyTerms());
  const [note, setNote] = useState(""), [url, setUrl] = useState("");
  const [checked, setChecked] = useState(false);
  const [method, setMethod] = useState<"TOSS_PAY" | "KAKAO_PAY" | "NAVER_PAY" | "CARD">("CARD");
  const lock = useRef(false), pending = useRef<{ signature: string; key: string; revision: number } | null>(null);
  const entry = entries.find((item) => item.document.seed.id === selected), state = entry?.state, role = entry?.role, latest = state?.proposals.at(-1);
  function apply(result: Awaited<ReturnType<typeof fetchProjects>>, active?: string) {
    setPhase(result.kind);
    if (result.kind !== "ready") return;
    const id = active && result.entries.some((item) => item.document.seed.id === active) ? active : result.entries[0]?.document.seed.id ?? "";
    setEntries(result.entries); setSelected(id); setUserId(result.body.userId);
    setDraft(result.entries.find((item) => item.document.seed.id === id)?.state.proposals.at(-1)?.terms ?? emptyTerms());
    if (result.body.hasMore) setNotice("최근 30개 작업을 표시합니다. 더 오래된 작업은 운영자가 조회해야 합니다.");
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetchProjects(controller.signal).then((result) => { if (!controller.signal.aborted) apply(result); }).catch((caught) => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "연결 오류"); });
    return () => controller.abort();
  }, []);
  async function task(fn: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await fn(); } catch (caught) { setError(caught instanceof Error ? caught.message : "요청을 처리하지 못했습니다."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function create() {
    await task(async () => {
      const creator = z.string().uuid().parse(creatorId.trim()), signature = `create:${creator}`;
      if (pending.current?.signature !== signature) pending.current = { signature, key: crypto.randomUUID(), revision: 0 };
      const response = await fetch("/api/projects", { method: "POST", credentials: "same-origin", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", "x-csrf-token": csrfHeader(), "idempotency-key": pending.current.key }, body: JSON.stringify({ creatorUserId: creator }) });
      const body = z.object({ document: workspaceDocumentSchema }).parse(await responseBody(response));
      pending.current = null; apply(await fetchProjects(),body.document.seed.id); setNotice("양측 계정에 연결된 서버 샌드박스 작업을 생성했습니다.");
    });
  }
  async function act(action: WorkspaceAction) {
    if (!entry || !state) return;
    await task(async () => {
      const signature = `${selected}:${JSON.stringify(action)}`;
      if (pending.current?.signature !== signature) pending.current = { signature, key: crypto.randomUUID(), revision: state.revision };
      const response = await fetch(`/api/projects/${selected}/commands`, { method: "POST", credentials: "same-origin", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", "x-csrf-token": csrfHeader() }, body: JSON.stringify({ key: pending.current.key, expectedRevision: pending.current.revision, action }) });
      const body = z.object({ document: workspaceDocumentSchema, replayed: z.boolean() }).parse(await responseBody(response)), next = await deriveWorkspace(body.document);
      pending.current = null; setEntries((current) => current.map((item) => item.document.seed.id === selected ? { ...item, document: body.document, state: next } : item));
      setDraft(next.proposals.at(-1)?.terms ?? emptyTerms()); setNote(""); setUrl(""); setChecked(false);
      setNotice(body.replayed ? "이미 처리된 동일 요청의 결과입니다." : "서버에 기록했습니다. 상대방은 새로고침 후 확인할 수 있습니다. 실제 청구·지급은 없습니다.");
    });
  }
  function choose(item: Entry) { setSelected(item.document.seed.id); setDraft(item.state.proposals.at(-1)?.terms ?? emptyTerms()); setNote(""); setUrl(""); setChecked(false); setError(""); setNotice(""); pending.current = null; }
  const can = (actor: "ADVERTISER" | "CREATOR", phases: string[]) => !busy && !state?.hold && role === actor && phases.includes(state?.phase ?? "");
  return <div className={`page-shell ${s.workspace}`}><header className={s.heading}><div><h1>서버 광고 협업</h1><p>로그인한 두 당사자의 계정으로 제안과 검수 기록을 공유합니다.</p></div><Link className="button button--secondary button--small" href="/account">내 계정</Link></header><div className={s.mode}><strong>서버 샌드박스</strong><span>기록은 서버에 저장되지만 결제·정산은 모의 흐름입니다. 계정 인증과 채널·판매자 인증은 별개입니다. 거래 당사자 외에는 이 작업에 접근할 수 없습니다.</span></div>{error && <p className={s.error} role="alert">{error}</p>}{notice && <p className={s.notice} role="status">{notice}</p>}{phase === "loading" && !error && <p role="status">세션과 작업을 확인하는 중입니다.</p>}{["unconfigured", "login"].includes(phase) && <section className={s.empty}><h2>{phase === "unconfigured" ? "운영 연결 후 사용할 수 있습니다." : "운영 계정 로그인이 필요합니다."}</h2><p>현재 공개 검토판은 로그인 없이 캠페인 전 과정을 체험할 수 있습니다. 임의의 상대방 계정이나 결제 완료 상태를 만들지 않습니다.</p><div className={s.actions}><Link className="button" href="/workspace">공개 검토 워크스페이스</Link><Link className="button button--secondary" href="/account">계정 연결 확인</Link></div></section>}{phase === "ready" && <>
    <div className={s.toolbar}><button className="button button--secondary button--small" type="button" disabled={busy} onClick={() => void task(async () => { pending.current = null; apply(await fetchProjects(),selected); })}>최신 작업 새로고침</button><span className={s.helper}>내 계정: {userId}</span></div><details className={s.details}><summary>새 서버 캠페인 · 광고주 역할 필요</summary><form onSubmit={(e) => { e.preventDefault(); void create(); }}><label className={s.label}>상대 크리에이터 계정 ID<input value={creatorId} onChange={(e) => setCreatorId(e.target.value)} maxLength={36} placeholder="상대방의 계정 화면에 표시되는 ID" /></label><button className="button" type="submit" disabled={busy}>서버 작업 만들기</button></form></details>{entries.length === 0 && <p className={s.helper}>연결된 작업이 없습니다. 상대방이 실제로 등록한 크리에이터 계정 ID를 사용하세요.</p>}
    {entry && state && role && <div className={s.layout}><aside className={s.sidebar} aria-label="서버 작업 목록">{entries.map((item) => <button className={s.project} type="button" disabled={busy} key={item.document.seed.id} aria-pressed={selected === item.document.seed.id} onClick={() => choose(item)}><strong>{item.state.proposals.at(-1)?.terms.title ?? "캠페인 초안"}</strong><span>{PHASES[item.state.phase]} · {ROLE[item.role]}</span></button>)}</aside><article className={s.main}><header className={s.projectHeader}><div><span className={s.phase}>{PHASES[state.phase]}</span><h2>{latest?.terms.title ?? "캠페인 초안"}</h2><p>서버 확인 역할: {ROLE[role]} · 기록 {state.revision}개</p></div></header>{state.hold && <p className={s.error}>분쟁 보류: {state.hold}</p>}<div className={s.columns}><section className={s.flow}>
      {state.phase === "DRAFT" && <><TermsEditor value={draft} onChange={setDraft} disabled={!can("ADVERTISER",["DRAFT"])} /><button type="button" className="button" disabled={!can("ADVERTISER",["DRAFT"])} onClick={() => void act({ type: "PROPOSE", terms: draft })}>서버 제안 보내기</button></>}
      {state.phase === "NEGOTIATING" && latest && <><h3>현재 조건 v{latest.version}</h3><TermsEditor value={draft} onChange={setDraft} disabled={busy || Boolean(state.hold) || latest.author === role} /><p className={s.helper}>수락은 편집값이 아니라 저장된 v{latest.version} 조건에 적용됩니다. 금액 {BigInt(latest.terms.amountKrw).toLocaleString("ko-KR")}원 / {latest.terms.deliverable} / 납기 {latest.terms.deadline}</p><p className={s.helper}>수락한 역할: {latest.accepted.map((party) => ROLE[party]).join(", ") || "없음"}</p><div className={s.actions}><button type="button" className="button" disabled={busy || Boolean(state.hold) || latest.accepted.includes(role)} onClick={() => void act({ type: "ACCEPT", version: latest.version })}>저장된 v{latest.version} 수락</button><button type="button" className="button button--secondary" disabled={busy || Boolean(state.hold) || latest.author === role} onClick={() => void act({ type: "COUNTER", terms: draft })}>편집한 조건으로 역제안</button></div></>}
      {state.phase === "CONTRACTED" && <><h3>모의 결제 기록</h3><label className={s.label}>체험 결제 수단<select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}><option value="CARD">카드</option><option value="TOSS_PAY">토스페이</option><option value="KAKAO_PAY">카카오페이</option><option value="NAVER_PAY">네이버페이</option></select></label><p className={s.helper}>PG 요청이나 실제 청구는 발생하지 않습니다.</p><button type="button" className="button" disabled={!can("ADVERTISER",["CONTRACTED"])} onClick={() => void act({ type: "SANDBOX_PAY", method })}>모의 결제 상태 기록</button></>}
      {["FUNDED","REVISION"].includes(state.phase) && <><label className={s.label}>제출 설명<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} /></label><label className={s.label}>제작물 HTTPS 링크 · 선택<input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={2048} /></label><button type="button" className="button" disabled={!can("CREATOR",["FUNDED","REVISION"])} onClick={() => void act({ type: "SUBMIT", note, url })}>서버 검수 요청</button></>}
      {state.phase === "REVIEW" && <><h3>제출본 검수</h3><p className={s.helper}>{state.deliveries.at(-1)?.note}</p>{state.deliveries.at(-1)?.url && <a href={state.deliveries.at(-1)?.url} target="_blank" rel="noopener noreferrer">제출본 링크 ↗</a>}<label className={s.check}><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />콘텐츠와 광고 표시를 확인했습니다.</label><button type="button" className="button" disabled={!can("ADVERTISER",["REVIEW"]) || !checked} onClick={() => void act({ type: "APPROVE", disclosureChecked: true })}>서버 최종 승인</button><label className={s.label}>수정 요청<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} /></label><button type="button" className="button button--secondary" disabled={!can("ADVERTISER",["REVIEW"]) || state.revisionCount >= (state.contract?.terms.revisionLimit ?? 0)} onClick={() => void act({ type: "REVISE", note })}>서버 수정 요청</button></>}
      {state.phase === "APPROVED" && <><label className={s.label}>게시·이행 증빙 URL<input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={2048} /></label><p className={s.helper}>브랜디드·PPL은 YouTube 영상 링크, 오프라인·제휴는 공개 HTTPS 증빙 링크를 기록합니다. URL 존재나 실제 이행은 자동 검증하지 않습니다.</p><button type="button" className="button" disabled={!can("CREATOR",["APPROVED"])} onClick={() => void act({ type: "PUBLISH", url })}>게시 기록 저장</button></>}
      {state.phase === "PUBLISHED" && <><a href={state.publicationUrl ?? undefined} rel="noopener noreferrer" target="_blank">게시·이행 링크 확인 ↗</a><p className={s.helper}>실제 이행 상태를 확인한 뒤 진행하세요.</p><button type="button" className="button" disabled={!can("ADVERTISER",["PUBLISHED"])} onClick={() => void act({ type: "CONFIRM" })}>서버 구매 확인</button></>}
      {state.phase === "SETTLEMENT_READY" && <><h3>정산 준비 기록 완료</h3><p className={s.blocked}>실제 지급은 비활성화되어 있습니다.</p></>}{state.phase === "CANCELLED" && <p className={s.helper}>취소된 작업입니다.</p>}
    </section><aside className={s.contract}><h3>서버 계약 기록</h3>{state.contract ? <><p>{state.contract.terms.title}</p><h3>{BigInt(state.contract.terms.amountKrw).toLocaleString("ko-KR")}원</h3><p>부가세 {state.contract.terms.taxBasis === "INCLUDED" ? "포함" : "별도"} · 수수료 가정 {state.contract.feeBps / 100}%</p><p>{state.contract.terms.deliverable}<br />{state.contract.terms.deadline}<br />수정 {state.contract.terms.revisionLimit}회 / 사용 {state.contract.terms.usageDays}일 / {state.contract.terms.usage}</p><code>{state.contract.sha256}</code><p>이 해시는 변경 확인용이며 전자서명이나 신원 인증 증명이 아닙니다.</p><button className="button button--secondary" type="button" onClick={() => plainFile(contractText(entry.document,state))}>서버 계약 검토본 받기</button></> : <p>양측이 동일한 최신 버전을 수락하면 변경 불가능한 계약 검토 기록이 저장됩니다.</p>}</aside></div>
    <section className={s.history}><h3>서버 협업 기록</h3><div className={s.timeline}>{state.events.slice().reverse().map((event) => <article key={event.sequence}><div><strong>{event.type} · {ROLE[event.actor]}</strong><span>{event.at}</span></div><p>{event.detail}</p></article>)}</div>{state.phase !== "CANCELLED" && <><label className={s.label}>공유 메시지<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} /></label><button type="button" className="button button--secondary" disabled={busy} onClick={() => void act({ type: "MESSAGE", note })}>메시지 저장</button></>}</section>{state.contract && !state.hold && <details className={s.details}><summary>분쟁 보류</summary><label className={s.label}>보류 사유<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} /></label><button type="button" className="button button--secondary" disabled={busy} onClick={() => void act({ type: "DISPUTE", note })}>진행·정산 보류</button></details>}{can("ADVERTISER",["DRAFT","NEGOTIATING"]) && <button type="button" className={s.textButton} onClick={() => void act({ type: "CANCEL", note: "광고주가 합의 전에 취소했습니다." })}>합의 전 작업 취소</button>}</article></div>}
  </>}</div>;
}
