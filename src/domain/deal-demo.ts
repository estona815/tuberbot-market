import {
  createFeeSnapshot,
  type FeeSnapshot,
} from "./fees";

export const DEMO_DEAL_ID = "DEMO-DEAL-2026-001";
export const DEMO_PAYMENT_MODE = "SANDBOX" as const;
export const DEMO_LIVE_PAYMENTS_ENABLED = false;
export const DEMO_LIVE_PAYOUTS_ENABLED = false;

export const DEMO_EASY_PAY_METHODS = Object.freeze([
  Object.freeze({ id: "TOSS_PAY", label: "Toss Pay" }),
  Object.freeze({ id: "KAKAO_PAY", label: "Kakao Pay" }),
  Object.freeze({ id: "NAVER_PAY", label: "Naver Pay" }),
] as const);

export type DemoEasyPayMethod = (typeof DEMO_EASY_PAY_METHODS)[number]["id"];

export const DEMO_DEAL_PARTIES = Object.freeze({
  advertiser: Object.freeze({
    id: "DEMO-ADVERTISER-001",
    name: "튜버봇 데모 광고주",
  }),
  creator: Object.freeze({
    id: "DEMO-CREATOR-001",
    name: "튜버봇 데모 크리에이터",
  }),
  scope: "FICTIONAL_DEMO_ONLY",
} as const);

export const DEMO_PROPOSALS = Object.freeze({
  v1: Object.freeze({
    version: 1,
    amountKrw: 1_500_000n,
    deliverable: "유튜브 쇼츠 1편",
    revisionLimit: 1,
    publicationWindow: "최종 승인 후 7일 이내",
  }),
  v2: Object.freeze({
    version: 2,
    amountKrw: 1_650_000n,
    deliverable: "유튜브 쇼츠 1편",
    revisionLimit: 1,
    publicationWindow: "최종 승인 후 7일 이내",
  }),
} as const);

/**
 * SHA-256 of the versioned, canonical demo contract value below. It is fixed so
 * the browser demo never needs crypto APIs, secrets, or a server request.
 */
export const DEMO_CONTRACT_CANONICAL_VALUE =
  "demo-contract-v2|DEMO-DEAL-2026-001|1650000|1200|0|1|2026-08-02T01:08:00.000Z";
export const DEMO_CONTRACT_SHA256 =
  "f89fbece7d589aa8c69160c4277bdefa43fcf9878931988500a43711b1701a76";

export const DEMO_DEAL_PHASES = [
  "READY",
  "PROPOSAL_V1",
  "AWAITING_PARTY_ACCEPTANCE",
  "AWAITING_PAYMENT",
  "IN_PRODUCTION",
  "DRAFT_SUBMITTED",
  "REVISION_REQUESTED",
  "DRAFT_RESUBMITTED",
  "FINAL_APPROVED",
  "PUBLISHED",
  "PAYOUT_BLOCKED",
] as const;

export type DemoDealPhase = (typeof DEMO_DEAL_PHASES)[number];
export type DemoDealActor =
  | "ADVERTISER"
  | "CREATOR"
  | "SANDBOX_PROVIDER"
  | "SYSTEM";

export type DemoDealEventKind =
  | "ADVERTISER_PROPOSAL_SENT"
  | "CREATOR_COUNTEROFFER_SENT"
  | "ADVERTISER_ACCEPTED"
  | "CREATOR_ACCEPTED"
  | "CONTRACT_SNAPSHOT_CREATED"
  | "SANDBOX_PAYMENT_METHOD_SELECTED"
  | "SANDBOX_PAYMENT_CONFIRMED"
  | "DRAFT_SUBMITTED"
  | "REVISION_REQUESTED"
  | "DRAFT_RESUBMITTED"
  | "FINAL_APPROVED"
  | "PUBLICATION_RECORDED"
  | "BUYER_CONFIRMED_PAYOUT_BLOCKED";

export interface DemoDealEvent {
  readonly id: string;
  readonly sequence: number;
  readonly kind: DemoDealEventKind;
  readonly actor: DemoDealActor;
  readonly phase: DemoDealPhase;
  readonly title: string;
  readonly detail: string;
  readonly occurredAt: string;
}

export interface DemoContractSnapshot {
  readonly contractId: string;
  readonly contractVersion: 2;
  readonly acceptedAt: string;
  readonly digestAlgorithm: "SHA-256";
  readonly digest: string;
  readonly canonicalValue: string;
  readonly deliverable: string;
  readonly revisionLimit: number;
  readonly publicationWindow: string;
  readonly feeSnapshot: Readonly<FeeSnapshot>;
}

