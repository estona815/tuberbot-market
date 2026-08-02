"use client";

import { useReducer } from "react";
import {
  DEMO_DEAL_PARTIES,
  DEMO_EASY_PAY_METHODS,
  DEMO_LIVE_PAYMENTS_ENABLED,
  DEMO_LIVE_PAYOUTS_ENABLED,
  DEMO_PAYMENT_MODE,
  DEMO_PROPOSALS,
  applyDemoDealAction,
  createInitialDemoDealState,
  isDemoDealTerminal,
  type DemoDealAction,
  type DemoDealPhase,
  type DemoDealState,
} from "@/domain/deal-demo";

const moneyFormatter = new Intl.NumberFormat("ko-KR");
const eventDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

const phaseCopy: Readonly<
  Record<DemoDealPhase, Readonly<{ eyebrow: string; title: string }>>
> = {
  READY: { eyebrow: "제안 전", title: "광고주 제안을 시작해 보세요" },
  PROPOSAL_V1: { eyebrow: "제안 v1", title: "크리에이터 답변 대기" },
  AWAITING_PARTY_ACCEPTANCE: {
    eyebrow: "역제안 v2",
    title: "양측 개별 수락 대기",
  },
  AWAITING_PAYMENT: {
    eyebrow: "계약 고정",
    title: "샌드박스 간편결제 선택",
  },
  IN_PRODUCTION: { eyebrow: "제작", title: "크리에이터 초안 제출 대기" },
  DRAFT_SUBMITTED: { eyebrow: "검수", title: "초안 v1 검수 중" },
  REVISION_REQUESTED: { eyebrow: "수정", title: "수정본 재제출 대기" },
  DRAFT_RESUBMITTED: { eyebrow: "재검수", title: "수정본 v2 최종 승인 대기" },
  FINAL_APPROVED: { eyebrow: "승인", title: "게시 완료 기록 대기" },
  PUBLISHED: { eyebrow: "게시", title: "광고주 구매 확정 대기" },
  PAYOUT_BLOCKED: { eyebrow: "종료", title: "라이브 정산 비활성화" },
};

const progressStages = [
  { label: "제안·협의", phases: ["READY", "PROPOSAL_V1", "AWAITING_PARTY_ACCEPTANCE"] },
  { label: "계약·결제", phases: ["AWAITING_PAYMENT"] },
  { label: "제작", phases: ["IN_PRODUCTION"] },
  { label: "검수", phases: ["DRAFT_SUBMITTED", "REVISION_REQUESTED", "DRAFT_RESUBMITTED"] },
  { label: "게시·확정", phases: ["FINAL_APPROVED", "PUBLISHED", "PAYOUT_BLOCKED"] },
] as const;

type ReducerCommand =
  | Readonly<{ type: "ADVANCE"; action: DemoDealAction }>
  | Readonly<{ type: "RESET" }>;

function dealReducer(
  state: Readonly<DemoDealState>,
  command: ReducerCommand,
): Readonly<DemoDealState> {
  return command.type === "RESET"
    ? createInitialDemoDealState()
    : applyDemoDealAction(state, command.action);
}

function formatKrw(amount: bigint): string {
  return `${moneyFormatter.format(amount)}원`;
}

