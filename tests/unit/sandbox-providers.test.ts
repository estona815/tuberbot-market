import { describe, expect, it } from "vitest";

import {
  SandboxPaymentGateway,
  SandboxPayoutProvider,
  SandboxSellerVerificationProvider,
} from "../../src/providers";

function sandboxDependencies() {
  let sequence = 0;
  return {
    now: () => new Date("2026-08-02T00:00:00.000Z"),
    id: (prefix: string) => `${prefix}_${++sequence}`,
  };
}

describe("sandbox payment gateway", () => {
  it("confirms and partially refunds idempotently", async () => {
    const gateway = new SandboxPaymentGateway(sandboxDependencies());
    const creation = await gateway.createPayment({
      paymentId: "payment-1",
      providerOrderId: "ORDER_123",
      orderName: "쇼츠 광고",
      amountKrw: 1_000_000n,
      idempotencyKey: "create-payment-1",
    });
    const providerPaymentId = creation.payment.providerPaymentId;
    expect(providerPaymentId).not.toBeNull();
    if (providerPaymentId === null) throw new Error("sandbox payment id missing");

    const confirmRequest = {
      paymentId: "payment-1",
      providerPaymentId,
      providerOrderId: "ORDER_123",
      amountKrw: 1_000_000n,
      idempotencyKey: "confirm-payment-1",
    };
    const funded = await gateway.confirmPayment(confirmRequest);
    const replay = await gateway.confirmPayment(confirmRequest);
    expect(funded.status).toBe("FUNDED");
    expect(replay).toBe(funded);

    const partial = await gateway.partialRefund({
      paymentId: "payment-1",
      providerPaymentId,
      amountKrw: 100_000n,
      reason: "분쟁 부분 환불",
      idempotencyKey: "refund-payment-1",
    });
    expect(partial).toMatchObject({
      status: "PARTIALLY_REFUNDED",
      refundedAmountKrw: 100_000n,
    });
  });

  it("rejects an idempotency key reused with different payment facts", async () => {
    const gateway = new SandboxPaymentGateway(sandboxDependencies());
    const creation = await gateway.createPayment({
      paymentId: "payment-1",
      providerOrderId: "ORDER_123",
      orderName: "광고",
      amountKrw: 100_000n,
      idempotencyKey: "create-payment-1",
    });
    const providerPaymentId = creation.payment.providerPaymentId;
    if (providerPaymentId === null) throw new Error("sandbox payment id missing");
    await gateway.confirmPayment({
      paymentId: "payment-1",
      providerPaymentId,
      providerOrderId: "ORDER_123",
      amountKrw: 100_000n,
      idempotencyKey: "same-key",
    });
    await expect(
      gateway.confirmPayment({
        paymentId: "payment-1",
        providerPaymentId,
        providerOrderId: "ORDER_123",
        amountKrw: 99_999n,
        idempotencyKey: "same-key",
      }),
    ).rejects.toThrow(/different request/iu);
  });

  it("verifies a sandbox webhook against canonical stored facts", async () => {
    const gateway = new SandboxPaymentGateway(sandboxDependencies());
    const creation = await gateway.createPayment({
      paymentId: "payment-webhook",
      providerOrderId: "ORDER_WEBHOOK",
      orderName: "광고",
      amountKrw: 200_000n,
      idempotencyKey: "create-payment-webhook",
    });
    const providerPaymentId = creation.payment.providerPaymentId;
    if (providerPaymentId === null) throw new Error("sandbox payment id missing");

    const verified = await gateway.verifyWebhook({
      rawBody: JSON.stringify({
        eventId: "sandbox-event-1",
        paymentKey: providerPaymentId,
        createdAt: "2026-08-02T00:00:00.000Z",
        status: "READY",
      }),
      headers: {},
      expected: {
        paymentId: "payment-webhook",
        providerOrderId: "ORDER_WEBHOOK",
        amountKrw: 200_000n,
        providerPaymentId,
      },
    });
    expect(verified.verificationMethod).toBe("SANDBOX_CANONICAL_LOOKUP");
    expect(gateway.normalizePaymentEvent(verified).providerEventId).toBe(
      "sandbox-event-1",
    );
  });
});

describe("sandbox seller and payout adapters", () => {
  it("registers only an opaque payout profile token and simulates one payout", async () => {
    const dependencies = sandboxDependencies();
    const sellers = new SandboxSellerVerificationProvider(dependencies);
    const seller = await sellers.registerSeller({
      sellerId: "creator-1",
      referenceSellerId: "SELLER01",
      businessType: "CORPORATE",
      payoutProfileToken: "vault-token-not-an-account-number",
      idempotencyKey: "register-seller-1",
    });
    expect(seller.status).toBe("APPROVED");
    expect(seller).not.toHaveProperty("payoutProfileToken");

    const payouts = new SandboxPayoutProvider(
      { availableAmountKrw: 1_000_000n },
      dependencies,
    );
    const request = {
      payoutId: "payout-local-1",
      providerSellerId: seller.providerSellerId,
      amountKrw: 880_000n,
      scheduleType: "EXPRESS" as const,
      transactionDescription: "튜버봇",
      idempotencyKey: "payout-idem-1",
    };
    const payout = await payouts.requestPayout(request);
    const replay = await payouts.requestPayout(request);
    expect(replay).toBe(payout);
    expect((await payouts.getAvailableBalance()).availableAmountKrw).toBe(120_000n);

    const paid = await payouts.settlePayout(payout.providerPayoutId, "PAID");
    expect(paid.status).toBe("PAID");
    const verified = await payouts.verifyWebhook({
      rawBody: JSON.stringify({
        eventId: "payout-event-1",
        payoutId: payout.providerPayoutId,
        createdAt: "2026-08-02T00:00:00.000Z",
      }),
      headers: {},
      expectedProviderPayoutId: payout.providerPayoutId,
    });
    expect(payouts.normalizePayoutEvent(verified).payout.status).toBe("PAID");
  });

  it("returns reserved funds when the sandbox provider fails", async () => {
    const payouts = new SandboxPayoutProvider(
      { availableAmountKrw: 500_000n },
      sandboxDependencies(),
    );
    const payout = await payouts.requestPayout({
      payoutId: "payout-local-2",
      providerSellerId: "sandbox-seller-1",
      amountKrw: 300_000n,
      scheduleType: "SCHEDULED",
      payoutDate: "2026-08-04",
      transactionDescription: "튜버봇",
      idempotencyKey: "payout-idem-2",
    });
    await payouts.settlePayout(payout.providerPayoutId, "FAILED");
    expect((await payouts.getAvailableBalance()).availableAmountKrw).toBe(500_000n);
  });
});
