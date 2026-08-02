import { randomUUID } from "node:crypto";

import {
  assertKrwAmount,
  assertPositiveKrwAmount,
} from "../domain/money";
import { sha256Hex } from "../domain/contracts";
import { validateIdempotencyKey } from "../domain/idempotency";
import { ProviderValidationError, WebhookVerificationError } from "./errors";
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  EscrowCapability,
  NormalizedPaymentEvent,
  NormalizedPayoutEvent,
  PartialRefundRequest,
  PaymentCreation,
  PaymentGateway,
  PaymentWebhookRequest,
  PayoutProvider,
  PayoutWebhookRequest,
  ProviderBalance,
  ProviderPayment,
  ProviderPayout,
  ProviderSeller,
  RegisterSellerRequest,
  RequestPayoutRequest,
  SellerVerificationProvider,
  SellerWebhookRequest,
  UpdateSellerRequest,
  VerifiedPaymentWebhook,
  VerifiedPayoutWebhook,
  VerifiedSellerWebhook,
} from "./types";

export const SANDBOX_ESCROW_CAPABILITY: EscrowCapability = Object.freeze({
  supportsProtectedPayment: false,
  supportsServiceTransaction: false,
  supportsPartialRefundBeforeConfirmation: true,
  supportsBuyerConfirmation: false,
  supportsAutomaticConfirmation: false,
  contractRequired: false,
});

interface SandboxDependencies {
  readonly now?: () => Date;
  readonly id?: (prefix: string) => string;
}

interface IdempotentResult<T> {
  readonly fingerprint: string;
  readonly value: T;
}

function requireText(value: string, field: string, maxLength = 300): void {
  if (value.trim().length === 0 || value.length > maxLength) {
    throw new ProviderValidationError(
      `${field} must contain 1-${maxLength} characters`,
    );
  }
}

function parseJsonObject(rawBody: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new WebhookVerificationError("Webhook body is not valid JSON");
  }
}

function requiredString(
  object: Record<string, unknown>,
  field: string,
): string {
  const value = object[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new WebhookVerificationError(`Webhook field ${field} is required`);
  }
  return value;
}

class SandboxBase {
  protected readonly now: () => Date;
  protected readonly id: (prefix: string) => string;

  constructor(dependencies: SandboxDependencies = {}) {
    this.now = dependencies.now ?? (() => new Date());
    this.id = dependencies.id ?? ((prefix) => `${prefix}_${randomUUID()}`);
  }

  protected isoNow(): string {
    return this.now().toISOString();
  }
}