export interface DemoDealState {
  readonly dealId: typeof DEMO_DEAL_ID;
  readonly phase: DemoDealPhase;
  readonly version: number;
  readonly proposalVersion: 0 | 1 | 2;
  readonly advertiserAccepted: boolean;
  readonly creatorAccepted: boolean;
  readonly selectedPaymentMethod: DemoEasyPayMethod | null;
  readonly contractSnapshot: Readonly<DemoContractSnapshot> | null;
  readonly events: readonly Readonly<DemoDealEvent>[];
}

export type DemoDealAction =
  | Readonly<{ type: "SEND_ADVERTISER_PROPOSAL" }>
  | Readonly<{ type: "SEND_CREATOR_COUNTEROFFER" }>
  | Readonly<{ type: "ACCEPT_ADVERTISER" }>
  | Readonly<{ type: "ACCEPT_CREATOR" }>
  | Readonly<{
      type: "SELECT_SANDBOX_PAYMENT_METHOD";
      method: DemoEasyPayMethod;
    }>
  | Readonly<{ type: "CONFIRM_SANDBOX_PAYMENT" }>
  | Readonly<{ type: "SUBMIT_DRAFT" }>
  | Readonly<{ type: "REQUEST_REVISION" }>
  | Readonly<{ type: "RESUBMIT_DRAFT" }>
  | Readonly<{ type: "APPROVE_FINAL" }>
  | Readonly<{ type: "RECORD_PUBLICATION" }>
  | Readonly<{ type: "CONFIRM_BUYER" }>;

export class InvalidDemoDealTransitionError extends Error {
  constructor(phase: DemoDealPhase, action: DemoDealAction["type"]) {
    super(`Demo deal cannot apply ${action} while in ${phase}`);
    this.name = "InvalidDemoDealTransitionError";
  }
}

const EMPTY_EVENTS: readonly Readonly<DemoDealEvent>[] = Object.freeze([]);
const DEMO_CONTRACT_ACCEPTED_AT = "2026-08-02T01:08:00.000Z";

function freezeState(
  state: Omit<DemoDealState, "dealId">,
): Readonly<DemoDealState> {
  return Object.freeze({ dealId: DEMO_DEAL_ID, ...state });
}

export function createInitialDemoDealState(): Readonly<DemoDealState> {
  return freezeState({
    phase: "READY",
    version: 0,
    proposalVersion: 0,
    advertiserAccepted: false,
    creatorAccepted: false,
    selectedPaymentMethod: null,
    contractSnapshot: null,
    events: EMPTY_EVENTS,
  });
}

function occurredAtFor(sequence: number): string {
  return new Date(Date.UTC(2026, 7, 2, 1, sequence * 2)).toISOString();
}

function appendEvent(
  current: Readonly<DemoDealState>,
  patch: Partial<Omit<DemoDealState, "dealId" | "version" | "events">>,
  event: Readonly<
    Omit<DemoDealEvent, "id" | "sequence" | "occurredAt">
  >,
): Readonly<DemoDealState> {
  const sequence = current.version + 1;
  const nextEvent = Object.freeze({
    ...event,
    id: `demo-event-${sequence}`,
    sequence,
    occurredAt: occurredAtFor(sequence),
  });

  return freezeState({
    phase: patch.phase ?? current.phase,
    version: sequence,
    proposalVersion: patch.proposalVersion ?? current.proposalVersion,
    advertiserAccepted:
      patch.advertiserAccepted ?? current.advertiserAccepted,
    creatorAccepted: patch.creatorAccepted ?? current.creatorAccepted,
    selectedPaymentMethod:
      patch.selectedPaymentMethod === undefined
        ? current.selectedPaymentMethod
        : patch.selectedPaymentMethod,
    contractSnapshot:
      patch.contractSnapshot === undefined
        ? current.contractSnapshot
        : patch.contractSnapshot,
    events: Object.freeze([...current.events, nextEvent]),
  });
}

function createDemoContractSnapshot(): Readonly<DemoContractSnapshot> {
  const feeSnapshot = createFeeSnapshot({
    snapshotId: "DEMO-FEE-SNAPSHOT-V2",
    orderId: DEMO_DEAL_ID,
    acceptedAt: DEMO_CONTRACT_ACCEPTED_AT,
    contractAmountKrw: DEMO_PROPOSALS.v2.amountKrw,
    rule: {
      id: "DEMO-MARKETPLACE-FEE-V1",
      version: 1,
      kind: "MARKETPLACE",
      sellerFeeBps: 1_200,
      buyerFeeBps: 0,
      effectiveFrom: "2026-08-01T00:00:00.000Z",
    },
  });

  return Object.freeze({
    contractId: "DEMO-CONTRACT-V2",
    contractVersion: 2,
    acceptedAt: DEMO_CONTRACT_ACCEPTED_AT,
    digestAlgorithm: "SHA-256",
    digest: DEMO_CONTRACT_SHA256,
    canonicalValue: DEMO_CONTRACT_CANONICAL_VALUE,
    deliverable: DEMO_PROPOSALS.v2.deliverable,
    revisionLimit: DEMO_PROPOSALS.v2.revisionLimit,
    publicationWindow: DEMO_PROPOSALS.v2.publicationWindow,
    feeSnapshot,
  });
}

