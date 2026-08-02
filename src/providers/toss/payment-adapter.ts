import { Buffer } from "node:buffer";

import {
  assertPositiveKrwAmount,
  krwToSafeNumber,
  safeNumberToKrw,
} from "../../domain/money";
import { validateIdempotencyKey } from "../../domain/idempotency";
import {
  ProviderConfigurationError,
  ProviderHttpError,
  ProviderValidationError,
  WebhookVerificationError,
} from "../errors";
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  EscrowCapability,
  NormalizedPaymentEvent,
  PartialRefundRequest,
  PaymentCreation,
  PaymentGateway,
  PaymentWebhookRequest,
  ProviderMode,
  ProviderPayment,
  ProviderPaymentStatus,
  VerifiedPaymentWebhook,
} from "../types";

const TOSS_API_BASE_URL = "https://api.tosspayments.com";
const MAX_WEBHOOK_BYTES = 256 * 1_024;

export const TOSS_ESCROW_CAPABILITY: EscrowCapability = Object.freeze({
  supportsProtectedPayment: false,
  supportsServiceTransaction: false,
  supportsPartialRefundBeforeConfirmation: false,
  supportsBuyerConfirmation: false,
  supportsAutomaticConfirmation: false,
  contractRequired: true,
});

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface TossPaymentAdapterConfig {
  readonly secretKey: string;
  readonly mode: ProviderMode;
  readonly fetch: FetchLike;
}

interface TossPaymentObject {
  readonly paymentKey: string;
  readonly orderId: string;
  readonly totalAmount: number;
  readonly balanceAmount: number;
  readonly status: string;
  readonly approvedAt: string | null;
}

function requireString(
  object: Record<string, unknown>,
  key: string,
  options: { readonly nullable?: boolean } = {},
): string | null {
  const value = object[key];
  if (options.nullable && value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw new ProviderValidationError(`Toss response field ${key} is invalid`);
  }
  return value;
}

function requireSafeAmount(
  object: Record<string, unknown>,
  key: string,
  fallback?: number,
): number {
  const value = object[key] ?? fallback;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new ProviderValidationError(`Toss response field ${key} is invalid`);
  }
  return value as number;
}

