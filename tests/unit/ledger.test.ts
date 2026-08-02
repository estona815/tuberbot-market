import { describe, expect, it } from "vitest";

import {
  UnbalancedLedgerTransactionError,
  assertLedgerJournalInvariant,
  createFeeSnapshot,
  createLedgerTransaction,
  ledgerTotals,
  postAllocatedRefund,
  postCreatorPayout,
  postOrderAllocation,
  postPaymentFunded,
  reverseLedgerTransaction,
} from "../../src/domain";

const identity = {
  orderId: "order-ledger-1",
  externalReference: "provider-reference-1",
  occurredAt: "2026-08-02T01:00:00.000Z",
};

describe("immutable double-entry ledger", () => {
  const feeSnapshot = createFeeSnapshot({
    snapshotId: "fee-ledger-1",
    orderId: identity.orderId,
    acceptedAt: "2026-08-02T00:00:00.000Z",
    contractAmountKrw: 1_000_000n,
    rule: {
      id: "market-v1",
      version: 1,
      kind: "MARKETPLACE",
      sellerFeeBps: 1_200,
      buyerFeeBps: 0,
      effectiveFrom: "2026-08-01T00:00:00.000Z",
    },
  });

  it("posts funding, fee allocation and payout as balanced templates", () => {
    const funded = postPaymentFunded({
      ...identity,
      transactionId: "ledger-funded-1",
      idempotencyKey: "ledger-idem-funded-1",
      amountKrw: feeSnapshot.buyerChargeKrw,
    });
    const allocation = postOrderAllocation({
      ...identity,
      transactionId: "ledger-allocation-1",
      idempotencyKey: "ledger-idem-allocation-1",
      feeSnapshot,
    });
    const payout = postCreatorPayout({
      ...identity,
      transactionId: "ledger-payout-1",
      idempotencyKey: "ledger-idem-payout-1",
      amountKrw: feeSnapshot.creatorReceivableKrw,
    });

    expect(ledgerTotals(funded.entries)).toEqual({
      debitsKrw: 1_000_000n,
      creditsKrw: 1_000_000n,
    });
    expect(allocation.entries).toEqual([
      {
        account: "CUSTOMER_PAYMENT_LIABILITY",
        side: "DEBIT",
        amountKrw: 1_000_000n,
      },
      { account: "CREATOR_PAYABLE", side: "CREDIT", amountKrw: 880_000n },
      {
        account: "PLATFORM_FEE_REVENUE",
        side: "CREDIT",
        amountKrw: 120_000n,
      },
    ]);
    expect(() => assertLedgerJournalInvariant([funded, allocation, payout])).not.toThrow();
    expect(Object.isFrozen(allocation.entries)).toBe(true);
  });

  it("uses versioned-policy components for an allocated partial refund", () => {
    const refund = postAllocatedRefund({
      ...identity,
      transactionId: "ledger-refund-1",
      idempotencyKey: "ledger-idem-refund-1",
      creatorPayableReductionKrw: 88_000n,
      platformFeeReductionKrw: 12_000n,
    });
    expect(ledgerTotals(refund.entries)).toEqual({
      debitsKrw: 100_000n,
      creditsKrw: 100_000n,
    });
  });

  it("creates an exact append-only reversal", () => {
    const funded = postPaymentFunded({
      ...identity,
      transactionId: "ledger-funded-r",
      idempotencyKey: "ledger-idem-funded-r",
      amountKrw: 500_000n,
    });
    const reversal = reverseLedgerTransaction({
      transactionId: "ledger-reversal-r",
      original: funded,
      externalReference: "refund-r",
      idempotencyKey: "ledger-idem-reversal-r",
      occurredAt: "2026-08-02T02:00:00.000Z",
    });

    expect(reversal.reversalOf).toBe(funded.id);
    expect(reversal.entries[0]?.side).toBe("CREDIT");
    expect(reversal.entries[1]?.side).toBe("DEBIT");
    expect(() => assertLedgerJournalInvariant([funded, reversal])).not.toThrow();
  });

  it("rejects unbalanced or duplicate reversal journals", () => {
    expect(() =>
      createLedgerTransaction({
        ...identity,
        id: "bad-ledger",
        kind: "PAYMENT_FUNDED",
        idempotencyKey: "bad-ledger-idem",
        entries: [
          { account: "PG_CLEARING", side: "DEBIT", amountKrw: 100n },
          {
            account: "CUSTOMER_PAYMENT_LIABILITY",
            side: "CREDIT",
            amountKrw: 99n,
          },
        ],
      }),
    ).toThrow(UnbalancedLedgerTransactionError);

    const original = postPaymentFunded({
      ...identity,
      transactionId: "original-double-reversal",
      idempotencyKey: "original-double-reversal-idem",
      amountKrw: 100n,
    });
    const reverse = (suffix: string) =>
      reverseLedgerTransaction({
        transactionId: `reverse-${suffix}`,
        original,
        externalReference: `reverse-reference-${suffix}`,
        idempotencyKey: `reverse-idem-${suffix}`,
        occurredAt: "2026-08-02T02:00:00.000Z",
      });
    expect(() =>
      assertLedgerJournalInvariant([original, reverse("a"), reverse("b")]),
    ).toThrow(/reversed more than once/iu);
  });
});
