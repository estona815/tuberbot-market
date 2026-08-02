import {
  applyOrderTransition,
  assertLedgerJournalInvariant,
  assertPayoutEligible,
  createContractSnapshot,
  createFeeSnapshot,
  postCreatorPayout,
  postOrderAllocation,
  postPaymentFunded,
  type LedgerTransaction,
  type OrderStatus,
  type OrderWorkflowState,
} from "../domain";
import {
  SandboxPaymentGateway,
  SandboxPayoutProvider,
  SandboxSellerVerificationProvider,
} from "../providers";

export type SandboxVerticalReport = Readonly<{
  mode: "SANDBOX_VERIFIED";
  orderId: string;
  orderStatus: OrderStatus;
  contractSha256: string;
  paymentStatus: string;
  paymentWebhookDeduplicated: boolean;
  sellerStatus: string;
  payoutStatus: string;
  contractAmountKrw: bigint;
  platformFeeKrw: bigint;
  creatorReceivableKrw: bigint;
  ledger: readonly LedgerTransaction[];
  orderEventCount: number;
}>;

/**
 * Executable acceptance flow for the provider/domain boundary. It intentionally
 * uses isolated in-memory sandbox providers; production persistence is exercised
 * separately by the PostgreSQL migration/integration suite.
 */
export async function verifySandboxVerticalFlow(): Promise<SandboxVerticalReport> {
  const fixedNow = new Date("2026-08-02T05:00:00.000Z");
  const now = () => new Date(fixedNow);
  const paymentGateway = new SandboxPaymentGateway({ now, id: (prefix) => `${prefix}_vertical_001` });
  const sellerProvider = new SandboxSellerVerificationProvider({ now, id: (prefix) => `${prefix}_vertical_001` });
  const payoutProvider = new SandboxPayoutProvider({ availableAmountKrw: 10_000_000n }, { now, id: (prefix) => `${prefix}_vertical_001` });
  const orderId = "sandbox-order-vertical-001";
  const contractAmountKrw = 450_000n;
  const timestamp = fixedNow.toISOString();

  const contract = createContractSnapshot({
    contractId: "contract-vertical-001",
    version: 1,
    proposalVersionId: "proposal-version-vertical-001",
    createdAt: timestamp,
    parties: [
      { partyId: "advertiser-vertical-001", role: "ADVERTISER", acceptedAt: timestamp, evidenceId: "clickwrap-advertiser-001" },
      { partyId: "creator-vertical-001", role: "CREATOR", acceptedAt: timestamp, evidenceId: "clickwrap-creator-001" },
    ],
    terms: {
      amountKrw: contractAmountKrw.toString(),
      contentFormat: "YOUTUBE_SHORTS",
      deliverables: 1,
      revisions: 1,
      usageRight: "CREATOR_CHANNEL_PUBLICATION_ONLY",
      advertisingDisclosureRequired: true,
    },
    policies: {
      marketplaceTerms: "draft-2026-08-02",
      refundPolicy: "draft-2026-08-02",
      privacyPolicy: "draft-2026-08-02",
      feeRuleId: "marketplace-default",
      feeRuleVersion: 1,
    },
  });
  const feeSnapshot = createFeeSnapshot({
    snapshotId: "fee-snapshot-vertical-001",
    orderId,
    acceptedAt: timestamp,
    contractAmountKrw,
    rule: {
      id: "marketplace-default",
      version: 1,
      kind: "MARKETPLACE",
      sellerFeeBps: 1_200,
      buyerFeeBps: 0,
      effectiveFrom: timestamp,
    },
  });

  let orderState: OrderWorkflowState = { orderId, status: "AWAITING_PAYMENT", version: 0, updatedAt: timestamp };
  const orderEvents = [];
  function transition(to: OrderStatus, reason: string) {
    const nextVersion = orderState.version + 1;
    const applied = applyOrderTransition(orderState, {
      transitionId: `transition-${nextVersion}`,
      to,
      expectedVersion: orderState.version,
      actorId: "sandbox-system",
      actorType: "SYSTEM",
      reason,
      idempotencyKey: `order-${orderId}-transition-${nextVersion}`,
      occurredAt: timestamp,
    });
    orderState = applied.nextState;
    orderEvents.push(applied.statusEvent);
  }

  const paymentCreation = await paymentGateway.createPayment({
    paymentId: "payment-vertical-001",
    providerOrderId: "TBVERTICAL001",
    orderName: "15초 Shorts 제품 소개",
    amountKrw: feeSnapshot.buyerChargeKrw,
    idempotencyKey: "sandbox-create-vertical-001",
  });
  const providerPaymentId = paymentCreation.payment.providerPaymentId;
  if (providerPaymentId === null) throw new Error("Sandbox payment did not allocate a provider payment ID");
  transition("PAYMENT_PROCESSING", "advertiser submitted sandbox payment authorization");
  const payment = await paymentGateway.confirmPayment({
    paymentId: paymentCreation.payment.paymentId,
    providerPaymentId,
    providerOrderId: paymentCreation.payment.providerOrderId,
    amountKrw: paymentCreation.payment.amountKrw,
    idempotencyKey: "sandbox-confirm-vertical-001",
  });
  const paymentAgain = await paymentGateway.confirmPayment({
    paymentId: paymentCreation.payment.paymentId,
    providerPaymentId,
    providerOrderId: paymentCreation.payment.providerOrderId,
    amountKrw: paymentCreation.payment.amountKrw,
    idempotencyKey: "sandbox-confirm-vertical-001",
  });
  const webhookBody = JSON.stringify({ eventId: "payment-event-vertical-001", paymentKey: providerPaymentId, status: "DONE", createdAt: timestamp });
  const expected = { paymentId: payment.paymentId, providerOrderId: payment.providerOrderId, providerPaymentId, amountKrw: payment.amountKrw };
  const webhook = await paymentGateway.verifyWebhook({ rawBody: webhookBody, headers: {}, expected });
  const duplicateWebhook = await paymentGateway.verifyWebhook({ rawBody: webhookBody, headers: {}, expected });
  const normalizedWebhook = paymentGateway.normalizePaymentEvent(webhook);
  const normalizedDuplicate = paymentGateway.normalizePaymentEvent(duplicateWebhook);
  if (normalizedWebhook.payment.status !== "FUNDED") throw new Error("Canonical payment was not funded");
  transition("FUNDED", "canonical sandbox payment confirmed");

  const ledger: LedgerTransaction[] = [
    postPaymentFunded({ transactionId: "ledger-funded-001", orderId, externalReference: providerPaymentId, idempotencyKey: "ledger-funded-vertical-001", occurredAt: timestamp, amountKrw: feeSnapshot.buyerChargeKrw }),
  ];

  transition("BRIEF_CONFIRMATION_PENDING", "funded order is ready for brief confirmation");
  transition("IN_PRODUCTION", "creator confirmed the brief");
  transition("DRAFT_SUBMITTED", "creator submitted draft version one");
  transition("REVISION_REQUESTED", "advertiser requested one contracted revision");
  transition("DRAFT_SUBMITTED", "creator submitted draft version two");
  transition("FINAL_APPROVAL_PENDING", "advertiser opened final review");
  transition("PUBLISHED", "approved content publication URL was recorded");
  transition("BUYER_CONFIRMATION_PENDING", "publication evidence was accepted");

  ledger.push(postOrderAllocation({ transactionId: "ledger-allocation-001", orderId, externalReference: "buyer-confirmation-vertical-001", idempotencyKey: "ledger-allocation-vertical-001", occurredAt: timestamp, feeSnapshot }));
  const seller = await sellerProvider.registerSeller({ sellerId: "seller-vertical-001", referenceSellerId: "TBSELLER001", businessType: "INDIVIDUAL", payoutProfileToken: "opaque-sandbox-token", idempotencyKey: "sandbox-seller-vertical-001" });
  assertPayoutEligible({
    payoutsEnabled: true,
    providerContractReady: true,
    sellerPayoutReady: seller.status === "APPROVED",
    openDisputeCount: 0,
    riskHold: false,
    chargeback: false,
    reconciliationStatus: "MATCHED",
    requestedAmountKrw: feeSnapshot.creatorReceivableKrw,
    creatorPayableBalanceKrw: feeSnapshot.creatorReceivableKrw,
    existingPayoutStatus: "NONE",
  });
  transition("PAYOUT_SCHEDULED", "sandbox payout eligibility checks passed");
  const payout = await payoutProvider.requestPayout({
    payoutId: "payout-vertical-001",
    providerSellerId: seller.providerSellerId,
    amountKrw: feeSnapshot.creatorReceivableKrw,
    scheduleType: "EXPRESS",
    transactionDescription: "튜버봇광고",
    idempotencyKey: "sandbox-payout-vertical-001",
  });
  transition("PAYOUT_PROCESSING", "sandbox payout request accepted");
  const paidPayout = await payoutProvider.settlePayout(payout.providerPayoutId, "PAID");
  ledger.push(postCreatorPayout({ transactionId: "ledger-payout-001", orderId, externalReference: paidPayout.providerPayoutId, idempotencyKey: "ledger-payout-vertical-001", occurredAt: timestamp, amountKrw: feeSnapshot.creatorReceivableKrw }));
  transition("COMPLETED", "sandbox payout paid and ledger posted");
  assertLedgerJournalInvariant(ledger);

  return Object.freeze({
    mode: "SANDBOX_VERIFIED",
    orderId,
    orderStatus: orderState.status,
    contractSha256: contract.sha256,
    paymentStatus: payment.status,
    paymentWebhookDeduplicated: payment === paymentAgain && normalizedWebhook.providerEventId === normalizedDuplicate.providerEventId,
    sellerStatus: seller.status,
    payoutStatus: paidPayout.status,
    contractAmountKrw,
    platformFeeKrw: feeSnapshot.sellerFeeKrw + feeSnapshot.buyerFeeKrw,
    creatorReceivableKrw: feeSnapshot.creatorReceivableKrw,
    ledger: Object.freeze(ledger),
    orderEventCount: orderEvents.length,
  });
}
