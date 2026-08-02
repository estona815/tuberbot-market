import { assertBasisPoints } from "./money";

export type WelcomePromotionReason =
  | "APPLIED"
  | "DISABLED"
  | "SELLER_INELIGIBLE"
  | "COMPLETED_ORDER_LIMIT_REACHED"
  | "PROMOTION_SLOT_LIMIT_REACHED"
  | "MISCONFIGURED_RATE";

export interface WelcomePromotionContext {
  readonly enabled: boolean;
  readonly sellerEligible: boolean;
  readonly completedOrderCount: number;
  /**
   * Number of immutable order snapshots that already consumed a welcome slot.
   * Include in-flight orders so concurrent acceptances cannot all claim "first 3".
   */
  readonly acceptedWelcomeOrderCount: number;
  readonly completedOrderLimit: number;
  readonly standardSellerFeeBps: number;
  readonly welcomeSellerFeeBps: number;
}

export interface WelcomePromotionDecision {
  readonly applied: boolean;
  readonly reason: WelcomePromotionReason;
  readonly sellerFeeBps: number;
  readonly remainingSlotsBeforeAcceptance: number;
}

function assertCount(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

export function decideWelcomePromotion(
  context: WelcomePromotionContext,
): Readonly<WelcomePromotionDecision> {
  assertCount(context.completedOrderCount, "completedOrderCount");
  assertCount(context.acceptedWelcomeOrderCount, "acceptedWelcomeOrderCount");
  assertCount(context.completedOrderLimit, "completedOrderLimit");
  assertBasisPoints(context.standardSellerFeeBps, "standardSellerFeeBps");
  assertBasisPoints(context.welcomeSellerFeeBps, "welcomeSellerFeeBps");

  const remainingSlots = Math.max(
    0,
    context.completedOrderLimit - context.acceptedWelcomeOrderCount,
  );
  const reject = (
    reason: Exclude<WelcomePromotionReason, "APPLIED">,
  ): Readonly<WelcomePromotionDecision> =>
    Object.freeze({
      applied: false,
      reason,
      sellerFeeBps: context.standardSellerFeeBps,
      remainingSlotsBeforeAcceptance: remainingSlots,
    });

  if (!context.enabled) return reject("DISABLED");
  if (!context.sellerEligible) return reject("SELLER_INELIGIBLE");
  if (context.completedOrderCount >= context.completedOrderLimit) {
    return reject("COMPLETED_ORDER_LIMIT_REACHED");
  }
  if (context.acceptedWelcomeOrderCount >= context.completedOrderLimit) {
    return reject("PROMOTION_SLOT_LIMIT_REACHED");
  }
  if (context.welcomeSellerFeeBps >= context.standardSellerFeeBps) {
    return reject("MISCONFIGURED_RATE");
  }

  return Object.freeze({
    applied: true,
    reason: "APPLIED",
    sellerFeeBps: context.welcomeSellerFeeBps,
    remainingSlotsBeforeAcceptance: remainingSlots,
  });
}