function actionPanel(
  state: Readonly<DemoDealState>,
  dispatch: (command: ReducerCommand) => void,
) {
  switch (state.phase) {
    case "READY":
      return (
        <button className="button" onClick={() => dispatch({ type: "ADVANCE", action: { type: "SEND_ADVERTISER_PROPOSAL" } })} type="button">
          광고주 제안 v1 보내기
        </button>
      );
    case "PROPOSAL_V1":
      return (
        <button className="button" onClick={() => dispatch({ type: "ADVANCE", action: { type: "SEND_CREATOR_COUNTEROFFER" } })} type="button">
          크리에이터 역제안 v2 보내기
        </button>
      );
    case "AWAITING_PARTY_ACCEPTANCE":
      return (
        <div className="deal-demo__acceptance-actions">
          <button
            className="button button--secondary"
            disabled={state.advertiserAccepted}
            onClick={() => dispatch({ type: "ADVANCE", action: { type: "ACCEPT_ADVERTISER" } })}
            type="button"
          >
            {state.advertiserAccepted ? "광고주 수락 완료" : "광고주가 v2 수락"}
          </button>
          <button
            className="button button--secondary"
            disabled={state.creatorAccepted}
            onClick={() => dispatch({ type: "ADVANCE", action: { type: "ACCEPT_CREATOR" } })}
            type="button"
          >
            {state.creatorAccepted ? "크리에이터 수락 완료" : "크리에이터가 v2 수락"}
          </button>
        </div>
      );
    case "AWAITING_PAYMENT":
      return (
        <div className="deal-demo__payment-panel">
          <fieldset className="deal-demo__payment-methods">
            <legend>샌드박스 간편결제 수단</legend>
            {DEMO_EASY_PAY_METHODS.map((method) => (
              <label className="deal-demo__payment-method" key={method.id}>
                <input
                  checked={state.selectedPaymentMethod === method.id}
                  name="sandbox-easy-pay"
                  onChange={() => dispatch({
                    type: "ADVANCE",
                    action: { type: "SELECT_SANDBOX_PAYMENT_METHOD", method: method.id },
                  })}
                  type="radio"
                  value={method.id}
                />
                <span>{method.label}</span>
              </label>
            ))}
          </fieldset>
          <button
            className="button"
            disabled={state.selectedPaymentMethod === null}
            onClick={() => dispatch({ type: "ADVANCE", action: { type: "CONFIRM_SANDBOX_PAYMENT" } })}
            type="button"
          >
            실제 청구 없이 샌드박스 확인
          </button>
        </div>
      );
    case "IN_PRODUCTION":
      return <button className="button" onClick={() => dispatch({ type: "ADVANCE", action: { type: "SUBMIT_DRAFT" } })} type="button">초안 v1 제출</button>;
    case "DRAFT_SUBMITTED":
      return <button className="button" onClick={() => dispatch({ type: "ADVANCE", action: { type: "REQUEST_REVISION" } })} type="button">계약 범위 안에서 수정 요청</button>;
    case "REVISION_REQUESTED":
      return <button className="button" onClick={() => dispatch({ type: "ADVANCE", action: { type: "RESUBMIT_DRAFT" } })} type="button">수정본 v2 재제출</button>;
    case "DRAFT_RESUBMITTED":
      return <button className="button" onClick={() => dispatch({ type: "ADVANCE", action: { type: "APPROVE_FINAL" } })} type="button">광고주 최종 승인</button>;
    case "FINAL_APPROVED":
      return <button className="button" onClick={() => dispatch({ type: "ADVANCE", action: { type: "RECORD_PUBLICATION" } })} type="button">게시 완료 기록</button>;
    case "PUBLISHED":
      return <button className="button" onClick={() => dispatch({ type: "ADVANCE", action: { type: "CONFIRM_BUYER" } })} type="button">광고주 구매 확정</button>;
    case "PAYOUT_BLOCKED":
      return (
        <p className="deal-demo__terminal-note">
          구매 확정까지 기록했습니다. 외부 승인 전에는 정산 예약·송금을 실행할 수 없습니다.
        </p>
      );
  }
}