export class SandboxPaymentGateway
  extends SandboxBase
  implements PaymentGateway
{
  readonly provider = "sandbox";
  readonly mode = "SANDBOX" as const;
  readonly escrowCapability = SANDBOX_ESCROW_CAPABILITY;
  private readonly payments = new Map<string, ProviderPayment>();
  private readonly creationIdempotency = new Map<
    string,
    IdempotentResult<PaymentCreation>
  >();
  private readonly idempotency = new Map<
    string,
    IdempotentResult<ProviderPayment>
  >();

  async createPayment(request: CreatePaymentRequest): Promise<PaymentCreation> {
    validateIdempotencyKey(request.idempotencyKey);
    requireText(request.paymentId, "paymentId");
    requireText(request.providerOrderId, "providerOrderId", 64);
    requireText(request.orderName, "orderName", 100);
    assertPositiveKrwAmount(request.amountKrw);
    const fingerprint = [
      request.paymentId,
      request.providerOrderId,
      request.orderName,
      request.amountKrw.toString(),
    ].join(":");
    const existing = this.creationIdempotency.get(request.idempotencyKey);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        throw new ProviderValidationError(
          "Idempotency key was reused for a different payment creation",
        );
      }
      return existing.value;
    }
    const providerPaymentId = this.id("sandbox_payment");
    const payment = Object.freeze({
      paymentId: request.paymentId,
      providerPaymentId,
      providerOrderId: request.providerOrderId,
      amountKrw: request.amountKrw,
      refundedAmountKrw: 0n,
      status: "READY" as const,
      rawStatus: "READY",
      approvedAt: null,
      mode: this.mode,
    });
    this.payments.set(providerPaymentId, payment);
    const creation = Object.freeze({
      payment,
      nextAction: Object.freeze({
        kind: "CLIENT_AUTHORIZATION" as const,
        providerOrderId: request.providerOrderId,
        amountKrw: request.amountKrw,
      }),
    });
    this.creationIdempotency.set(request.idempotencyKey, {
      fingerprint,
      value: creation,
    });
    return creation;
  }

  async confirmPayment(request: ConfirmPaymentRequest): Promise<ProviderPayment> {
    validateIdempotencyKey(request.idempotencyKey);
    const fingerprint = [
      "confirm",
      request.paymentId,
      request.providerPaymentId,
      request.providerOrderId,
      request.amountKrw.toString(),
    ].join(":");
    return this.idempotent(request.idempotencyKey, fingerprint, () => {
      const current = this.requirePayment(request.providerPaymentId);
      if (
        current.paymentId !== request.paymentId ||
        current.providerOrderId !== request.providerOrderId ||
        current.amountKrw !== request.amountKrw
      ) {
        throw new ProviderValidationError("Payment confirmation facts do not match");
      }
      if (current.status !== "READY" && current.status !== "AUTHORIZED") {
        throw new ProviderValidationError(`Cannot confirm payment in ${current.status}`);
      }
      const payment = Object.freeze({
        ...current,
        status: "FUNDED" as const,
        rawStatus: "DONE",
        approvedAt: this.isoNow(),
      });
      this.payments.set(request.providerPaymentId, payment);
      return payment;
    });
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPayment> {
    return this.requirePayment(providerPaymentId);
  }

  async cancelPayment(request: CancelPaymentRequest): Promise<ProviderPayment> {
    validateIdempotencyKey(request.idempotencyKey);
    requireText(request.reason, "reason", 200);
    const fingerprint = ["cancel", request.providerPaymentId, request.reason].join(":");
    return this.idempotent(request.idempotencyKey, fingerprint, () => {
      const current = this.requirePayment(request.providerPaymentId);
      if (current.paymentId !== request.paymentId) {
        throw new ProviderValidationError("paymentId does not match");
      }
      const wasFunded =
        current.status === "FUNDED" || current.status === "PARTIALLY_REFUNDED";
      if (!wasFunded && current.status !== "READY" && current.status !== "AUTHORIZED") {
        throw new ProviderValidationError(`Cannot cancel payment in ${current.status}`);
      }
      const payment = Object.freeze({
        ...current,
        refundedAmountKrw: wasFunded ? current.amountKrw : 0n,
        status: wasFunded ? ("REFUNDED" as const) : ("CANCELED" as const),
        rawStatus: "CANCELED",
      });
      this.payments.set(request.providerPaymentId, payment);
      return payment;
    });
  }

  async partialRefund(request: PartialRefundRequest): Promise<ProviderPayment> {
    validateIdempotencyKey(request.idempotencyKey);
    requireText(request.reason, "reason", 200);
    assertPositiveKrwAmount(request.amountKrw);
    const fingerprint = [
      "partial-refund",
      request.providerPaymentId,
      request.amountKrw.toString(),
      request.reason,
    ].join(":");
    return this.idempotent(request.idempotencyKey, fingerprint, () => {
      const current = this.requirePayment(request.providerPaymentId);
      if (current.paymentId !== request.paymentId) {
        throw new ProviderValidationError("paymentId does not match");
      }
      if (current.status !== "FUNDED" && current.status !== "PARTIALLY_REFUNDED") {
        throw new ProviderValidationError(`Cannot refund payment in ${current.status}`);
      }
      const refundedAmountKrw = current.refundedAmountKrw + request.amountKrw;
      if (refundedAmountKrw > current.amountKrw) {
        throw new ProviderValidationError("Refund exceeds the funded amount");
      }
      const fullyRefunded = refundedAmountKrw === current.amountKrw;
      const payment = Object.freeze({
        ...current,
        refundedAmountKrw,
        status: fullyRefunded
          ? ("REFUNDED" as const)
          : ("PARTIALLY_REFUNDED" as const),
        rawStatus: fullyRefunded ? "CANCELED" : "PARTIAL_CANCELED",
      });
      this.payments.set(request.providerPaymentId, payment);
      return payment;
    });
  }

  async verifyWebhook(
    request: PaymentWebhookRequest,
  ): Promise<VerifiedPaymentWebhook> {
    const body = parseJsonObject(request.rawBody);
    const providerEventId = requiredString(body, "eventId");
    const providerPaymentId = requiredString(body, "paymentKey");
    const eventCreatedAt = requiredString(body, "createdAt");
    const payment = this.requirePayment(providerPaymentId);
    if (
      payment.paymentId !== request.expected.paymentId ||
      payment.providerOrderId !== request.expected.providerOrderId ||
      payment.amountKrw !== request.expected.amountKrw ||
      (request.expected.providerPaymentId !== undefined &&
        request.expected.providerPaymentId !== providerPaymentId)
    ) {
      throw new WebhookVerificationError("Canonical payment facts do not match");
    }
    return Object.freeze({
      verified: true,
      verificationMethod: "SANDBOX_CANONICAL_LOOKUP",
      providerEventId,
      eventType: "PAYMENT_STATUS_CHANGED",
      eventCreatedAt,
      reportedStatus: typeof body.status === "string" ? body.status : payment.rawStatus,
      canonicalPayment: payment,
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

  private requirePayment(providerPaymentId: string): ProviderPayment {
    const payment = this.payments.get(providerPaymentId);
    if (payment === undefined) {
      throw new ProviderValidationError("Payment was not found");
    }
    return payment;
  }

  private idempotent(
    key: string,
    fingerprint: string,
    operation: () => ProviderPayment,
  ): ProviderPayment {
    const existing = this.idempotency.get(key);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        throw new ProviderValidationError(
          "Idempotency key was reused for a different request",
        );
      }
      return existing.value;
    }
    const value = operation();
    this.idempotency.set(key, { fingerprint, value });
    return value;
  }
}

export class SandboxSellerVerificationProvider
  extends SandboxBase
  implements SellerVerificationProvider
{
  readonly provider = "sandbox";
  readonly mode = "SANDBOX" as const;
  private readonly sellers = new Map<string, ProviderSeller>();
  private readonly idempotency = new Map<
    string,
    IdempotentResult<ProviderSeller>
  >();

  async registerSeller(request: RegisterSellerRequest): Promise<ProviderSeller> {
    validateIdempotencyKey(request.idempotencyKey);
    requireText(request.sellerId, "sellerId");
    requireText(request.referenceSellerId, "referenceSellerId", 20);
    requireText(request.payoutProfileToken, "payoutProfileToken");
    const fingerprint = [
      "register",
      request.sellerId,
      request.referenceSellerId,
      request.businessType,
      sha256Hex(request.payoutProfileToken),
    ].join(":");
    const existing = this.idempotency.get(request.idempotencyKey);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        throw new ProviderValidationError(
          "Idempotency key was reused for a different seller registration",
        );
      }
      return existing.value;
    }
    const providerSellerId = this.id("sandbox_seller");
    const seller = Object.freeze({
      sellerId: request.sellerId,
      providerSellerId,
      businessType: request.businessType,
      status: "APPROVED" as const,
      updatedAt: this.isoNow(),
    });
    this.sellers.set(providerSellerId, seller);
    this.idempotency.set(request.idempotencyKey, { fingerprint, value: seller });
    return seller;
  }

  async updateSeller(request: UpdateSellerRequest): Promise<ProviderSeller> {
    validateIdempotencyKey(request.idempotencyKey);
    if (request.payoutProfileToken !== undefined) {
      requireText(request.payoutProfileToken, "payoutProfileToken");
    }
    const fingerprint = [
      "update",
      request.sellerId,
      request.providerSellerId,
      request.payoutProfileToken === undefined
        ? ""
        : sha256Hex(request.payoutProfileToken),
    ].join(":");
    const existing = this.idempotency.get(request.idempotencyKey);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        throw new ProviderValidationError(
          "Idempotency key was reused for a different seller update",
        );
      }
      return existing.value;
    }
    const current = await this.getSellerStatus(request.providerSellerId);
    if (current.sellerId !== request.sellerId) {
      throw new ProviderValidationError("sellerId does not match");
    }
    const seller = Object.freeze({ ...current, updatedAt: this.isoNow() });
    this.sellers.set(request.providerSellerId, seller);
    this.idempotency.set(request.idempotencyKey, { fingerprint, value: seller });
    return seller;
  }

  async getSellerStatus(providerSellerId: string): Promise<ProviderSeller> {
    const seller = this.sellers.get(providerSellerId);
    if (seller === undefined) throw new ProviderValidationError("Seller was not found");
    return seller;
  }

  async verifyWebhook(request: SellerWebhookRequest): Promise<VerifiedSellerWebhook> {
    const body = parseJsonObject(request.rawBody);
    const providerEventId = requiredString(body, "eventId");
    const providerSellerId = requiredString(body, "sellerId");
    if (providerSellerId !== request.expectedProviderSellerId) {
      throw new WebhookVerificationError("Seller webhook target does not match");
    }
    return Object.freeze({
      verified: true,
      providerEventId,
      eventCreatedAt: requiredString(body, "createdAt"),
      seller: await this.getSellerStatus(providerSellerId),
    });
  }
}