function parseObject(value: unknown, source: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProviderValidationError(`${source} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function parseTossPayment(value: unknown): TossPaymentObject {
  const object = parseObject(value, "Toss payment response");
  const totalAmount = requireSafeAmount(object, "totalAmount");
  const balanceAmount = requireSafeAmount(object, "balanceAmount", totalAmount);
  if (balanceAmount > totalAmount) {
    throw new ProviderValidationError("Toss balanceAmount exceeds totalAmount");
  }
  const approvedAt = requireString(object, "approvedAt", { nullable: true });
  if (approvedAt !== null && !Number.isFinite(Date.parse(approvedAt))) {
    throw new ProviderValidationError("Toss approvedAt is invalid");
  }

  return Object.freeze({
    paymentKey: requireString(object, "paymentKey") as string,
    orderId: requireString(object, "orderId") as string,
    totalAmount,
    balanceAmount,
    status: requireString(object, "status") as string,
    approvedAt,
  });
}

function mapTossStatus(status: string): ProviderPaymentStatus {
  switch (status) {
    case "READY":
      return "READY";
    case "IN_PROGRESS":
    case "WAITING_FOR_DEPOSIT":
      return "AUTHORIZED";
    case "DONE":
      return "FUNDED";
    case "CANCELED":
      return "REFUNDED";
    case "PARTIAL_CANCELED":
      return "PARTIALLY_REFUNDED";
    case "ABORTED":
    case "EXPIRED":
      return "FAILED";
    default:
      throw new ProviderValidationError(`Unsupported Toss payment status: ${status}`);
  }
}

function header(
  headers: Readonly<Record<string, string | undefined>>,
  name: string,
): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
}

function parseWebhookBody(rawBody: string): Record<string, unknown> {
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
    throw new WebhookVerificationError("Payment webhook body is too large");
  }
  try {
    return parseObject(JSON.parse(rawBody) as unknown, "Payment webhook");
  } catch (error) {
    if (error instanceof WebhookVerificationError) throw error;
    throw new WebhookVerificationError("Payment webhook body is invalid");
  }
}

function requireWebhookString(
  object: Record<string, unknown>,
  key: string,
): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new WebhookVerificationError(`Payment webhook field ${key} is invalid`);
  }
  return value;
}

export class TossGeneralPaymentAdapter implements PaymentGateway {
  readonly provider = "toss";
  readonly mode: ProviderMode;
  readonly escrowCapability = TOSS_ESCROW_CAPABILITY;
  private readonly fetch: FetchLike;
  private readonly authorization: string;

  constructor(config: TossPaymentAdapterConfig) {
    const expectedPrefix = config.mode === "LIVE" ? "live_sk" : "test_sk";
    if (!config.secretKey.startsWith(expectedPrefix)) {
      throw new ProviderConfigurationError(
        `Toss ${config.mode.toLowerCase()} mode requires a ${expectedPrefix} secret key`,
      );
    }
    this.mode = config.mode;
    this.fetch = config.fetch;
    this.authorization = `Basic ${Buffer.from(`${config.secretKey}:`, "utf8").toString("base64")}`;
  }

  async createPayment(request: CreatePaymentRequest): Promise<PaymentCreation> {
    validateIdempotencyKey(request.idempotencyKey);
    this.validateProviderOrderId(request.providerOrderId);
    if (request.paymentId.trim().length === 0) {
      throw new ProviderValidationError("paymentId is required");
    }
    if (request.orderName.trim().length === 0 || request.orderName.length > 100) {
      throw new ProviderValidationError("orderName must contain 1-100 characters");
    }
    assertPositiveKrwAmount(request.amountKrw);
    const payment = Object.freeze({
      paymentId: request.paymentId,
      providerPaymentId: null,
      providerOrderId: request.providerOrderId,
      amountKrw: request.amountKrw,
      refundedAmountKrw: 0n,
      status: "CREATED" as const,
      rawStatus: "CLIENT_AUTHORIZATION_REQUIRED",
      approvedAt: null,
      mode: this.mode,
    });
    return Object.freeze({
      payment,
      nextAction: Object.freeze({
        kind: "CLIENT_AUTHORIZATION" as const,
        providerOrderId: request.providerOrderId,
        amountKrw: request.amountKrw,
      }),
    });
  }

  async confirmPayment(request: ConfirmPaymentRequest): Promise<ProviderPayment> {
    validateIdempotencyKey(request.idempotencyKey);
    this.validateProviderOrderId(request.providerOrderId);
    this.validatePaymentKey(request.providerPaymentId);
    assertPositiveKrwAmount(request.amountKrw);
    const response = await this.requestJson("/v1/payments/confirm", {
      method: "POST",
      headers: this.jsonHeaders(request.idempotencyKey),
      body: JSON.stringify({
        paymentKey: request.providerPaymentId,
        orderId: request.providerOrderId,
        amount: krwToSafeNumber(request.amountKrw),
      }),
    });
    const payment = this.normalizePayment(response, request.paymentId);
    this.assertCanonicalPayment(payment, {
      paymentId: request.paymentId,
      providerPaymentId: request.providerPaymentId,
      providerOrderId: request.providerOrderId,
      amountKrw: request.amountKrw,
    });
    return payment;
  }

  async getPayment(
    providerPaymentId: string,
    paymentId = providerPaymentId,
  ): Promise<ProviderPayment> {
    this.validatePaymentKey(providerPaymentId);
    const response = await this.requestJson(
      `/v1/payments/${encodeURIComponent(providerPaymentId)}`,
      { method: "GET", headers: this.baseHeaders() },
    );
    return this.normalizePayment(response, paymentId);
  }

  async cancelPayment(request: CancelPaymentRequest): Promise<ProviderPayment> {
    return this.cancel(request, undefined);
  }

  async partialRefund(request: PartialRefundRequest): Promise<ProviderPayment> {
    assertPositiveKrwAmount(request.amountKrw);
    return this.cancel(request, request.amountKrw);
  }

  /**
   * General payment webhooks have no HMAC signature. The untrusted body only
   * selects a payment; status and amount are accepted exclusively from a
   * canonical authenticated GET and compared with local trusted facts.
   */
  async verifyWebhook(
    request: PaymentWebhookRequest,
  ): Promise<VerifiedPaymentWebhook> {
    const body = parseWebhookBody(request.rawBody);
    const eventType = requireWebhookString(body, "eventType");
    const eventCreatedAt = requireWebhookString(body, "createdAt");
    if (!Number.isFinite(Date.parse(eventCreatedAt))) {
      throw new WebhookVerificationError("Payment webhook createdAt is invalid");
    }
    const providerEventId = header(
      request.headers,
      "tosspayments-webhook-transmission-id",
    );
    if (providerEventId === undefined || providerEventId.length === 0) {
      throw new WebhookVerificationError("Payment webhook transmission id is missing");
    }

    let canonicalPayment: ProviderPayment;
    let reportedStatus: string;
    if (eventType === "PAYMENT_STATUS_CHANGED") {
      const data = parseObject(body.data, "Payment webhook data");
      const paymentKey = requireWebhookString(data, "paymentKey");
      reportedStatus = requireWebhookString(data, "status");
      canonicalPayment = await this.getPayment(paymentKey, request.expected.paymentId);
    } else if (eventType === "DEPOSIT_CALLBACK") {
      const orderId = requireWebhookString(body, "orderId");
      reportedStatus = requireWebhookString(body, "status");
      canonicalPayment = await this.getPaymentByOrderId(
        orderId,
        request.expected.paymentId,
      );
    } else {
      throw new WebhookVerificationError(
        `Unsupported general payment webhook event: ${eventType}`,
      );
    }
    this.assertCanonicalPayment(canonicalPayment, request.expected);

    return Object.freeze({
      verified: true,
      verificationMethod: "CANONICAL_GET",
      providerEventId,
      eventType,
      eventCreatedAt,
      reportedStatus,
      canonicalPayment,
    });
  }

  normalizePaymentEvent(
    webhook: VerifiedPaymentWebhook,
  ): NormalizedPaymentEvent {
    return Object.freeze({
      providerEventId: webhook.providerEventId,
      eventType: "PAYMENT_STATUS_CHANGED",
      occurredAt: webhook.eventCreatedAt,
      payment: webhook.canonicalPayment,
    });
  }

  private async cancel(
    request: CancelPaymentRequest,
    cancelAmountKrw: bigint | undefined,
  ): Promise<ProviderPayment> {
    validateIdempotencyKey(request.idempotencyKey);
    this.validatePaymentKey(request.providerPaymentId);
    if (request.reason.trim().length === 0 || request.reason.length > 200) {
      throw new ProviderValidationError("cancel reason must contain 1-200 characters");
    }
    const body: { cancelReason: string; cancelAmount?: number } = {
      cancelReason: request.reason,
    };
    if (cancelAmountKrw !== undefined) {
      body.cancelAmount = krwToSafeNumber(cancelAmountKrw);
    }
    const response = await this.requestJson(
      `/v1/payments/${encodeURIComponent(request.providerPaymentId)}/cancel`,
      {
        method: "POST",
        headers: this.jsonHeaders(request.idempotencyKey),
        body: JSON.stringify(body),
      },
    );
    const payment = this.normalizePayment(response, request.paymentId);
    if (payment.providerPaymentId !== request.providerPaymentId) {
      throw new ProviderValidationError("Toss canceled a different payment");
    }
    return payment;
  }

  private async getPaymentByOrderId(
    providerOrderId: string,
    paymentId: string,
  ): Promise<ProviderPayment> {
    this.validateProviderOrderId(providerOrderId);
    const response = await this.requestJson(
      `/v1/payments/orders/${encodeURIComponent(providerOrderId)}`,
      { method: "GET", headers: this.baseHeaders() },
    );
    return this.normalizePayment(response, paymentId);
  }

  private normalizePayment(value: unknown, paymentId: string): ProviderPayment {
    const payment = parseTossPayment(value);
    return Object.freeze({
      paymentId,
      providerPaymentId: payment.paymentKey,
      providerOrderId: payment.orderId,
      amountKrw: safeNumberToKrw(payment.totalAmount, "totalAmount"),
      refundedAmountKrw: safeNumberToKrw(
        payment.totalAmount - payment.balanceAmount,
        "refundedAmount",
      ),
      status: mapTossStatus(payment.status),
      rawStatus: payment.status,
      approvedAt: payment.approvedAt,
      mode: this.mode,
    });
  }

  private assertCanonicalPayment(
    payment: ProviderPayment,
    expected: PaymentWebhookRequest["expected"],
  ): void {
    if (
      payment.paymentId !== expected.paymentId ||
      payment.providerOrderId !== expected.providerOrderId ||
      payment.amountKrw !== expected.amountKrw ||
      (expected.providerPaymentId !== undefined &&
        payment.providerPaymentId !== expected.providerPaymentId)
    ) {
      throw new WebhookVerificationError(
        "Canonical Toss payment does not match the local payment intent",
      );
    }
  }

  private validateProviderOrderId(orderId: string): void {
    if (!/^[A-Za-z0-9_-]{6,64}$/u.test(orderId)) {
      throw new ProviderValidationError("Toss orderId format is invalid");
    }
  }

  private validatePaymentKey(paymentKey: string): void {
    if (paymentKey.length === 0 || paymentKey.length > 200) {
      throw new ProviderValidationError("Toss paymentKey format is invalid");
    }
  }

  private baseHeaders(): HeadersInit {
    return {
      Accept: "application/json",
      "Accept-Language": "en-US",
      Authorization: this.authorization,
    };
  }

  private jsonHeaders(idempotencyKey: string): HeadersInit {
    return {
      ...this.baseHeaders(),
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    };
  }

  private async requestJson(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetch(`${TOSS_API_BASE_URL}${path}`, init);
    } catch {
      throw new ProviderHttpError(0, "NETWORK_ERROR", "Toss request outcome is unknown");
    }

    let value: unknown;
    try {
      value = JSON.parse(await response.text()) as unknown;
    } catch {
      throw new ProviderHttpError(
        response.status,
        "INVALID_PROVIDER_RESPONSE",
        "Toss returned an invalid response",
      );
    }
    if (!response.ok) {
      const object =
        typeof value === "object" && value !== null && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : undefined;
      const code =
        object !== undefined && typeof object.code === "string"
          ? object.code.slice(0, 100)
          : "TOSS_REQUEST_FAILED";
      throw new ProviderHttpError(response.status, code);
    }
    return value;
  }
}
