import type { KrwAmount } from "../domain/money";

export type ProviderMode = "SANDBOX" | "LIVE";

export interface EscrowCapability {
  readonly supportsProtectedPayment: boolean;
  readonly supportsServiceTransaction: boolean;
  readonly supportsPartialRefundBeforeConfirmation: boolean;
  readonly supportsBuyerConfirmation: boolean;
  readonly supportsAutomaticConfirmation: boolean;
  readonly contractRequired: boolean;
}

export type ProviderPaymentStatus =
  | "CREATED"
  | "READY"
  | "AUTHORIZED"
  | "FUNDED"
  | "FAILED"
  | "CANCELED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "CHARGEBACK";

export interface ProviderPayment {
  readonly paymentId: string;
  readonly providerPaymentId: string | null;
  readonly providerOrderId: string;
  readonly amountKrw: KrwAmount;
  readonly refundedAmountKrw: KrwAmount;
  readonly status: ProviderPaymentStatus;
  readonly rawStatus: string;
  readonly approvedAt: string | null;
  readonly mode: ProviderMode;
}

export interface PaymentCreation {
  readonly payment: ProviderPayment;
  readonly nextAction: Readonly<{
    readonly kind: "CLIENT_AUTHORIZATION";
    readonly providerOrderId: string;
    readonly amountKrw: KrwAmount;
  }>;
}

export interface CreatePaymentRequest {
  readonly paymentId: string;
  readonly providerOrderId: string;
  readonly orderName: string;
  readonly amountKrw: KrwAmount;
  readonly idempotencyKey: string;
}

export interface ConfirmPaymentRequest {
  readonly paymentId: string;
  readonly providerPaymentId: string;
  readonly providerOrderId: string;
  readonly amountKrw: KrwAmount;
  readonly idempotencyKey: string;
}

