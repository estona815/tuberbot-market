import {
  assertBasisPoints,
  assertKrwAmount,
  calculateBpsFloor,
  type KrwAmount,
} from "./money";

export type FeeRuleKind =
  | "MARKETPLACE"
  | "MANAGED_CAMPAIGN"
  | "LICENSE_RENEWAL";

export interface FeeRule {
  readonly id: string;
  readonly version: number;
  readonly kind: FeeRuleKind;
  readonly sellerFeeBps: number;
  readonly buyerFeeBps: number;
  readonly effectiveFrom: string;
}

export interface FeeSnapshotInput {
  readonly snapshotId: string;
  readonly orderId: string;
  readonly acceptedAt: string;
  readonly contractAmountKrw: KrwAmount;
  readonly rule: FeeRule;
  readonly appliedSellerFeeBps?: number;
  readonly promotionCode?: "WELCOME";
}

export interface FeeSnapshot {
  readonly snapshotId: string;
  readonly orderId: string;
  readonly acceptedAt: string;
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly ruleKind: FeeRuleKind;
  readonly contractAmountKrw: KrwAmount;
  readonly sellerFeeBps: number;
  readonly buyerFeeBps: number;
  readonly sellerFeeKrw: KrwAmount;
  readonly buyerFeeKrw: KrwAmount;
  readonly buyerChargeKrw: KrwAmount;
  readonly creatorReceivableKrw: KrwAmount;
  readonly rounding: "FLOOR_TO_INTEGER_KRW";
  readonly promotionCode: "WELCOME" | null;
}

function requireNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new TypeError(`${field} must not be empty`);
  }
}

function assertIsoDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new TypeError(`${field} must be an ISO-8601 timestamp`);
  }
}

export function createFeeSnapshot(
  input: FeeSnapshotInput,
): Readonly<FeeSnapshot> {
  requireNonEmpty(input.snapshotId, "snapshotId");
  requireNonEmpty(input.orderId, "orderId");
  requireNonEmpty(input.rule.id, "rule.id");
  assertIsoDate(input.acceptedAt, "acceptedAt");
  assertIsoDate(input.rule.effectiveFrom, "rule.effectiveFrom");
  assertKrwAmount(input.contractAmountKrw, "contractAmountKrw");
  if (!Number.isSafeInteger(input.rule.version) || input.rule.version <= 0) {
    throw new RangeError("rule.version must be a positive safe integer");
  }
  assertBasisPoints(input.rule.sellerFeeBps, "rule.sellerFeeBps");
  assertBasisPoints(input.rule.buyerFeeBps, "rule.buyerFeeBps");

  const sellerFeeBps = input.appliedSellerFeeBps ?? input.rule.sellerFeeBps;
  assertBasisPoints(sellerFeeBps, "appliedSellerFeeBps");
  if (sellerFeeBps > input.rule.sellerFeeBps) {
    throw new RangeError("a promotion cannot increase the seller fee");
  }
  if (input.promotionCode === "WELCOME" && input.appliedSellerFeeBps === undefined) {
    throw new TypeError("WELCOME promotion requires an explicit seller fee rate");
  }

  const sellerFeeKrw = calculateBpsFloor(
    input.contractAmountKrw,
    sellerFeeBps,
  );
  const buyerFeeKrw = calculateBpsFloor(
    input.contractAmountKrw,
    input.rule.buyerFeeBps,
  );

  return Object.freeze({
    snapshotId: input.snapshotId,
    orderId: input.orderId,
    acceptedAt: input.acceptedAt,
    ruleId: input.rule.id,
    ruleVersion: input.rule.version,
    ruleKind: input.rule.kind,
    contractAmountKrw: input.contractAmountKrw,
    sellerFeeBps,
    buyerFeeBps: input.rule.buyerFeeBps,
    sellerFeeKrw,
    buyerFeeKrw,
    buyerChargeKrw: input.contractAmountKrw + buyerFeeKrw,
    creatorReceivableKrw: input.contractAmountKrw - sellerFeeKrw,
    rounding: "FLOOR_TO_INTEGER_KRW",
    promotionCode: input.promotionCode ?? null,
  });
}

export function assertFeeSnapshotInvariant(snapshot: FeeSnapshot): void {
  assertKrwAmount(snapshot.contractAmountKrw, "contractAmountKrw");
  assertKrwAmount(snapshot.sellerFeeKrw, "sellerFeeKrw");
  assertKrwAmount(snapshot.buyerFeeKrw, "buyerFeeKrw");
  assertKrwAmount(snapshot.buyerChargeKrw, "buyerChargeKrw");
  assertKrwAmount(snapshot.creatorReceivableKrw, "creatorReceivableKrw");
  assertBasisPoints(snapshot.sellerFeeBps, "sellerFeeBps");
  assertBasisPoints(snapshot.buyerFeeBps, "buyerFeeBps");

  if (
    snapshot.sellerFeeKrw !==
    calculateBpsFloor(snapshot.contractAmountKrw, snapshot.sellerFeeBps)
  ) {
    throw new Error("seller fee does not match the frozen rate");
  }
  if (
    snapshot.buyerFeeKrw !==
    calculateBpsFloor(snapshot.contractAmountKrw, snapshot.buyerFeeBps)
  ) {
    throw new Error("buyer fee does not match the frozen rate");
  }
  if (
    snapshot.buyerChargeKrw !==
    snapshot.contractAmountKrw + snapshot.buyerFeeKrw
  ) {
    throw new Error("buyer charge invariant failed");
  }
  if (
    snapshot.creatorReceivableKrw !==
    snapshot.contractAmountKrw - snapshot.sellerFeeKrw
  ) {
    throw new Error("creator receivable invariant failed");
  }
}
