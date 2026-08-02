import { assertKrwAmount, type KrwAmount } from "./money";

export type ReconciliationStatus = "PENDING" | "MATCHED" | "MISMATCH";
export type ExistingPayoutStatus =
  | "NONE"
  | "SCHEDULED"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "CANCELED";

export type PayoutBlockReason =
  | "PAYOUTS_DISABLED"
  | "PROVIDER_CONTRACT_REQUIRED"
  | "SELLER_VERIFICATION_HOLD"
  | "OPEN_DISPUTE"
  | "RISK_HOLD"
  | "CHARGEBACK"
  | "RECONCILIATION_PENDING"
  | "RECONCILIATION_MISMATCH"
  | "NON_POSITIVE_PAYOUT"
  | "INSUFFICIENT_CREATOR_PAYABLE"
  | "PAYOUT_ALREADY_IN_FLIGHT"
  | "PAYOUT_ALREADY_PAID";

export interface PayoutGuardFacts {
  readonly payoutsEnabled: boolean;
  readonly providerContractReady: boolean;
  readonly sellerPayoutReady: boolean;
  readonly openDisputeCount: number;
  readonly riskHold: boolean;
  readonly chargeback: boolean;
  readonly reconciliationStatus: ReconciliationStatus;
  readonly requestedAmountKrw: KrwAmount;
  readonly creatorPayableBalanceKrw: KrwAmount;
  readonly existingPayoutStatus: ExistingPayoutStatus;
}

export interface PayoutEligibility {
  readonly allowed: boolean;
  readonly reasons: readonly PayoutBlockReason[];
}

export class PayoutBlockedError extends Error {
  readonly reasons: readonly PayoutBlockReason[];

  constructor(reasons: readonly PayoutBlockReason[]) {
    super(`Payout blocked: ${reasons.join(", ")}`);
    this.name = "PayoutBlockedError";
    this.reasons = reasons;
  }
}

export function evaluatePayoutEligibility(
  facts: PayoutGuardFacts,
): Readonly<PayoutEligibility> {
  assertKrwAmount(facts.requestedAmountKrw, "requestedAmountKrw");
  assertKrwAmount(facts.creatorPayableBalanceKrw, "creatorPayableBalanceKrw");
  if (!Number.isSafeInteger(facts.openDisputeCount) || facts.openDisputeCount < 0) {
    throw new RangeError("openDisputeCount must be a non-negative safe integer");
  }

  const reasons: PayoutBlockReason[] = [];
  if (!facts.payoutsEnabled) reasons.push("PAYOUTS_DISABLED");
  if (!facts.providerContractReady) reasons.push("PROVIDER_CONTRACT_REQUIRED");
  if (!facts.sellerPayoutReady) reasons.push("SELLER_VERIFICATION_HOLD");
  if (facts.openDisputeCount > 0) reasons.push("OPEN_DISPUTE");
  if (facts.riskHold) reasons.push("RISK_HOLD");
  if (facts.chargeback) reasons.push("CHARGEBACK");
  if (facts.reconciliationStatus === "PENDING") {
    reasons.push("RECONCILIATION_PENDING");
  } else if (facts.reconciliationStatus === "MISMATCH") {
    reasons.push("RECONCILIATION_MISMATCH");
  }
  if (facts.requestedAmountKrw <= 0n) reasons.push("NON_POSITIVE_PAYOUT");
  if (facts.requestedAmountKrw > facts.creatorPayableBalanceKrw) {
    reasons.push("INSUFFICIENT_CREATOR_PAYABLE");
  }
  if (
    facts.existingPayoutStatus === "SCHEDULED" ||
    facts.existingPayoutStatus === "PROCESSING"
  ) {
    reasons.push("PAYOUT_ALREADY_IN_FLIGHT");
  } else if (facts.existingPayoutStatus === "PAID") {
    reasons.push("PAYOUT_ALREADY_PAID");
  }

  return Object.freeze({
    allowed: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}

export function assertPayoutEligible(facts: PayoutGuardFacts): void {
  const eligibility = evaluatePayoutEligibility(facts);
  if (!eligibility.allowed) throw new PayoutBlockedError(eligibility.reasons);
}