export interface CancelPaymentRequest {
  readonly paymentId: string;
  readonly providerPaymentId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export interface PartialRefundRequest extends CancelPaymentRequest {
  readonly amountKrw: KrwAmount;
}

export interface PaymentWebhookRequest {
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  /** Trusted facts loaded from the local payment intent, never from the webhook. */
  readonly expected: Readonly<{
    paymentId: string;
    providerOrderId: string;
    amountKrw: KrwAmount;
    providerPaymentId?: string;
  }>;
}

export interface VerifiedPaymentWebhook {
  readonly verified: true;
  readonly verificationMethod: "CANONICAL_GET" | "SANDBOX_CANONICAL_LOOKUP";
  readonly providerEventId: string;
  readonly eventType: string;
  readonly eventCreatedAt: string;
  readonly reportedStatus: string;
  readonly canonicalPayment: ProviderPayment;
}

export interface NormalizedPaymentEvent {
  readonly providerEventId: string;
  readonly eventType: "PAYMENT_STATUS_CHANGED";
  readonly occurredAt: string;
  readonly payment: ProviderPayment;
}

export interface PaymentGateway {
  readonly provider: string;
  readonly mode: ProviderMode;
  readonly escrowCapability: EscrowCapability;
  createPayment(request: CreatePaymentRequest): Promise<PaymentCreation>;
  confirmPayment(request: ConfirmPaymentRequest): Promise<ProviderPayment>;
  getPayment(providerPaymentId: string, paymentId?: string): Promise<ProviderPayment>;
  cancelPayment(request: CancelPaymentRequest): Promise<ProviderPayment>;
  partialRefund(request: PartialRefundRequest): Promise<ProviderPayment>;
  verifyWebhook(request: PaymentWebhookRequest): Promise<VerifiedPaymentWebhook>;
  normalizePaymentEvent(
    webhook: VerifiedPaymentWebhook,
  ): NormalizedPaymentEvent;
}

export type SellerBusinessType =
  | "INDIVIDUAL"
  | "INDIVIDUAL_BUSINESS"
  | "CORPORATE";
export type SellerVerificationStatus =
  | "APPROVAL_REQUIRED"
  | "PARTIALLY_APPROVED"
  | "KYC_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

export interface ProviderSeller {
  readonly sellerId: string;
  readonly providerSellerId: string;
  readonly businessType: SellerBusinessType;
  readonly status: SellerVerificationStatus;
  readonly updatedAt: string;
}

export interface RegisterSellerRequest {
  readonly sellerId: string;
  readonly referenceSellerId: string;
  readonly businessType: SellerBusinessType;
  /** Opaque vault/provider token; raw bank values do not cross this interface. */
  readonly payoutProfileToken: string;
  readonly idempotencyKey: string;
}

export interface UpdateSellerRequest {
  readonly sellerId: string;
  readonly providerSellerId: string;
  readonly payoutProfileToken?: string;
  readonly idempotencyKey: string;
}

export interface SellerWebhookRequest {
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly expectedProviderSellerId: string;
}

export interface VerifiedSellerWebhook {
  readonly verified: true;
  readonly providerEventId: string;
  readonly eventCreatedAt: string;
  readonly seller: ProviderSeller;
}

export interface SellerVerificationProvider {
  readonly provider: string;
  readonly mode: ProviderMode;
  registerSeller(request: RegisterSellerRequest): Promise<ProviderSeller>;
  updateSeller(request: UpdateSellerRequest): Promise<ProviderSeller>;
  getSellerStatus(providerSellerId: string): Promise<ProviderSeller>;
  verifyWebhook(request: SellerWebhookRequest): Promise<VerifiedSellerWebhook>;
}

export type PayoutScheduleType = "EXPRESS" | "SCHEDULED";
export type ProviderPayoutStatus =
  | "REQUESTED"
  | "SCHEDULED"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "CANCELED";

export interface ProviderBalance {
  readonly currency: "KRW";
  readonly availableAmountKrw: KrwAmount;
  readonly pendingAmountKrw: KrwAmount;
  readonly checkedAt: string;
}

export interface ProviderPayout {
  readonly payoutId: string;
  readonly providerPayoutId: string;
  readonly providerSellerId: string;
  readonly amountKrw: KrwAmount;
  readonly scheduleType: PayoutScheduleType;
  readonly payoutDate: string | null;
  readonly status: ProviderPayoutStatus;
  readonly rawStatus: string;
  readonly requestedAt: string;
  readonly paidAt: string | null;
}

export interface RequestPayoutRequest {
  readonly payoutId: string;
  readonly providerSellerId: string;
  readonly amountKrw: KrwAmount;
  readonly scheduleType: PayoutScheduleType;
  readonly payoutDate?: string;
  readonly transactionDescription: string;
  readonly idempotencyKey: string;
}

export interface PayoutWebhookRequest {
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly expectedProviderPayoutId: string;
}

export interface VerifiedPayoutWebhook {
  readonly verified: true;
  readonly providerEventId: string;
  readonly eventCreatedAt: string;
  readonly payout: ProviderPayout;
}

export interface NormalizedPayoutEvent {
  readonly providerEventId: string;
  readonly eventType: "PAYOUT_STATUS_CHANGED";
  readonly occurredAt: string;
  readonly payout: ProviderPayout;
}

export interface PayoutProvider {
  readonly provider: string;
  readonly mode: ProviderMode;
  getAvailableBalance(): Promise<ProviderBalance>;
  requestPayout(request: RequestPayoutRequest): Promise<ProviderPayout>;
  cancelPayout(
    providerPayoutId: string,
    idempotencyKey: string,
  ): Promise<ProviderPayout>;
  getPayout(providerPayoutId: string): Promise<ProviderPayout>;
  verifyWebhook(request: PayoutWebhookRequest): Promise<VerifiedPayoutWebhook>;
  normalizePayoutEvent(webhook: VerifiedPayoutWebhook): NormalizedPayoutEvent;
}
