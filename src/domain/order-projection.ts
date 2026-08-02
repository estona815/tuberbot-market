import type { OrderStatus } from "./order-workflow";

export type OrderDisplayPhase =
  | "AGREEMENT"
  | "PAYMENT"
  | "PRODUCTION"
  | "PUBLICATION"
  | "SETTLEMENT"
  | "COMPLETE"
  | "EXCEPTION";

export interface OrderDisplayProjection {
  readonly labelKo: string;
  readonly phase: OrderDisplayPhase;
  readonly progressPercent: number;
  readonly tone: "NEUTRAL" | "INFO" | "SUCCESS" | "WARNING" | "DANGER";
  readonly terminal: boolean;
}

const DISPLAY_PROJECTIONS: Readonly<Record<OrderStatus, OrderDisplayProjection>> =
  Object.freeze({
    DRAFT: { labelKo: "작성 중", phase: "AGREEMENT", progressPercent: 2, tone: "NEUTRAL", terminal: false },
    NEGOTIATING: { labelKo: "조건 협의 중", phase: "AGREEMENT", progressPercent: 8, tone: "INFO", terminal: false },
    AWAITING_PARTY_ACCEPTANCE: { labelKo: "조건 수락 대기", phase: "AGREEMENT", progressPercent: 14, tone: "INFO", terminal: false },
    AWAITING_PAYMENT: { labelKo: "결제 대기", phase: "PAYMENT", progressPercent: 20, tone: "INFO", terminal: false },
    PAYMENT_PROCESSING: { labelKo: "결제 확인 중", phase: "PAYMENT", progressPercent: 25, tone: "INFO", terminal: false },
    FUNDED: { labelKo: "결제 확인", phase: "PAYMENT", progressPercent: 30, tone: "SUCCESS", terminal: false },
    BRIEF_CONFIRMATION_PENDING: { labelKo: "브리프 확인 대기", phase: "PRODUCTION", progressPercent: 35, tone: "INFO", terminal: false },
    IN_PRODUCTION: { labelKo: "콘텐츠 제작 중", phase: "PRODUCTION", progressPercent: 45, tone: "INFO", terminal: false },
    DRAFT_SUBMITTED: { labelKo: "초안 제출", phase: "PRODUCTION", progressPercent: 55, tone: "INFO", terminal: false },
    REVISION_REQUESTED: { labelKo: "수정 요청", phase: "PRODUCTION", progressPercent: 52, tone: "WARNING", terminal: false },
    FINAL_APPROVAL_PENDING: { labelKo: "최종 승인 대기", phase: "PRODUCTION", progressPercent: 65, tone: "INFO", terminal: false },
    SCHEDULED_FOR_PUBLICATION: { labelKo: "게시 예정", phase: "PUBLICATION", progressPercent: 72, tone: "INFO", terminal: false },
    PUBLISHED: { labelKo: "게시 완료", phase: "PUBLICATION", progressPercent: 78, tone: "SUCCESS", terminal: false },
    BUYER_CONFIRMATION_PENDING: { labelKo: "구매 확정 대기", phase: "SETTLEMENT", progressPercent: 84, tone: "INFO", terminal: false },
    PAYOUT_BLOCKED: { labelKo: "정산 보류", phase: "EXCEPTION", progressPercent: 84, tone: "WARNING", terminal: false },
    PAYOUT_SCHEDULED: { labelKo: "정산 예정", phase: "SETTLEMENT", progressPercent: 90, tone: "INFO", terminal: false },
    PAYOUT_PROCESSING: { labelKo: "정산 처리 중", phase: "SETTLEMENT", progressPercent: 95, tone: "INFO", terminal: false },
    COMPLETED: { labelKo: "거래 완료", phase: "COMPLETE", progressPercent: 100, tone: "SUCCESS", terminal: true },
    CANCELLATION_REQUESTED: { labelKo: "취소 요청", phase: "EXCEPTION", progressPercent: 0, tone: "WARNING", terminal: false },
    CANCELED: { labelKo: "취소 완료", phase: "EXCEPTION", progressPercent: 0, tone: "NEUTRAL", terminal: true },
    DISPUTED: { labelKo: "분쟁 검토 중", phase: "EXCEPTION", progressPercent: 0, tone: "DANGER", terminal: false },
    REFUND_PENDING: { labelKo: "환불 처리 중", phase: "EXCEPTION", progressPercent: 0, tone: "WARNING", terminal: false },
    PARTIALLY_REFUNDED: { labelKo: "부분 환불", phase: "EXCEPTION", progressPercent: 0, tone: "WARNING", terminal: false },
    REFUNDED: { labelKo: "환불 완료", phase: "EXCEPTION", progressPercent: 0, tone: "NEUTRAL", terminal: true },
    CHARGEBACK: { labelKo: "결제 이의제기", phase: "EXCEPTION", progressPercent: 0, tone: "DANGER", terminal: true },
    PAYOUT_FAILED: { labelKo: "정산 실패", phase: "EXCEPTION", progressPercent: 90, tone: "DANGER", terminal: false },
  });

/** Display-only projection. It must never be used to authorize workflow changes. */
export function projectOrderStatus(
  status: OrderStatus,
): Readonly<OrderDisplayProjection> {
  return DISPLAY_PROJECTIONS[status];
}
