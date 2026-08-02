"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertIcon, CheckIcon, ContractIcon, LockIcon, MessageIcon, PlayIcon, ShieldIcon, UploadIcon } from "@/components/icons";
import { StatusLabel } from "@/components/status-label";
import type { OrderWorkspace as OrderWorkspaceDto } from "@/application/order-collaboration/types";

const stages = ["계약", "샌드박스 결제", "제작", "초안 검수", "게시", "구매 확정", "정산"];
const navigation = [
  ["주문 개요", "#order-overview"],
  ["계약 조건", "#contract-summary"],
  ["메시지", "#messages"],
  ["제출물", "#deliverables"],
  ["결제", "#payment-status"],
  ["분쟁", `/orders/${encodeURIComponent("ORDER_ID")}/dispute`],
] as const;

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const statusLabels: Readonly<Record<string, string>> = {
  DRAFT: "주문 준비",
  NEGOTIATING: "조건 협의 중",
  AWAITING_PARTY_ACCEPTANCE: "계약 확인 중",
  AWAITING_PAYMENT: "샌드박스 결제 대기",
  PAYMENT_PROCESSING: "샌드박스 결제 처리 중",
  FUNDED: "샌드박스 결제 완료",
  BRIEF_CONFIRMATION_PENDING: "브리프 확인 중",
  IN_PRODUCTION: "제작 중",
  DRAFT_SUBMITTED: "초안 검수 중",
  REVISION_REQUESTED: "수정 요청",
  FINAL_APPROVAL_PENDING: "최종 승인 대기",
  SCHEDULED_FOR_PUBLICATION: "게시 예정",
  PUBLISHED: "게시 완료",
  BUYER_CONFIRMATION_PENDING: "구매 확정 대기",
  PAYOUT_BLOCKED: "정산 보류",
  PAYOUT_SCHEDULED: "정산 준비",
  PAYOUT_PROCESSING: "정산 처리 중",
  COMPLETED: "거래 완료",
  DISPUTED: "분쟁 검토 중",
  REFUND_PENDING: "환불 검토 중",
  CANCELED: "취소됨",
};

const deliverableStatusLabels: Readonly<Record<string, string>> = {
  PENDING: "제출 대기",
  SUBMITTED: "검토 대기",
  REVISION_REQUESTED: "수정 요청",
  APPROVED: "승인",
  REJECTED: "반려",
  CANCELED: "취소",
};

const messageTypeLabels: Readonly<Record<string, string>> = {
  TEXT: "대화",
  SYSTEM: "시스템 기록",
  PROPOSAL: "제안",
  DELIVERABLE: "제출물",
  REVISION_REQUEST: "수정 요청",
  APPROVAL: "승인 기록",
};

type OrderOperation = Readonly<{
  body: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
  kind: "message" | "revision" | "approval";
  path: "messages" | "transitions";
}>;

class OrderApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
    this.name = "OrderApiError";
  }
}

function isWorkspace(value: unknown): value is OrderWorkspaceDto {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<OrderWorkspaceDto>;
  return typeof candidate.order?.id === "string"
    && typeof candidate.order.version === "number"
    && Array.isArray(candidate.messages)
    && Array.isArray(candidate.deliverables);
}

async function parseWorkspaceResponse(response: Response): Promise<{ workspace: OrderWorkspaceDto; replayed: boolean }> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: unknown };
    workspace?: unknown;
    replayed?: unknown;
  } | null;

  if (!response.ok) {
    const code = typeof payload?.error?.code === "string" ? payload.error.code : "ORDER_API_ERROR";
    throw new OrderApiError(response.status, code);
  }
  if (!isWorkspace(payload?.workspace)) {
    throw new OrderApiError(502, "INVALID_SERVER_RESPONSE");
  }
  return { workspace: payload.workspace, replayed: payload.replayed === true };
}

