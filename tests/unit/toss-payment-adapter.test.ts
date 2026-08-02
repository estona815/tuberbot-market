import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  ProviderConfigurationError,
  TossGeneralPaymentAdapter,
  type FetchLike,
} from "../../src/providers";

function paymentResponse(overrides: Record<string, unknown> = {}) {
  return {
    paymentKey: "toss-payment-key-1",
    orderId: "ORDER_123",
    totalAmount: 1_000_000,
    balanceAmount: 1_000_000,
    status: "DONE",
    approvedAt: "2026-08-02T01:00:00+09:00",
    ...overrides,
  };
}

function fetchQueue(values: readonly Response[]) {
  const queue = [...values];
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetch: FetchLike = async (input, init) => {
    calls.push({ url: String(input), init });
    const response = queue.shift();
    if (response === undefined) throw new Error("unexpected fetch");
    return response;
  };
  return { fetch, calls };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Toss general payment adapter", () => {
  it("fails closed when key prefix and mode differ", () => {
    expect(
      () =>
        new TossGeneralPaymentAdapter({
          secretKey: "live_sk_should_not_be_in_sandbox",
          mode: "SANDBOX",
          fetch: async () => jsonResponse({}),
        }),
    ).toThrow(ProviderConfigurationError);
  });

  it("models client authorization without inventing a server create API", async () => {
    const queue = fetchQueue([]);
    const adapter = new TossGeneralPaymentAdapter({
      secretKey: "test_sk_example",
      mode: "SANDBOX",
      fetch: queue.fetch,
    });
    const creation = await adapter.createPayment({
      paymentId: "local-payment-1",
      providerOrderId: "ORDER_123",
      orderName: "쇼츠 광고",
      amountKrw: 1_000_000n,
      idempotencyKey: "create-toss-1",
    });

    expect(creation.payment.providerPaymentId).toBeNull();
    expect(creation.nextAction.kind).toBe("CLIENT_AUTHORIZATION");
    expect(queue.calls).toHaveLength(0);
    expect(adapter.escrowCapability).toMatchObject({
      supportsProtectedPayment: false,
      supportsServiceTransaction: false,
      contractRequired: true,
    });
  });

  it("confirms with exact amount, Basic secret-key auth and idempotency", async () => {
    const queue = fetchQueue([jsonResponse(paymentResponse())]);
    const adapter = new TossGeneralPaymentAdapter({
      secretKey: "test_sk_example",
      mode: "SANDBOX",
      fetch: queue.fetch,
    });
    const payment = await adapter.confirmPayment({
      paymentId: "local-payment-1",
      providerPaymentId: "toss-payment-key-1",
      providerOrderId: "ORDER_123",
      amountKrw: 1_000_000n,
      idempotencyKey: "confirm-toss-1",
    });

    expect(payment.status).toBe("FUNDED");
    expect(queue.calls[0]?.url).toBe(
      "https://api.tosspayments.com/v1/payments/confirm",
    );
    const headers = queue.calls[0]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("test_sk_example:", "utf8").toString("base64")}`,
    );
    expect(headers["Idempotency-Key"]).toBe("confirm-toss-1");
    expect(JSON.parse(String(queue.calls[0]?.init?.body))).toEqual({
      paymentKey: "toss-payment-key-1",
      orderId: "ORDER_123",
      amount: 1_000_000,
    });
  });

  it("uses the cancel endpoint and includes cancelAmount only for partial refunds", async () => {
    const queue = fetchQueue([
      jsonResponse(
        paymentResponse({
          status: "PARTIAL_CANCELED",
          balanceAmount: 900_000,
        }),
      ),
      jsonResponse(paymentResponse({ status: "CANCELED", balanceAmount: 0 })),
    ]);
    const adapter = new TossGeneralPaymentAdapter({
      secretKey: "test_sk_example",
      mode: "SANDBOX",
      fetch: queue.fetch,
    });

    const partial = await adapter.partialRefund({
      paymentId: "local-payment-1",
      providerPaymentId: "toss-payment-key-1",
      reason: "부분 환불",
      amountKrw: 100_000n,
      idempotencyKey: "cancel-partial-1",
    });
    await adapter.cancelPayment({
      paymentId: "local-payment-1",
      providerPaymentId: "toss-payment-key-1",
      reason: "전액 환불",
      idempotencyKey: "cancel-full-1",
    });

    expect(partial).toMatchObject({
      status: "PARTIALLY_REFUNDED",
      refundedAmountKrw: 100_000n,
    });
    expect(JSON.parse(String(queue.calls[0]?.init?.body))).toEqual({
      cancelReason: "부분 환불",
      cancelAmount: 100_000,
    });
    expect(JSON.parse(String(queue.calls[1]?.init?.body))).toEqual({
      cancelReason: "전액 환불",
    });
  });

  it("treats an unsigned webhook as untrusted until canonical GET matches local facts", async () => {
    const queue = fetchQueue([jsonResponse(paymentResponse())]);
    const adapter = new TossGeneralPaymentAdapter({
      secretKey: "test_sk_example",
      mode: "SANDBOX",
      fetch: queue.fetch,
    });
    const verified = await adapter.verifyWebhook({
      rawBody: JSON.stringify({
        eventType: "PAYMENT_STATUS_CHANGED",
        createdAt: "2026-08-02T01:01:00+09:00",
        data: {
          paymentKey: "toss-payment-key-1",
          orderId: "ORDER_123",
          totalAmount: 1,
          status: "READY",
        },
      }),
      headers: {
        "TossPayments-Webhook-Transmission-Id": "transmission-1",
      },
      expected: {
        paymentId: "local-payment-1",
        providerPaymentId: "toss-payment-key-1",
        providerOrderId: "ORDER_123",
        amountKrw: 1_000_000n,
      },
    });

    expect(verified.verificationMethod).toBe("CANONICAL_GET");
    expect(verified.reportedStatus).toBe("READY");
    expect(verified.canonicalPayment.status).toBe("FUNDED");
    expect(queue.calls[0]?.url).toBe(
      "https://api.tosspayments.com/v1/payments/toss-payment-key-1",
    );
  });

  it("rejects a canonical amount mismatch even when GET succeeds", async () => {
    const queue = fetchQueue([
      jsonResponse(paymentResponse({ totalAmount: 999_999, balanceAmount: 999_999 })),
    ]);
    const adapter = new TossGeneralPaymentAdapter({
      secretKey: "test_sk_example",
      mode: "SANDBOX",
      fetch: queue.fetch,
    });
    await expect(
      adapter.verifyWebhook({
        rawBody: JSON.stringify({
          eventType: "PAYMENT_STATUS_CHANGED",
          createdAt: "2026-08-02T01:01:00+09:00",
          data: { paymentKey: "toss-payment-key-1", status: "DONE" },
        }),
        headers: { "tosspayments-webhook-transmission-id": "transmission-2" },
        expected: {
          paymentId: "local-payment-1",
          providerOrderId: "ORDER_123",
          amountKrw: 1_000_000n,
        },
      }),
    ).rejects.toThrow(/does not match/iu);
  });
});