export function DealFlowDemo() {
  const [state, dispatch] = useReducer(dealReducer, undefined, createInitialDemoDealState);
  const copy = phaseCopy[state.phase];
  const latestEvent = state.events.at(-1);
  const activeProgressIndex = progressStages.findIndex((stage) =>
    (stage.phases as readonly DemoDealPhase[]).includes(state.phase),
  );
  const proposal = state.proposalVersion === 2 ? DEMO_PROPOSALS.v2 : DEMO_PROPOSALS.v1;
  const snapshot = state.contractSnapshot;

  return (
    <div className="deal-demo">
      <section className="deal-demo__hero">
        <div>
          <p className="deal-demo__eyebrow">고정된 가상 참여자 · 브라우저 전용</p>
          <h1>제안부터 구매 확정까지<br />안전 거래 흐름 데모</h1>
          <p className="deal-demo__lead">
            실제 크리에이터·주문과 연결하지 않고, 양측 수락과 계약 스냅샷부터 샌드박스 결제·검수·게시 기록까지 한 번에 확인합니다.
          </p>
        </div>
        <div className="deal-demo__safety-card" aria-label="데모 안전 범위">
          <strong>{DEMO_PAYMENT_MODE} ONLY</strong>
          <span>실제 결제 요청·승인·청구 없음</span>
          <span>네트워크·API·로컬 저장소 사용 없음</span>
          <span>라이브 결제 {DEMO_LIVE_PAYMENTS_ENABLED ? "활성" : "비활성"} · 라이브 정산 {DEMO_LIVE_PAYOUTS_ENABLED ? "활성" : "비활성"}</span>
        </div>
      </section>

      <nav aria-label="거래 진행 단계" className="deal-demo__progress">
        <ol>
          {progressStages.map((stage, index) => (
            <li
              aria-current={index === activeProgressIndex ? "step" : undefined}
              className={index <= activeProgressIndex ? "is-active" : undefined}
              key={stage.label}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {stage.label}
            </li>
          ))}
        </ol>
      </nav>

      <div className="deal-demo__workspace">
        <section className="deal-demo__main" aria-labelledby="deal-demo-current-title">
          <header className="deal-demo__current-head">
            <div>
              <p>{copy.eyebrow}</p>
              <h2 id="deal-demo-current-title">{copy.title}</h2>
            </div>
            <span className="deal-demo__version">이벤트 #{state.version}</span>
          </header>

          <div className="deal-demo__party-grid">
            <article>
              <span>광고주</span>
              <strong>{DEMO_DEAL_PARTIES.advertiser.name}</strong>
              <small>{state.advertiserAccepted ? "v2 개별 수락 완료" : "수락 전"}</small>
            </article>
            <article>
              <span>크리에이터</span>
              <strong>{DEMO_DEAL_PARTIES.creator.name}</strong>
              <small>{state.creatorAccepted ? "v2 개별 수락 완료" : "수락 전"}</small>
            </article>
          </div>

          <dl className="deal-demo__terms">
            <div><dt>현재 조건</dt><dd>{state.proposalVersion === 0 ? "제안 전" : `제안 v${proposal.version}`}</dd></div>
            <div><dt>납품물</dt><dd>{proposal.deliverable}</dd></div>
            <div><dt>계약 금액</dt><dd>{state.proposalVersion === 0 ? "—" : formatKrw(proposal.amountKrw)}</dd></div>
            <div><dt>수정 한도</dt><dd>{proposal.revisionLimit}회</dd></div>
          </dl>

          <div className="deal-demo__action-panel">
            {actionPanel(state, dispatch)}
          </div>

          <p aria-atomic="true" aria-live="polite" className="deal-demo__live-status">
            {latestEvent ? `${latestEvent.title}. ${latestEvent.detail}` : "아직 기록된 이벤트가 없습니다."}
          </p>
        </section>

        <aside className="deal-demo__aside">
          <section className="deal-demo__snapshot" aria-labelledby="deal-demo-snapshot-title">
            <div className="deal-demo__aside-head">
              <h2 id="deal-demo-snapshot-title">계약·수수료 스냅샷</h2>
              <span>{snapshot ? "고정 완료" : "양측 수락 후 생성"}</span>
            </div>
            {snapshot ? (
              <>
                <dl>
                  <div><dt>계약 버전</dt><dd>v{snapshot.contractVersion}</dd></div>
                  <div><dt>계약 금액</dt><dd>{formatKrw(snapshot.feeSnapshot.contractAmountKrw)}</dd></div>
                  <div><dt>판매자 수수료</dt><dd>{snapshot.feeSnapshot.sellerFeeBps / 100}% · {formatKrw(snapshot.feeSnapshot.sellerFeeKrw)}</dd></div>
                  <div><dt>광고주 결제액</dt><dd>{formatKrw(snapshot.feeSnapshot.buyerChargeKrw)}</dd></div>
                  <div><dt>크리에이터 예정액</dt><dd>{formatKrw(snapshot.feeSnapshot.creatorReceivableKrw)}</dd></div>
                  <div><dt>반올림 규칙</dt><dd>정수 원 단위 내림</dd></div>
                </dl>
                <div className="deal-demo__digest">
                  <span>{snapshot.digestAlgorithm} 계약 식별 해시</span>
                  <code>{snapshot.digest}</code>
                </div>
              </>
            ) : (
              <p className="deal-demo__empty">광고주와 크리에이터가 v2 조건을 각각 수락하기 전에는 결제 단계와 스냅샷이 생성되지 않습니다.</p>
            )}
          </section>

          <section className="deal-demo__event-log" aria-labelledby="deal-demo-event-title">
            <div className="deal-demo__aside-head">
              <h2 id="deal-demo-event-title">추가 전용 이벤트 기록</h2>
              <span>{state.events.length}건</span>
            </div>
            {state.events.length > 0 ? (
              <ol aria-label="거래 이벤트 기록">
                {[...state.events].reverse().map((event) => (
                  <li key={event.id}>
                    <span>{String(event.sequence).padStart(2, "0")}</span>
                    <div>
                      <strong>{event.title}</strong>
                      <p>{event.detail}</p>
                      <time dateTime={event.occurredAt}>{eventDateFormatter.format(new Date(event.occurredAt))}</time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="deal-demo__empty">첫 제안을 보내면 변경 기록이 순서대로 쌓입니다.</p>
            )}
          </section>
        </aside>
      </div>

      <div className="deal-demo__reset-row">
        <p>{isDemoDealTerminal(state) ? "정산 차단 상태까지 확인했습니다." : "모든 상태는 이 탭의 메모리에만 존재합니다."}</p>
        <button className="button button--quiet button--small" onClick={() => dispatch({ type: "RESET" })} type="button">
          데모 처음부터 다시 시작
        </button>
      </div>
    </div>
  );
}
