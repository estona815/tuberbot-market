import { z } from "zod";
/** Deterministic sandbox state machine. This module cannot charge or pay anybody. */
export const AD_TYPES = { BRANDED: "브랜디드", PPL: "PPL", OFFLINE: "오프라인", AFFILIATE: "제휴" } as const;
export const PHASES = { DRAFT: "초안", NEGOTIATING: "조건 협의", CONTRACTED: "계약 합의", FUNDED: "모의 결제 완료", REVIEW: "콘텐츠 검수", REVISION: "수정 요청", APPROVED: "최종 승인", PUBLISHED: "게시 완료", SETTLEMENT_READY: "정산 준비", CANCELLED: "취소" } as const;
export type Party = "ADVERTISER" | "CREATOR";
export type Phase = keyof typeof PHASES;
const line = (max: number) => z.string().trim().min(1).max(max).refine((v) => !/[\u0000-\u001f\u007f]/u.test(v), "한 줄 텍스트를 입력하세요.");
const note = z.string().trim().min(1).max(1500).refine((v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v));
const iso = z.string().datetime();
const money = z.string().refine((v) => /^[1-9]\d{0,12}$/u.test(v) && BigInt(v) <= 1_000_000_000_000n, "금액은 1원~1조 원의 정수입니다.");
export const termsSchema = z.strictObject({
  title: line(100), brand: line(80), category: line(40), adType: z.enum(["BRANDED", "PPL", "OFFLINE", "AFFILIATE"]), amountKrw: money,
  deliverable: line(240), deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine((v) => {
    const date = new Date(`${v}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
  }, "유효한 날짜가 필요합니다."),
  revisionLimit: z.number().int().min(0).max(10), usage: z.enum(["CHANNEL_ONLY", "BRAND_ORGANIC", "PAID_MEDIA"]),
  usageDays: z.number().int().min(1).max(3650), taxBasis: z.enum(["INCLUDED", "EXCLUDED"]),
});
export type Terms = z.infer<typeof termsSchema>;
export const actionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("PROPOSE"), terms: termsSchema }), z.strictObject({ type: z.literal("COUNTER"), terms: termsSchema }),
  z.strictObject({ type: z.literal("ACCEPT"), version: z.number().int().positive() }),
  z.strictObject({ type: z.literal("SANDBOX_PAY"), method: z.enum(["TOSS_PAY", "KAKAO_PAY", "NAVER_PAY", "CARD"]) }),
  z.strictObject({ type: z.literal("SUBMIT"), note, url: z.string().max(2048).default("") }),
  z.strictObject({ type: z.literal("REVISE"), note }), z.strictObject({ type: z.literal("APPROVE"), disclosureChecked: z.literal(true) }),
  z.strictObject({ type: z.literal("PUBLISH"), url: z.string().max(2048) }), z.strictObject({ type: z.literal("CONFIRM") }),
  z.strictObject({ type: z.literal("DISPUTE"), note }), z.strictObject({ type: z.literal("MESSAGE"), note }), z.strictObject({ type: z.literal("CANCEL"), note }),
]);
export type WorkspaceAction = z.infer<typeof actionSchema>;
export const seedSchema = z.strictObject({ id: z.string().uuid(), mode: z.enum(["LOCAL_REVIEW", "SERVER_SANDBOX"]), createdAt: iso, advertiserLabel: line(80), creatorLabel: line(80), feeBps: z.number().int().min(0).max(10000) });
export const commandSchema = z.strictObject({ key: z.string().uuid(), expectedRevision: z.number().int().min(0), at: iso, actor: z.enum(["ADVERTISER", "CREATOR"]), action: actionSchema });
export const workspaceDocumentSchema = z.strictObject({ schemaVersion: z.literal(1), seed: seedSchema, commands: z.array(commandSchema).max(200) });
export type WorkspaceDocument = z.infer<typeof workspaceDocumentSchema>;
export type WorkspaceCommand = z.infer<typeof commandSchema>;
export type Proposal = { version: number; author: Party; terms: Terms; at: string; accepted: Party[] };
export type Contract = { version: number; terms: Terms; canonical: string; sha256: string; at: string; feeBps: number; feeKrw: string; creatorKrw: string };
export type WorkspaceState = { id: string; revision: number; phase: Phase; proposals: Proposal[]; contract: Contract | null; paymentMethod: string | null; revisionCount: number; hold: string | null; deliveries: { note: string; url: string; at: string }[]; publicationUrl: string | null; events: { sequence: number; actor: Party; type: WorkspaceAction["type"]; at: string; detail: string }[] };
export class WorkspaceError extends Error { constructor(readonly code: string, message: string) { super(message); this.name = "WorkspaceError"; } }
function reject(message: string, code = "INVALID_TRANSITION"): never { throw new WorkspaceError(code, message); }
/** Records links only, never fetches a user-controlled URL. */
export function publicHttpsUrl(input: string, youtubeOnly = false): string {
  let url: URL;
  try { url = new URL(input); } catch { return reject("올바른 HTTPS 링크를 입력하세요.", "INVALID_URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || url.hostname.length < 4 || !url.hostname.includes(".") || /^(?:\d|\[)/u.test(url.hostname) || /(?:^|\.)(?:localhost|local|internal|invalid)$/u.test(url.hostname)) reject("공개 HTTPS 링크만 사용할 수 있습니다.", "INVALID_URL");
  if (youtubeOnly) {
    let id: string | null = null;
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) id = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})\/?$/u)?.[1] ?? null;
    else if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    if (!id || !/^[\w-]{11}$/u.test(id)) reject("YouTube 영상 또는 쇼츠의 게시 URL이 필요합니다.", "INVALID_URL");
    return `https://www.youtube.com/watch?v=${id}`;
  }
  return url.href;
}
export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function newWorkspace(seed: z.input<typeof seedSchema>): WorkspaceDocument { return { schemaVersion: 1, seed: seedSchema.parse(seed), commands: [] }; }
function requirePhase(state: WorkspaceState, allowed: Phase[]): void { if (!allowed.includes(state.phase)) reject("현재 단계에서 실행할 수 없는 작업입니다."); }
function requireActor(actual: Party, expected: Party): void { if (actual !== expected) reject(`${expected === "ADVERTISER" ? "광고주" : "크리에이터"} 역할의 작업입니다.`, "PARTY_REQUIRED"); }
async function reduce(state: WorkspaceState, command: WorkspaceCommand, seed: WorkspaceDocument["seed"]): Promise<WorkspaceState> {
  if (command.expectedRevision !== state.revision) reject("다른 변경사항이 있습니다. 최신 내용을 다시 불러오세요.", "REVISION_CONFLICT");
  if (Date.parse(command.at) < Date.parse(state.events.at(-1)?.at ?? seed.createdAt)) reject("이전 기록보다 이른 시각은 사용할 수 없습니다.", "INVALID_TIME");
  const next = structuredClone(state), { actor, action } = command;
  if (state.hold && action.type !== "MESSAGE") reject("분쟁 보류 중입니다. 운영자 검토 전에는 진행하거나 지급할 수 없습니다.", "DISPUTE_HOLD");
  if (state.phase === "CANCELLED") reject("취소된 작업은 변경할 수 없습니다.");
  let detail = "";
  const latest = next.proposals.at(-1);
  switch (action.type) {
    case "PROPOSE": case "COUNTER": {
      if (action.type === "PROPOSE") { requirePhase(state, ["DRAFT"]); requireActor(actor, "ADVERTISER"); }
      else { requirePhase(state, ["NEGOTIATING"]); if (!latest || latest.author === actor) reject("상대방의 제안에만 역제안할 수 있습니다."); }
      if (next.proposals.length >= 30) reject("조건 버전은 최대 30개입니다.");
      next.proposals.push({ version: next.proposals.length + 1, author: actor, terms: action.terms, at: command.at, accepted: [] });
      next.phase = "NEGOTIATING"; detail = `조건 v${next.proposals.length} · ${action.terms.amountKrw}원`; break;
    }
    case "ACCEPT": {
      requirePhase(state, ["NEGOTIATING"]);
      if (!latest || latest.version !== action.version) reject("현재 조건 버전만 수락할 수 있습니다.", "VERSION_CONFLICT");
      if (latest.accepted.includes(actor)) reject("이 역할은 이미 현재 버전을 수락했습니다.");
      latest.accepted.push(actor); detail = `조건 v${latest.version} 개별 수락`;
      if (latest.accepted.length === 2) {
        const amount = BigInt(latest.terms.amountKrw), fee = (amount * BigInt(seed.feeBps) + 5000n) / 10000n;
        const canonical = JSON.stringify({ schemaVersion: 1, mode: seed.mode, id: seed.id, advertiser: seed.advertiserLabel, creator: seed.creatorLabel, version: latest.version, terms: latest.terms, feeBps: seed.feeBps });
        next.contract = { version: latest.version, terms: structuredClone(latest.terms), canonical, sha256: await sha256(canonical), at: command.at, feeBps: seed.feeBps, feeKrw: fee.toString(), creatorKrw: (amount - fee).toString() }; next.phase = "CONTRACTED";
      }
      break;
    }
    case "SANDBOX_PAY":
      requireActor(actor, "ADVERTISER"); requirePhase(state, ["CONTRACTED"]); if (!next.contract) reject("양측 합의된 계약이 없습니다.");
      next.paymentMethod = action.method; next.phase = "FUNDED"; detail = `${action.method} 모의 확인 · 외부 PG 요청과 실제 청구 없음`; break;
    case "SUBMIT":
      requireActor(actor, "CREATOR"); requirePhase(state, ["FUNDED", "REVISION"]);
      next.deliveries.push({ note: action.note, url: action.url ? publicHttpsUrl(action.url) : "", at: command.at }); next.phase = "REVIEW"; detail = action.note; break;
    case "REVISE":
      requireActor(actor, "ADVERTISER"); requirePhase(state, ["REVIEW"]);
      if (!next.contract || next.revisionCount >= next.contract.terms.revisionLimit) reject("계약의 수정 횟수를 모두 사용했습니다.", "REVISION_LIMIT");
      next.revisionCount += 1; next.phase = "REVISION"; detail = action.note; break;
    case "APPROVE": requireActor(actor, "ADVERTISER"); requirePhase(state, ["REVIEW"]); next.phase = "APPROVED"; detail = "콘텐츠 및 광고 표시 확인 후 승인"; break;
    case "PUBLISH":
      requireActor(actor, "CREATOR"); requirePhase(state, ["APPROVED"]);
      next.publicationUrl = publicHttpsUrl(action.url, !["OFFLINE", "AFFILIATE"].includes(next.contract?.terms.adType ?? "PPL")); next.phase = "PUBLISHED"; detail = next.publicationUrl; break;
    case "CONFIRM": requireActor(actor, "ADVERTISER"); requirePhase(state, ["PUBLISHED"]); next.phase = "SETTLEMENT_READY"; detail = "구매 확인 · 지급은 실행하지 않음"; break;
    case "DISPUTE": requirePhase(state, ["CONTRACTED", "FUNDED", "REVIEW", "REVISION", "APPROVED", "PUBLISHED", "SETTLEMENT_READY"]); next.hold = action.note; detail = action.note; break;
    case "MESSAGE": detail = action.note; break;
    case "CANCEL": requireActor(actor, "ADVERTISER"); requirePhase(state, ["DRAFT", "NEGOTIATING"]); next.phase = "CANCELLED"; detail = action.note; break;
  }
  next.revision += 1; next.events.push({ sequence: next.revision, actor, type: action.type, at: command.at, detail }); return next;
}
export async function deriveWorkspace(input: unknown): Promise<WorkspaceState> {
  const doc = workspaceDocumentSchema.parse(input);
  if (new Set(doc.commands.map((command) => command.key)).size !== doc.commands.length) reject("중복 명령이 있는 파일입니다.", "INVALID_DOCUMENT");
  let state: WorkspaceState = { id: doc.seed.id, revision: 0, phase: "DRAFT", proposals: [], contract: null, paymentMethod: null, revisionCount: 0, hold: null, deliveries: [], publicationUrl: null, events: [] };
  for (const command of doc.commands) state = await reduce(state, command, doc.seed);
  return state;
}
export async function appendWorkspaceCommand(input: unknown, rawCommand: unknown): Promise<{ document: WorkspaceDocument; state: WorkspaceState; replayed: boolean }> {
  const document = workspaceDocumentSchema.parse(input), command = commandSchema.parse(rawCommand);
  const previous = document.commands.find((item) => item.key === command.key), state = await deriveWorkspace(document);
  if (previous) {
    if (previous.actor !== command.actor || JSON.stringify(previous.action) !== JSON.stringify(command.action)) reject("같은 요청 키에 다른 내용을 사용할 수 없습니다.", "IDEMPOTENCY_CONFLICT");
    return { document, state, replayed: true };
  }
  if (document.commands.length >= 200) reject("작업당 기록은 최대 200개입니다. 기록을 내보내고 새 작업을 만드세요.");
  const next = await reduce(state, command, document.seed);
  return { document: { ...document, commands: [...document.commands, command] }, state: next, replayed: false };
}
export async function importWorkspaceFile(text: string): Promise<WorkspaceDocument[]> {
  if (new TextEncoder().encode(text).length > 2_000_000) reject("작업 파일은 2 MB 이하여야 합니다.", "FILE_TOO_LARGE");
  const value = z.strictObject({ schemaVersion: z.literal(1), workspaces: z.array(workspaceDocumentSchema).max(30) }).parse(JSON.parse(text));
  if (new Set(value.workspaces.map((item) => item.seed.id)).size !== value.workspaces.length) reject("작업 ID가 중복되었습니다.");
  for (const doc of value.workspaces) { if (doc.seed.mode !== "LOCAL_REVIEW") reject("서버 작업은 브라우저 파일로 가져올 수 없습니다."); await deriveWorkspace(doc); }
  return value.workspaces;
}
export function exportWorkspaceFile(workspaces: WorkspaceDocument[]): string { return JSON.stringify({ schemaVersion: 1, workspaces }, null, 2); }
export function contractText(document: WorkspaceDocument, state: WorkspaceState): string {
  if (!state.contract) reject("양측 합의 후 계약서를 내보낼 수 있습니다.");
  const { terms, sha256: hash, feeKrw, creatorKrw, feeBps } = state.contract;
  return ["튜버봇 광고 협업 계약 검토본", "모의 거래 기록이며 전자서명·실제 계약 체결 증명이 아닙니다.", "", `작업: ${document.seed.id}`, `광고주: ${document.seed.advertiserLabel}`, `크리에이터: ${document.seed.creatorLabel}`, `캠페인: ${terms.title}`, `브랜드: ${terms.brand}`, `광고 유형: ${AD_TYPES[terms.adType]}`, `제작물: ${terms.deliverable}`, `합의 금액: ${terms.amountKrw} KRW (부가세 ${terms.taxBasis === "INCLUDED" ? "포함" : "별도"})`, `납기: ${terms.deadline}`, `수정 한도: ${terms.revisionLimit}회`, `사용 범위: ${terms.usage}`, `사용 기간: ${terms.usageDays}일`, `수수료 가정: ${feeBps / 100}% / ${feeKrw} KRW`, `공제 후 참고 금액: ${creatorKrw} KRW (세무 조정 전)`, `합의 버전: ${state.contract.version}`, `내용 SHA-256: ${hash}`, "", "광고 표시, 지식재산권, 환불·분쟁·세무 조건과 계약 효력은 당사자와 운영자의 별도 검토 대상입니다.", "실제 PG 승인·출금·지급은 이 기록으로 실행되지 않습니다."].join("\n");
}