async function fetchWorkspace(orderId: string, signal?: AbortSignal) {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/workspace`, {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  return parseWorkspaceResponse(response);
}

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith(prefix));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(prefix.length));
  } catch {
    return null;
  }
}

function apiErrorMessage(error: unknown): string {
  if (!(error instanceof OrderApiError)) return "주문 서버에 연결하지 못했습니다. 같은 요청으로 다시 시도할 수 있습니다.";
  if (error.status === 401) return "주문 작업방을 보려면 로컬 데모 세션 또는 연결된 계정이 필요합니다.";
  if (error.status === 404) return "이 주문을 찾을 수 없거나 접근 권한이 없습니다.";
  if (error.code === "IDEMPOTENCY_IN_PROGRESS") return "같은 요청이 아직 처리 중입니다. 잠시 후 동일한 요청으로 다시 확인해 주세요.";
  if (error.code === "REVISION_LIMIT_REACHED") return "계약에 기록된 수정 요청 횟수를 모두 사용했습니다.";
  if (error.code === "ORDER_STATE_CONFLICT") return "현재 주문 또는 제출물 상태에서는 이 작업을 처리할 수 없습니다.";
  if (error.code === "CLIENT_MESSAGE_CONFLICT") return "이미 기록된 메시지 요청입니다. 최신 기록을 확인해 주세요.";
  if (["ORDER_VERSION_CONFLICT", "DELIVERABLE_VERSION_CONFLICT"].includes(error.code)) return "다른 참여자의 변경이 먼저 반영되어 최신 주문 상태를 다시 불러왔습니다.";
  if (error.status === 409) return "요청이 현재 주문 기록과 충돌했습니다. 최신 상태를 확인해 주세요.";
  if (error.status === 422) return "현재 주문 상태에서는 이 작업을 처리할 수 없습니다.";
  if (error.status === 403) return "보안 토큰이 만료되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.";
  return "주문 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function stageIndex(status: string): number {
  if (["DRAFT", "NEGOTIATING", "AWAITING_PARTY_ACCEPTANCE"].includes(status)) return 0;
  if (["AWAITING_PAYMENT", "PAYMENT_PROCESSING"].includes(status)) return 1;
  if (["FUNDED", "BRIEF_CONFIRMATION_PENDING", "IN_PRODUCTION"].includes(status)) return 2;
  if (["DRAFT_SUBMITTED", "REVISION_REQUESTED", "FINAL_APPROVAL_PENDING"].includes(status)) return 3;
  if (["SCHEDULED_FOR_PUBLICATION", "PUBLISHED"].includes(status)) return 4;
  if (status === "BUYER_CONFIRMATION_PENDING") return 5;
  return 6;
}

export function OrderWorkspace({ orderId }: { orderId: string }) {
  const [workspace, setWorkspace] = useState<OrderWorkspaceDto | null>(null);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [activeOperation, setActiveOperation] = useState<OrderOperation["kind"] | null>(null);
  const [retryOperation, setRetryOperation] = useState<OrderOperation | null>(null);
  const [message, setMessage] = useState("");
  const [revisionReason, setRevisionReason] = useState("제품 로고 노출 시간을 2초 늘려 주세요.");

  useEffect(() => {
    const controller = new AbortController();
    void fetchWorkspace(orderId, controller.signal)
      .then(({ workspace: nextWorkspace }) => {
        setWorkspace(nextWorkspace);
        setSelectedDeliverableId((current) => nextWorkspace.deliverables.some((deliverable) => deliverable.id === current) ? current : nextWorkspace.deliverables[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setLoadError(apiErrorMessage(error));
      });
    return () => controller.abort();
  }, [orderId]);

  const selectedDeliverable = useMemo(
    () => workspace?.deliverables.find((deliverable) => deliverable.id === selectedDeliverableId) ?? workspace?.deliverables[0] ?? null,
    [selectedDeliverableId, workspace],
  );

  async function reloadWorkspace() {
    const result = await fetchWorkspace(orderId);
    setWorkspace(result.workspace);
    setSelectedDeliverableId((current) => current ?? result.workspace.deliverables[0]?.id ?? null);
  }

  async function runOperation(operation: OrderOperation) {
    const csrfToken = readCookie("tb_csrf");
    if (!csrfToken) {
      setActionNotice("보안 토큰이 없습니다. 로그인하거나 페이지를 새로고침한 뒤 다시 시도해 주세요.");
      setRetryOperation(null);
      return;
    }

    setActiveOperation(operation.kind);
    setActionNotice(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/${operation.path}`, {
        body: JSON.stringify(operation.body),
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "idempotency-key": operation.idempotencyKey,
          "x-csrf-token": csrfToken,
        },
        method: "POST",
      });
      const result = await parseWorkspaceResponse(response);
      setWorkspace(result.workspace);
      setRetryOperation(null);
      if (operation.kind === "message") setMessage("");
      setActionNotice(result.replayed ? "이미 처리된 요청의 동일한 결과를 확인했습니다." : "주문 기록에 안전하게 반영했습니다.");
    } catch (error: unknown) {
      setActionNotice(apiErrorMessage(error));
      const versionConflict = error instanceof OrderApiError
        && ["ORDER_VERSION_CONFLICT", "DELIVERABLE_VERSION_CONFLICT"].includes(error.code);
      if (versionConflict) {
        setRetryOperation(null);
        try {
          await reloadWorkspace();
        } catch {
          setLoadError("최신 주문 상태를 다시 불러오지 못했습니다.");
        }
      } else if (error instanceof OrderApiError && error.code === "IDEMPOTENCY_IN_PROGRESS") {
        setRetryOperation(operation);
      } else if (!(error instanceof OrderApiError) || error.status >= 500) {
        setRetryOperation(operation);
      } else {
        setRetryOperation(null);
      }
    } finally {
      setActiveOperation(null);
    }
  }

  function createOperation(kind: OrderOperation["kind"], path: OrderOperation["path"], body: Record<string, unknown>): OrderOperation {
    const intentId = crypto.randomUUID();
    return { body: { ...body, clientMessageId: `ui:${intentId}` }, idempotencyKey: `order-ui:${intentId}`, kind, path };
  }

  function sendMessage() {
    const trimmed = message.trim();
    if (!trimmed || !workspace) return;
    void runOperation(createOperation("message", "messages", { body: trimmed, expectedVersion: workspace.order.version }));
  }

  function reviewDeliverable(action: "REQUEST_REVISION" | "APPROVE_DELIVERABLE") {
    const version = selectedDeliverable?.version;
    if (!workspace || !selectedDeliverable || !version) return;
    const body = action === "REQUEST_REVISION"
      ? { action, deliverableId: selectedDeliverable.id, deliverableVersion: version.version, expectedVersion: workspace.order.version, reason: revisionReason.trim() }
      : { action, deliverableId: selectedDeliverable.id, deliverableVersion: version.version, expectedVersion: workspace.order.version };
    void runOperation(createOperation(action === "REQUEST_REVISION" ? "revision" : "approval", "transitions", body));
  }

  if (!workspace) {
    return (
      <section className="order-access-state">
        <p>주문 작업방</p>
        <h1>{loadError ? "작업방을 열 수 없습니다." : "주문 기록을 불러오고 있습니다."}</h1>
        {loadError ? <><span role="alert">{loadError}</span><div><Link className="button" href="/login">로컬 데모 입장</Link><button className="button button--quiet" onClick={() => window.location.reload()} type="button">다시 불러오기</button></div></> : <span aria-live="polite">검증된 세션과 주문 접근 범위를 확인하고 있습니다.</span>}
      </section>
    );
  }

  const statusText = statusLabels[workspace.order.status] ?? workspace.order.status;
  const currentStageIndex = stageIndex(workspace.order.status);
  const reviewDisabled = activeOperation !== null || !selectedDeliverable?.version || selectedDeliverable.status === "APPROVED";
  const statusTone = workspace.order.status === "REVISION_REQUESTED" || workspace.order.status.includes("BLOCKED") || workspace.order.status === "DISPUTED"
    ? "warning"
    : ["SCHEDULED_FOR_PUBLICATION", "PUBLISHED", "COMPLETED"].includes(workspace.order.status)
      ? "positive"
      : "info";

  return (
    <div className="order-shell">
      <aside className="order-nav" aria-label="주문 작업방 메뉴">
        <Link className="order-nav__back" href="/dashboard">← 주문 작업방으로</Link>
        {navigation.map(([item, href], index) => <Link className={index === 0 ? "is-active" : ""} href={href.replace("ORDER_ID", orderId)} key={item}>{index === 1 ? <ContractIcon /> : index === 2 ? <MessageIcon /> : index === 3 ? <PlayIcon /> : index === 4 ? <LockIcon /> : index === 5 ? <ShieldIcon /> : <UploadIcon />}{item}</Link>)}
      </aside>

      <section className="order-main" id="order-overview">
        <div className="order-titlebar"><div><h1>주문 작업방</h1><p>{workspace.order.orderNumber} · 검수 및 메시지 기록</p></div><StatusLabel tone={statusTone}>{statusText}</StatusLabel></div>
        <div className="order-parties"><span><strong>광고주</strong> 승인된 주문 참여자</span><span aria-hidden="true">↔</span><span><strong>크리에이터</strong> 승인된 주문 참여자</span></div>
        <ol className="order-progress" aria-label="주문 진행 상태">
          {stages.map((stage, index) => <li className={index < currentStageIndex ? "is-complete" : index === currentStageIndex ? "is-active" : ""} key={stage}><span>{index < currentStageIndex ? <CheckIcon size={15} /> : index + 1}</span><b>{stage}</b></li>)}
        </ol>

        <div className="order-facts">
          <div><strong>주문 번호</strong><span>{workspace.order.orderNumber}</span></div>
          <div><strong>수정 가능</strong><span>{workspace.order.revisionCount}/{workspace.order.revisionLimit}회 사용</span></div>
          <div><strong>낙관적 잠금</strong><span>v{workspace.order.version}</span></div>
          <div><strong>현재 상태</strong><span>{statusText}</span></div>
        </div>

        {actionNotice ? <div aria-live="polite" className="order-action-notice"><p>{actionNotice}</p>{retryOperation ? <button className="button button--quiet button--small" disabled={activeOperation !== null} onClick={() => void runOperation(retryOperation)} type="button">같은 요청 다시 시도</button> : null}</div> : null}

        <section className="deliverable-section" id="deliverables">
          <h2>제출물 검수</h2>
          <div className="deliverable-grid">
            <div className="version-list" role="listbox" aria-label="제출물 버전">
              {workspace.deliverables.map((deliverable) => (
                <button aria-selected={selectedDeliverable?.id === deliverable.id} className={selectedDeliverable?.id === deliverable.id ? "is-selected" : ""} key={deliverable.id} onClick={() => setSelectedDeliverableId(deliverable.id)} role="option" type="button">
                  <strong>v{deliverable.currentVersion} · {deliverable.type}</strong>
                  <span className={deliverable.status === "REVISION_REQUESTED" ? "text-danger" : ""}>{deliverableStatusLabels[deliverable.status] ?? deliverable.status}</span>
                  <small>{deliverable.version ? dateFormatter.format(new Date(deliverable.version.submittedAt)) : "아직 제출되지 않음"}</small>
                </button>
              ))}
              {workspace.deliverables.length === 0 ? <p className="order-empty-note">등록된 제출물이 없습니다.</p> : null}
            </div>
            <div className="deliverable-preview">
              <div className="deliverable-preview__head"><span>파일 미리보기 · {selectedDeliverable?.version ? `v${selectedDeliverable.version.version}` : "제출 대기"}</span><button aria-describedby="preview-only-note" className="button button--quiet button--small" disabled type="button">미리보기 전용</button></div>
              <div className="video-frame"><PlayIcon size={44} /><p className="video-placeholder">보안 검사를 통과한 비공개 미리보기 URL이 연결되면 이 영역에 표시됩니다.</p></div>
              <div className="revision-panel"><div><h3>검수 의견</h3><label className="sr-only" htmlFor="revision-reason">주문 기록에 남을 수정 요청 사유</label><textarea disabled={reviewDisabled} id="revision-reason" maxLength={1000} onChange={(event) => setRevisionReason(event.target.value)} value={revisionReason} />{selectedDeliverable?.version?.revisionRequest ? <p>최근 요청: {selectedDeliverable.version.revisionRequest}</p> : null}{selectedDeliverable?.version?.feedback ? <p>승인 의견: {selectedDeliverable.version.feedback}</p> : null}</div><div><button className="button" disabled={reviewDisabled} onClick={() => reviewDeliverable("APPROVE_DELIVERABLE")} type="button">{activeOperation === "approval" ? "처리 중" : "최종 승인"}</button><button className="button button--danger" disabled={reviewDisabled || !revisionReason.trim() || workspace.order.revisionCount >= workspace.order.revisionLimit} onClick={() => reviewDeliverable("REQUEST_REVISION")} type="button">{activeOperation === "revision" ? "처리 중" : "수정 요청"}</button></div></div>
            </div>
          </div>
        </section>

        <section className="order-messages" id="messages">
          <h2>메시지</h2>
          <div className="message-list">{workspace.messages.map((item) => <div className="message-row" key={item.id}><span className="message-avatar">참</span><div><strong>주문 참여자</strong><small>{messageTypeLabels[item.type] ?? item.type}</small><p>{item.body ?? "상태 변경이 기록되었습니다."}</p></div><time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time></div>)}{workspace.messages.length === 0 ? <p className="order-empty-note">아직 기록된 메시지가 없습니다.</p> : null}</div>
          <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }}><label className="sr-only" htmlFor="order-message">주문 기록에 남을 메시지</label><input disabled={activeOperation !== null} id="order-message" maxLength={5000} onChange={(event) => setMessage(event.target.value)} placeholder="주문 기록에 남을 메시지를 입력하세요" value={message} /><button className="button button--small" disabled={activeOperation !== null || !message.trim()} type="submit">{activeOperation === "message" ? "전송 중" : "보내기"}</button></form>
        </section>
      </section>

      <aside className="order-rail">
        <section id="contract-summary"><h2>서버 기록 요약</h2><dl><dt>주문 번호</dt><dd>{workspace.order.orderNumber}</dd><dt>현재 상태</dt><dd>{statusText}</dd><dt>주문 버전</dt><dd>v{workspace.order.version}</dd><dt>수정 사용</dt><dd>{workspace.order.revisionCount}/{workspace.order.revisionLimit}회</dd></dl><p className="order-rail__note">금액·사용권 등 계약 원문은 별도 계약 조회 권한이 연결된 뒤 표시됩니다.</p></section>
        <section><h2>검수 참고 체크리스트</h2><p className="order-rail__note">이 체크 상태는 저장되지 않습니다.</p><label><input type="checkbox" /> 광고주·브랜드 로고 노출</label><label><input type="checkbox" /> 제품·서비스 주요 특징 언급</label><label><input type="checkbox" /> 구매 유도 CTA 표현</label><label><input type="checkbox" /> 광고 표시 고지</label><label><input type="checkbox" /> 음악·저작권 준수</label></section>
        <section><h2>주문 타임라인</h2><ol className="timeline">{stages.map((stage, index) => <li className={index < currentStageIndex ? "is-done" : index === currentStageIndex ? "is-current" : ""} key={stage}>{stage}</li>)}</ol></section>
        <p className="sandbox-warning" id="payment-status"><AlertIcon /> 결제 기능은 현재 샌드박스·외부 차단 상태이며, 이 화면은 결제 보관을 증명하지 않습니다.<span className="sr-only" id="preview-only-note">검사 완료된 비공개 미리보기 파일은 아직 연결되지 않았습니다.</span></p>
      </aside>
    </div>
  );
}
