import { describe, expect, it } from "vitest";

import {
  assertFeeSnapshotInvariant,
  calculateBpsFloor,
  createFeeSnapshot,
  decideWelcomePromotion,
  krwToSafeNumber,
} from "../../src/domain";

describe("bigint KRW and BPS fee engine", () => {
  it("calculates fees without floating point and floors fractional won", () => {
    expect(calculateBpsFloor(1_000_001n, 1_200)).toBe(120_000n);
    expect(calculateBpsFloor(199n, 500)).toBe(9n);
    expect(() => calculateBpsFloor(100n, 10_001)).toThrow(/10000/u);
    expect(() => calculateBpsFloor(-1n, 100)).toThrow(/non-negative/u);
  });

  it("freezes an immutable rule snapshot at contract acceptance", () => {
    const mutableRule = {
      id: "fee-market-v7",
      version: 7,
      kind: "MARKETPLACE" as const,
      sellerFeeBps: 1_200,
      buyerFeeBps: 0,
      effectiveFrom: "2026-08-01T00:00:00.000Z",
    };
    const snapshot = createFeeSnapshot({
      snapshotId: "fee-snapshot-1",
      orderId: "order-1",
      acceptedAt: "2026-08-02T01:00:00.000Z",
      contractAmountKrw: 1_000_000n,
      rule: mutableRule,
    });
    mutableRule.sellerFeeBps = 2_000;

    expect(snapshot.sellerFeeBps).toBe(1_200);
    expect(snapshot.sellerFeeKrw).toBe(120_000n);
    expect(snapshot.creatorReceivableKrw).toBe(880_000n);
    expect(snapshot.buyerChargeKrw).toBe(1_000_000n);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(() => {
      (snapshot as { sellerFeeBps: number }).sellerFeeBps = 1;
    }).toThrow();
    expect(() => assertFeeSnapshotInvariant(snapshot)).not.toThrow();
  });

  it("snapshots buyer and welcome fees independently", () => {
    const snapshot = createFeeSnapshot({
      snapshotId: "managed-welcome-1",
      orderId: "order-2",
      acceptedAt: "2026-08-02T01:00:00.000Z",
      contractAmountKrw: 1_000_001n,
      appliedSellerFeeBps: 500,
      promotionCode: "WELCOME",
      rule: {
        id: "managed-v1",
        version: 1,
        kind: "MANAGED_CAMPAIGN",
        sellerFeeBps: 1_200,
        buyerFeeBps: 700,
        effectiveFrom: "2026-08-01T00:00:00.000Z",
      },
    });

    expect(snapshot.sellerFeeKrw).toBe(50_000n);
    expect(snapshot.buyerFeeKrw).toBe(70_000n);
    expect(snapshot.buyerChargeKrw).toBe(1_070_001n);
    expect(snapshot.creatorReceivableKrw).toBe(950_001n);
  });

  it("rejects unsafe conversion at the provider boundary", () => {
    expect(krwToSafeNumber(1_000_000n)).toBe(1_000_000);
    expect(() => krwToSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(
      /safe integer/u,
    );
  });
});

describe("welcome promotion decision", () => {
  const base = {
    enabled: true,
    sellerEligible: true,
    completedOrderCount: 1,
    acceptedWelcomeOrderCount: 2,
    completedOrderLimit: 3,
    standardSellerFeeBps: 1_200,
    welcomeSellerFeeBps: 500,
  };

  it("applies the configured welcome rate while a reserved slot remains", () => {
    expect(decideWelcomePromotion(base)).toEqual({
      applied: true,
      reason: "APPLIED",
      sellerFeeBps: 500,
      remainingSlotsBeforeAcceptance: 1,
    });
  });

  it("counts accepted in-flight promotions to avoid concurrent over-grants", () => {
    expect(
      decideWelcomePromotion({ ...base, acceptedWelcomeOrderCount: 3 }),
    ).toMatchObject({
      applied: false,
      reason: "PROMOTION_SLOT_LIMIT_REACHED",
      sellerFeeBps: 1_200,
    });
  });

  it("never lets a misconfigured promotion increase the seller fee", () => {
    expect(
      decideWelcomePromotion({ ...base, welcomeSellerFeeBps: 1_200 }),
    ).toMatchObject({ applied: false, reason: "MISCONFIGURED_RATE" });
  });
});