function assertPhase(
  state: Readonly<DemoDealState>,
  action: DemoDealAction,
  expected: DemoDealPhase,
): void {
  if (state.phase !== expected) {
    throw new InvalidDemoDealTransitionError(state.phase, action.type);
  }
}

function acceptParty(
  current: Readonly<DemoDealState>,
  action: Extract<DemoDealAction, { type: "ACCEPT_ADVERTISER" | "ACCEPT_CREATOR" }>,
): Readonly<DemoDealState> {
  assertPhase(current, action, "AWAITING_PARTY_ACCEPTANCE");
  const isAdvertiser = action.type === "ACCEPT_ADVERTISER";
  if (
    (isAdvertiser && current.advertiserAccepted) ||
    (!isAdvertiser && current.creatorAccepted)
  ) {
    throw new InvalidDemoDealTransitionError(current.phase, action.type);
  }

  const advertiserAccepted = isAdvertiser || current.advertiserAccepted;
  const creatorAccepted = !isAdvertiser || current.creatorAccepted;
  const bothAccepted = advertiserAccepted && creatorAccepted;

  return appendEvent(
    current,
    {
      phase: bothAccepted ? "AWAITING_PAYMENT" : current.phase,
      advertiserAccepted,
      creatorAccepted,
      contractSnapshot: bothAccepted ? createDemoContractSnapshot() : null,
    },
    {
      actor: isAdvertiser ? "ADVERTISER" : "CREATOR",
      kind: bothAccepted
        ? "CONTRACT_SNAPSHOT_CREATED"
        : isAdvertiser
          ? "ADVERTISER_ACCEPTED"
          : "CREATOR_ACCEPTED",
      phase: bothAccepted ? "AWAITING_PAYMENT" : current.phase,
      title: bothAccepted
        ? "양측 수락 · 계약 스냅샷 고정"
        : isAdvertiser
          ? "광고주가 v2 조건을 수락"
          : "크리에이터가 v2 조건을 수락",
      detail: bothAccepted
        ? "두 참여자의 수락을 각각 확인하고 v2 계약·수수료 규칙을 변경 불가 스냅샷으로 고정했습니다."
        : "상대방의 별도 수락이 남아 있어 결제 단계는 열리지 않습니다.",
    },
  );
}

function isPaymentMethod(value: string): value is DemoEasyPayMethod {
  return DEMO_EASY_PAY_METHODS.some((method) => method.id === value);
}

/**
 * A deterministic, browser-safe demo reducer. It performs no I/O and appends one
 * immutable evidence event for every accepted action.
 */
