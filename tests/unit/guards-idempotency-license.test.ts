import { describe, expect, it } from "vitest";

import {
  decideIdempotentRequest,
  evaluateLicenseExpiry,
  evaluatePayoutEligibility,
  fingerprintIdempotentRequest,
} from "../../src/domain";

describe("idempotency request semantics", () => {
  const now = "2026-08-02T00:00:00.000Z";
  const requestHash = fingerprintIdempotentRequest({
    method: "POST",
    route: "/api/payouts",
    principalId: "finance-1",
    body: { amountKrw: "880000", orderId: "order-1" },
  });

  it("uses canonical request hashing regardless of body key order", () => {
    const other = fingerprintIdempotentRequest({
      method: "post",
      route: "/api/payouts",
      principalId: "finance-1",
      body: { orderId: "order-1", amountKrw: "880000" },
    });
    expect(other).toBe(requestHash);
  });

  it("acquires, replays, detects conflicts and protects in-flight work", () => {
    expect(
      decideIdempotentRequest({
        scope: "POST:/api/payouts:finance-1",
        key: "idem-1",
        requestHash,
        now,
      }),
    ).toMatchObject({ kind: "ACQUIRE" });

    const existing = {
      scope: "POST:/api/payouts:finance-1",
      key: "idem-1",
      requestHash,
      state: "COMPLETED" as const,
      createdAt: now,
      expiresAt: "2026-08-17T00:00:00.000Z",
      response: { payoutId: "payout-1" },
    };
    expect(
      decideIdempotentRequest({
        scope: existing.scope,
        key: existing.key,
        requestHash,
        now,
        existing,
      }),
    ).toEqual({ kind: "REPLAY", response: { payoutId: "payout-1" } });
    expect(
      decideIdempotentRequest({
        scope: existing.scope,
        key: existing.key,
        requestHash: "f".repeat(64),
        now,
        existing,
      }),
    ).toEqual({ kind: "CONFLICT" });
    expect(
      decideIdempotentRequest({
        scope: existing.scope,
        key: existing.key,
        requestHash,
        now,
        existing: { ...existing, state: "PROCESSING", response: undefined },
      }),
    ).toMatchObject({ kind: "IN_PROGRESS" });
  });

  it("allows a fresh acquisition only after the old record expires", () => {
    expect(
      decideIdempotentRequest({
        scope: "scope-1",
        key: "idem-expired",
        requestHash,
        now,
        existing: {
          scope: "scope-1",
          key: "idem-expired",
          requestHash: "0".repeat(64),
          state: "PROCESSING",
          createdAt: "2026-07-01T00:00:00.000Z",
          expiresAt: "2026-08-01T00:00:00.000Z",
        },
      }),
    ).toMatchObject({ kind: "REACQUIRE_EXPIRED" });
  });
});

describe("payout guards", () => {
  const eligibleFacts = {
    payoutsEnabled: true,
    providerContractReady: true,
    sellerPayoutReady: true,
    openDisputeCount: 0,
    riskHold: false,
    chargeback: false,
    reconciliationStatus: "MATCHED" as const,
    requestedAmountKrw: 880_000n,
    creatorPayableBalanceKrw: 880_000n,
    existingPayoutStatus: "NONE" as const,
  };

  it("allows a verified, reconciled, undisputed payable once", () => {
    expect(evaluatePayoutEligibility(eligibleFacts)).toEqual({
      allowed: true,
      reasons: [],
    });
  });

  it("blocks every dispute and reconciliation mismatch before dispatch", () => {
    const result = evaluatePayoutEligibility({
      ...eligibleFacts,
      openDisputeCount: 1,
      reconciliationStatus: "MISMATCH",
      existingPayoutStatus: "PROCESSING",
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "OPEN_DISPUTE",
        "RECONCILIATION_MISMATCH",
        "PAYOUT_ALREADY_IN_FLIGHT",
      ]),
    );
  });

  it("blocks negative economics and unapproved provider capability", () => {
    const result = evaluatePayoutEligibility({
      ...eligibleFacts,
      providerContractReady: false,
      sellerPayoutReady: false,
      requestedAmountKrw: 900_000n,
    });
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "PROVIDER_CONTRACT_REQUIRED",
        "SELLER_VERIFICATION_HOLD",
        "INSUFFICIENT_CREATOR_PAYABLE",
      ]),
    );
  });
});

describe("license expiry helper", () => {
  it("emits only the exact unsent 30/14/3/0-day notice", () => {
    expect(
      evaluateLicenseExpiry({
        perpetual: false,
        endAt: "2026-09-01T00:00:00.000Z",
        now: "2026-08-02T00:00:00.000Z",
      }),
    ).toEqual({ state: "EXPIRING", daysUntilExpiry: 30, noticeDueDays: 30 });
    expect(
      evaluateLicenseExpiry({
        perpetual: false,
        endAt: "2026-09-01T00:00:00.000Z",
        now: "2026-08-02T00:00:00.000Z",
        sentNoticeDays: [30],
      }).noticeDueDays,
    ).toBeNull();
  });

  it("distinguishes perpetual and expired rights", () => {
    expect(
      evaluateLicenseExpiry({
        perpetual: true,
        endAt: null,
        now: "2026-08-02T00:00:00.000Z",
      }).state,
    ).toBe("PERPETUAL");
    expect(
      evaluateLicenseExpiry({
        perpetual: false,
        endAt: "2026-08-01T00:00:00.000Z",
        now: "2026-08-02T00:00:00.000Z",
      }),
    ).toMatchObject({ state: "EXPIRED", noticeDueDays: null });
  });
});
