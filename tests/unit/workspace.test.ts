import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appendWorkspaceCommand, contractText, deriveWorkspace, exportWorkspaceFile, importWorkspaceFile, newWorkspace, publicHttpsUrl, termsSchema, type Party, type Terms, type WorkspaceAction, type WorkspaceDocument } from "@/domain/workspace";
const at = "2026-09-05T00:00:00.000Z";
const terms: Terms = { title: "검증 캠페인", brand: "테스트", category: "IT", adType: "PPL", amountKrw: "1000000", deliverable: "롱폼 영상 1편", deadline: "2026-10-01", revisionLimit: 1, usage: "CHANNEL_ONLY", usageDays: 30, taxBasis: "EXCLUDED" };
const fresh = () => newWorkspace({ id: crypto.randomUUID(), mode: "LOCAL_REVIEW", createdAt: at, advertiserLabel: "검증 광고주", creatorLabel: "검증 크리에이터", feeBps: 1200 });
async function send(doc: WorkspaceDocument, actor: Party, action: WorkspaceAction) {
  return (await appendWorkspaceCommand(doc, { key: crypto.randomUUID(), expectedRevision: doc.commands.length, at, actor, action })).document;
}
async function contracted() {
  let doc = await send(fresh(), "ADVERTISER", { type: "PROPOSE", terms });
  doc = await send(doc, "CREATOR", { type: "COUNTER", terms: { ...terms, amountKrw: "1100000" } });
  doc = await send(doc, "ADVERTISER", { type: "ACCEPT", version: 2 });
  return send(doc, "CREATOR", { type: "ACCEPT", version: 2 });
}
describe("versioned collaboration workspace", () => {
  it("runs proposal, counter, two-party contract, payment simulation, revision, publication and settlement preparation", async () => {
    let doc = await contracted();
    let state = await deriveWorkspace(doc);
    expect(state.phase).toBe("CONTRACTED");
    expect(state.contract?.feeKrw).toBe("132000");
    expect(state.contract?.creatorKrw).toBe("968000");
    expect(state.contract?.sha256).toBe(createHash("sha256").update(state.contract!.canonical).digest("hex"));
    const frozen = state.contract;
    doc = await send(doc, "ADVERTISER", { type: "SANDBOX_PAY", method: "KAKAO_PAY" });
    doc = await send(doc, "CREATOR", { type: "SUBMIT", note: "초안", url: "https://example.com/draft" });
    doc = await send(doc, "ADVERTISER", { type: "REVISE", note: "광고 표시 위치 수정" });
    doc = await send(doc, "CREATOR", { type: "SUBMIT", note: "수정 완료", url: "" });
    doc = await send(doc, "ADVERTISER", { type: "APPROVE", disclosureChecked: true });
    doc = await send(doc, "CREATOR", { type: "PUBLISH", url: "https://youtu.be/abcdefghijk" });
    doc = await send(doc, "ADVERTISER", { type: "CONFIRM" });
    state = await deriveWorkspace(doc);
    expect(state.phase).toBe("SETTLEMENT_READY");
    expect(state.contract).toEqual(frozen);
    expect(state.revisionCount).toBe(1);
    expect(state.deliveries).toHaveLength(2);
    expect(state.events).toHaveLength(doc.commands.length);
    expect(contractText(doc, state)).toContain("실제 계약 체결 증명이 아닙니다");
    expect(JSON.stringify(state)).not.toContain('"PAID"');
  });
  it("resets acceptances when the counterpart changes conditions", async () => {
    let doc = await send(fresh(), "ADVERTISER", { type: "PROPOSE", terms });
    doc = await send(doc, "ADVERTISER", { type: "ACCEPT", version: 1 });
    doc = await send(doc, "CREATOR", { type: "COUNTER", terms: { ...terms, amountKrw: "1200000" } });
    const state = await deriveWorkspace(doc);
    expect(state.proposals.at(-1)?.accepted).toEqual([]);
    expect(state.contract).toBeNull();
    await expect(send(doc, "CREATOR", { type: "ACCEPT", version: 1 })).rejects.toThrow(/현재 조건/u);
  });
  it("rejects duplicate acceptance and single-party payment", async () => {
    let doc = await send(fresh(), "ADVERTISER", { type: "PROPOSE", terms });
    doc = await send(doc, "ADVERTISER", { type: "ACCEPT", version: 1 });
    await expect(send(doc, "ADVERTISER", { type: "ACCEPT", version: 1 })).rejects.toThrow(/이미/u);
    await expect(send(doc, "ADVERTISER", { type: "SANDBOX_PAY", method: "CARD" })).rejects.toThrow();
  });
  it("is idempotent for the same key and content, rejects conflicting retries and stale revisions", async () => {
    const doc = fresh(), cmd = { key: crypto.randomUUID(), expectedRevision: 0, at, actor: "ADVERTISER", action: { type: "PROPOSE", terms } };
    const once = await appendWorkspaceCommand(doc, cmd);
    const replay = await appendWorkspaceCommand(once.document, cmd);
    expect(replay.replayed).toBe(true);
    expect(replay.document.commands).toHaveLength(1);
    await expect(appendWorkspaceCommand(once.document, { ...cmd, action: { type: "MESSAGE", note: "다른 내용" } })).rejects.toThrow(/요청 키/u);
    await expect(appendWorkspaceCommand(once.document, { ...cmd, key: crypto.randomUUID() })).rejects.toThrow(/최신/u);
  });
  it("blocks phase skipping and the wrong actor", async () => {
    await expect(send(fresh(), "CREATOR", { type: "PROPOSE", terms })).rejects.toThrow(/광고주/u);
    await expect(send(fresh(), "ADVERTISER", { type: "CONFIRM" })).rejects.toThrow();
    await expect(send(await contracted(), "CREATOR", { type: "SANDBOX_PAY", method: "CARD" })).rejects.toThrow();
  });
  it("freezes all contract fields and permits no further counteroffer", async () => {
    const doc = await contracted();
    await expect(send(doc, "CREATOR", { type: "COUNTER", terms })).rejects.toThrow();
    const changedTerms = { ...terms, usage: "PAID_MEDIA" as const };
    let other = await send(fresh(), "ADVERTISER", { type: "PROPOSE", terms: changedTerms });
    other = await send(other, "ADVERTISER", { type: "ACCEPT", version: 1 });
    other = await send(other, "CREATOR", { type: "ACCEPT", version: 1 });
    expect((await deriveWorkspace(other)).contract?.sha256).not.toBe((await deriveWorkspace(doc)).contract?.sha256);
  });
  it("requires disclosure check and respects revision limits", async () => {
    let doc = await send(await contracted(), "ADVERTISER", { type: "SANDBOX_PAY", method: "CARD" });
    doc = await send(doc, "CREATOR", { type: "SUBMIT", note: "초안", url: "" });
    await expect(appendWorkspaceCommand(doc, { key: crypto.randomUUID(), expectedRevision: doc.commands.length, at, actor: "ADVERTISER", action: { type: "APPROVE", disclosureChecked: false } })).rejects.toThrow();
    doc = await send(doc, "ADVERTISER", { type: "REVISE", note: "수정" });
    doc = await send(doc, "CREATOR", { type: "SUBMIT", note: "수정본", url: "" });
    await expect(send(doc, "ADVERTISER", { type: "REVISE", note: "추가 수정" })).rejects.toThrow(/수정 횟수/u);
  });
  it("holds progression and payout even after a dispute, while retaining messages", async () => {
    let doc = await send(await contracted(), "CREATOR", { type: "DISPUTE", note: "사용권 범위 확인 필요" });
    await expect(send(doc, "ADVERTISER", { type: "SANDBOX_PAY", method: "CARD" })).rejects.toThrow(/분쟁 보류/u);
    doc = await send(doc, "ADVERTISER", { type: "MESSAGE", note: "확인하겠습니다." });
    expect((await deriveWorkspace(doc)).hold).toBe("사용권 범위 확인 필요");
  });
  it("rejects time reversal, duplicate commands and unknown action shapes", async () => {
    await expect(appendWorkspaceCommand(fresh(), { key: crypto.randomUUID(), expectedRevision: 0, at: "2020-01-01T00:00:00.000Z", actor: "ADVERTISER", action: { type: "PROPOSE", terms } })).rejects.toThrow(/이른 시각/u);
    const doc = await contracted();
    await expect(deriveWorkspace({ ...doc, commands: [...doc.commands, doc.commands[0]] })).rejects.toThrow(/중복/u);
    await expect(send(doc, "ADVERTISER", { type: "LIVE_PAYOUT" } as unknown as WorkspaceAction)).rejects.toThrow();
  });
  it("round-trips files by replaying commands rather than trusting stored totals", async () => {
    const doc = await contracted();
    expect(await importWorkspaceFile(exportWorkspaceFile([doc]))).toEqual([doc]);
    await expect(importWorkspaceFile(exportWorkspaceFile([doc, doc]))).rejects.toThrow(/중복/u);
    await expect(importWorkspaceFile(exportWorkspaceFile([{ ...doc, seed: { ...doc.seed, mode: "SERVER_SANDBOX" } }]))).rejects.toThrow(/서버 작업/u);
    await expect(importWorkspaceFile("가".repeat(1_000_000))).rejects.toThrow(/2 MB/u);
    await expect(importWorkspaceFile('{"schemaVersion":1,"workspaces":[],"paid":true}')).rejects.toThrow();
  });
  it.each(["0", "-1", "1.5", "1e6", "1000000000001", "Infinity"])("rejects invalid KRW %s", (amountKrw) => {
    expect(() => termsSchema.parse({ ...terms, amountKrw })).toThrow();
  });
  it.each(["2026-02-30", "2026-13-01", "2026-00-02", "bad"])("rejects impossible deadline %s", (deadline) => {
    expect(() => termsSchema.parse({ ...terms, deadline })).toThrow();
  });
  it.each(["javascript:alert(1)", "http://example.com", "https://127.0.0.1/x", "https://localhost/x", "https://example.com:8443/x", "https://u:p@example.com/x", "https://youtube.com.evil.test/watch?v=abcdefghijk"])("rejects unsafe publication URL %s", (url) => {
    expect(() => publicHttpsUrl(url, true)).toThrow();
  });
  it("normalizes public YouTube video/short URLs without fetching them", () => {
    expect(publicHttpsUrl("https://www.youtube.com/shorts/abcdefghijk?feature=share", true)).toBe("https://www.youtube.com/watch?v=abcdefghijk");
  });
});