export function applyDemoDealAction(
  current: Readonly<DemoDealState>,
  action: DemoDealAction,
): Readonly<DemoDealState> {
  switch (action.type) {
    case "SEND_ADVERTISER_PROPOSAL":
      assertPhase(current, action, "READY");
      return appendEvent(
        current,
        { phase: "PROPOSAL_V1", proposalVersion: 1 },
        {
          actor: "ADVERTISER",
          kind: "ADVERTISER_PROPOSAL_SENT",
          phase: "PROPOSAL_V1",
          title: "광고주 제안 v1 전달",
          detail: "쇼츠 1편, 1,500,000원 조건을 데모 작업방에 기록했습니다.",
        },
      );

    case "SEND_CREATOR_COUNTEROFFER":
      assertPhase(current, action, "PROPOSAL_V1");
      return appendEvent(
        current,
        {
          phase: "AWAITING_PARTY_ACCEPTANCE",
          proposalVersion: 2,
        },
        {
          actor: "CREATOR",
          kind: "CREATOR_COUNTEROFFER_SENT",
          phase: "AWAITING_PARTY_ACCEPTANCE",
          title: "크리에이터 역제안 v2 전달",
          detail: "동일한 납품 범위에 1,650,000원 조건을 제안하고 양측 수락 대기로 전환했습니다.",
        },
      );

    case "ACCEPT_ADVERTISER":
    case "ACCEPT_CREATOR":
      return acceptParty(current, action);

    case "SELECT_SANDBOX_PAYMENT_METHOD": {
      assertPhase(current, action, "AWAITING_PAYMENT");
      if (!isPaymentMethod(action.method)) {
        throw new TypeError("Unsupported sandbox payment method");
      }
      const label = DEMO_EASY_PAY_METHODS.find(
        (method) => method.id === action.method,
      )?.label;
      return appendEvent(
        current,
        { selectedPaymentMethod: action.method },
        {
          actor: "ADVERTISER",
          kind: "SANDBOX_PAYMENT_METHOD_SELECTED",
          phase: "AWAITING_PAYMENT",
          title: `${label ?? action.method} 선택`,
          detail: "브라우저 안에서만 선택 상태를 기록했습니다. 외부 결제 요청은 발생하지 않았습니다.",
        },
      );
    }

    case "CONFIRM_SANDBOX_PAYMENT":
      assertPhase(current, action, "AWAITING_PAYMENT");
      if (
        current.selectedPaymentMethod === null ||
        current.contractSnapshot === null ||
        !current.advertiserAccepted ||
        !current.creatorAccepted
      ) {
        throw new InvalidDemoDealTransitionError(current.phase, action.type);
      }
      return appendEvent(
        current,
        { phase: "IN_PRODUCTION" },
        {
          actor: "SANDBOX_PROVIDER",
          kind: "SANDBOX_PAYMENT_CONFIRMED",
          phase: "IN_PRODUCTION",
          title: "샌드박스 결제 확인",
          detail: "실제 승인·청구·PG 요청 없이 데모 결제 확인 사실만 기록하고 제작 단계를 열었습니다.",
        },
      );

    case "SUBMIT_DRAFT":
      assertPhase(current, action, "IN_PRODUCTION");
      return appendEvent(
        current,
        { phase: "DRAFT_SUBMITTED" },
        {
          actor: "CREATOR",
          kind: "DRAFT_SUBMITTED",
          phase: "DRAFT_SUBMITTED",
          title: "초안 v1 제출",
          detail: "데모 초안이 검수 대기 상태로 기록되었습니다. 실제 파일 업로드는 하지 않습니다.",
        },
      );

    case "REQUEST_REVISION":
      assertPhase(current, action, "DRAFT_SUBMITTED");
      return appendEvent(
        current,
        { phase: "REVISION_REQUESTED" },
        {
          actor: "ADVERTISER",
          kind: "REVISION_REQUESTED",
          phase: "REVISION_REQUESTED",
          title: "수정 1회 요청",
          detail: "계약에 고정된 수정 한도 1회 안에서 요청을 기록했습니다.",
        },
      );

    case "RESUBMIT_DRAFT":
      assertPhase(current, action, "REVISION_REQUESTED");
      return appendEvent(
        current,
        { phase: "DRAFT_RESUBMITTED" },
        {
          actor: "CREATOR",
          kind: "DRAFT_RESUBMITTED",
          phase: "DRAFT_RESUBMITTED",
          title: "수정본 v2 재제출",
          detail: "수정 반영본을 최종 승인 대기 상태로 기록했습니다.",
        },
      );

    case "APPROVE_FINAL":
      assertPhase(current, action, "DRAFT_RESUBMITTED");
      return appendEvent(
        current,
        { phase: "FINAL_APPROVED" },
        {
          actor: "ADVERTISER",
          kind: "FINAL_APPROVED",
          phase: "FINAL_APPROVED",
          title: "광고주 최종 승인",
          detail: "수정본 v2를 승인하고 게시 기록 단계를 열었습니다.",
        },
      );

    case "RECORD_PUBLICATION":
      assertPhase(current, action, "FINAL_APPROVED");
      return appendEvent(
        current,
        { phase: "PUBLISHED" },
        {
          actor: "CREATOR",
          kind: "PUBLICATION_RECORDED",
          phase: "PUBLISHED",
          title: "게시 완료 기록",
          detail: "데모 게시 사실만 기록했습니다. 외부 유튜브 채널에는 어떤 변경도 하지 않습니다.",
        },
      );

    case "CONFIRM_BUYER":
      assertPhase(current, action, "PUBLISHED");
      return appendEvent(
        current,
        { phase: "PAYOUT_BLOCKED" },
        {
          actor: "ADVERTISER",
          kind: "BUYER_CONFIRMED_PAYOUT_BLOCKED",
          phase: "PAYOUT_BLOCKED",
          title: "구매 확정 · 정산 보류",
          detail: "구매 확정 기록 뒤에도 라이브 정산은 비활성화되어 PAYOUT_BLOCKED에서 종료됩니다.",
        },
      );
  }
}

export function isDemoDealTerminal(state: Readonly<DemoDealState>): boolean {
  return state.phase === "PAYOUT_BLOCKED";
}