export class SandboxPayoutProvider
  extends SandboxBase
  implements PayoutProvider
{
  readonly provider = "sandbox";
  readonly mode = "SANDBOX" as const;
  private availableAmountKrw: bigint;
  private pendingAmountKrw: bigint;
  private readonly payouts = new Map<string, ProviderPayout>();
  private readonly idempotency = new Map<string, IdempotentResult<ProviderPayout>>();

  constructor(
    initialBalance: { readonly availableAmountKrw: bigint; readonly pendingAmountKrw?: bigint },
    dependencies: SandboxDependencies = {},
  ) {
    super(dependencies);
    assertKrwAmount(initialBalance.availableAmountKrw, "availableAmountKrw");
    assertKrwAmount(initialBalance.pendingAmountKrw ?? 0n, "pendingAmountKrw");
    this.availableAmountKrw = initialBalance.availableAmountKrw;
    this.pendingAmountKrw = initialBalance.pendingAmountKrw ?? 0n;
  }

  async getAvailableBalance(): Promise<ProviderBalance> {
    return Object.freeze({
      currency: "KRW",
      availableAmountKrw: this.availableAmountKrw,
      pendingAmountKrw: this.pendingAmountKrw,
      checkedAt: this.isoNow(),
    });
  }

  async requestPayout(request: RequestPayoutRequest): Promise<ProviderPayout> {
    validateIdempotencyKey(request.idempotencyKey);
    assertPositiveKrwAmount(request.amountKrw);
    requireText(request.payoutId, "payoutId", 50);
    requireText(request.providerSellerId, "providerSellerId", 35);
    requireText(request.transactionDescription, "transactionDescription", 7);
    if (request.scheduleType === "SCHEDULED" && request.payoutDate === undefined) {
      throw new ProviderValidationError("Scheduled payout requires payoutDate");
    }
    if (request.scheduleType === "EXPRESS" && request.payoutDate !== undefined) {
      throw new ProviderValidationError("Express payout must not include payoutDate");
    }
    const fingerprint = [
      request.payoutId,
      request.providerSellerId,
      request.amountKrw.toString(),
      request.scheduleType,
      request.payoutDate ?? "",
    ].join(":");
    const existing = this.idempotency.get(request.idempotencyKey);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        throw new ProviderValidationError(
          "Idempotency key was reused for a different payout",
        );
      }
      return existing.value;
    }
    if (request.amountKrw > this.availableAmountKrw) {
      throw new ProviderValidationError("Insufficient sandbox payout balance");
    }
    const providerPayoutId = this.id("sandbox_payout");
    const payout = Object.freeze({
      payoutId: request.payoutId,
      providerPayoutId,
      providerSellerId: request.providerSellerId,
      amountKrw: request.amountKrw,
      scheduleType: request.scheduleType,
      payoutDate: request.payoutDate ?? null,
      status: request.scheduleType === "SCHEDULED"
        ? ("SCHEDULED" as const)
        : ("REQUESTED" as const),
      rawStatus: "REQUESTED",
      requestedAt: this.isoNow(),
      paidAt: null,
    });
    this.availableAmountKrw -= request.amountKrw;
    this.payouts.set(providerPayoutId, payout);
    this.idempotency.set(request.idempotencyKey, { fingerprint, value: payout });
    return payout;
  }

  async cancelPayout(
    providerPayoutId: string,
    idempotencyKey: string,
  ): Promise<ProviderPayout> {
    validateIdempotencyKey(idempotencyKey);
    const fingerprint = `cancel:${providerPayoutId}`;
    const existing = this.idempotency.get(idempotencyKey);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        throw new ProviderValidationError(
          "Idempotency key was reused for a different payout operation",
        );
      }
      return existing.value;
    }
    const current = await this.getPayout(providerPayoutId);
    if (current.status !== "REQUESTED" && current.status !== "SCHEDULED") {
      throw new ProviderValidationError(`Cannot cancel payout in ${current.status}`);
    }
    const payout = Object.freeze({
      ...current,
      status: "CANCELED" as const,
      rawStatus: "CANCELED",
    });
    this.availableAmountKrw += current.amountKrw;
    this.payouts.set(providerPayoutId, payout);
    this.idempotency.set(idempotencyKey, { fingerprint, value: payout });
    return payout;
  }

  async getPayout(providerPayoutId: string): Promise<ProviderPayout> {
    const payout = this.payouts.get(providerPayoutId);
    if (payout === undefined) throw new ProviderValidationError("Payout was not found");
    return payout;
  }

  async verifyWebhook(request: PayoutWebhookRequest): Promise<VerifiedPayoutWebhook> {
    const body = parseJsonObject(request.rawBody);
    const providerPayoutId = requiredString(body, "payoutId");
    if (providerPayoutId !== request.expectedProviderPayoutId) {
      throw new WebhookVerificationError("Payout webhook target does not match");
    }
    return Object.freeze({
      verified: true,
      providerEventId: requiredString(body, "eventId"),
      eventCreatedAt: requiredString(body, "createdAt"),
      payout: await this.getPayout(providerPayoutId),
    });
  }

  normalizePayoutEvent(webhook: VerifiedPayoutWebhook): NormalizedPayoutEvent {
    return Object.freeze({
      providerEventId: webhook.providerEventId,
      eventType: "PAYOUT_STATUS_CHANGED",
      occurredAt: webhook.eventCreatedAt,
      payout: webhook.payout,
    });
  }

  /** Sandbox-only test control; no equivalent is exposed on the provider interface. */
  async settlePayout(
    providerPayoutId: string,
    outcome: "PAID" | "FAILED",
  ): Promise<ProviderPayout> {
    const current = await this.getPayout(providerPayoutId);
    if (current.status !== "REQUESTED" && current.status !== "SCHEDULED") {
      throw new ProviderValidationError(`Cannot settle payout in ${current.status}`);
    }
    if (outcome === "FAILED") this.availableAmountKrw += current.amountKrw;
    const payout = Object.freeze({
      ...current,
      status: outcome,
      rawStatus: outcome === "PAID" ? "COMPLETED" : "FAILED",
      paidAt: outcome === "PAID" ? this.isoNow() : null,
    });
    this.payouts.set(providerPayoutId, payout);
    return payout;
  }
}
