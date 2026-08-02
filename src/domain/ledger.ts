import {
  assertKrwAmount,
  assertPositiveKrwAmount,
  type KrwAmount,
} from "./money";
import { assertFeeSnapshotInvariant, type FeeSnapshot } from "./fees";

export const LEDGER_ACCOUNT_CODES = [
  "PG_CLEARING",
  "CUSTOMER_PAYMENT_LIABILITY",
  "CREATOR_PAYABLE",
  "PLATFORM_FEE_REVENUE",
  "PAYMENT_PROVIDER_FEE_EXPENSE",
  "REFUND_LIABILITY",
  "CHARGEBACK_LIABILITY",
  "TAX_PAYABLE",
  "PROMOTION_EXPENSE",
] as const;

export type LedgerAccountCode = (typeof LEDGER_ACCOUNT_CODES)[number];
export type LedgerSide = "DEBIT" | "CREDIT";
export type LedgerTransactionKind =
  | "PAYMENT_FUNDED"
  | "ORDER_ALLOCATED"
  | "CREATOR_PAYOUT"
  | "REFUND_UNALLOCATED"
  | "REFUND_ALLOCATED"
  | "PROVIDER_FEE"
  | "REVERSAL";

export interface LedgerEntry {
  readonly account: LedgerAccountCode;
  readonly side: LedgerSide;
  readonly amountKrw: KrwAmount;
}

export interface LedgerTransaction {
  readonly id: string;
  readonly kind: LedgerTransactionKind;
  readonly orderId: string;
  readonly externalReference: string;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
  readonly reversalOf: string | null;
  readonly entries: readonly Readonly<LedgerEntry>[];
}

export class UnbalancedLedgerTransactionError extends Error {
  constructor(debits: bigint, credits: bigint) {
    super(`Ledger transaction is unbalanced: debits=${debits}, credits=${credits}`);
    this.name = "UnbalancedLedgerTransactionError";
  }
}

function assertText(value: string, field: string, maxLength = 300): void {
  if (value.trim().length === 0 || value.length > maxLength) {
    throw new TypeError(`${field} must contain 1-${maxLength} characters`);
  }
}

function assertTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new TypeError("occurredAt must be an ISO-8601 timestamp");
  }
}

export function ledgerTotals(entries: readonly LedgerEntry[]): Readonly<{
  debitsKrw: bigint;
  creditsKrw: bigint;
}> {
  let debitsKrw = 0n;
  let creditsKrw = 0n;
  for (const entry of entries) {
    assertPositiveKrwAmount(entry.amountKrw, "ledger entry amountKrw");
    if (entry.side === "DEBIT") debitsKrw += entry.amountKrw;
    else creditsKrw += entry.amountKrw;
  }
  return Object.freeze({ debitsKrw, creditsKrw });
}

export function assertBalancedEntries(entries: readonly LedgerEntry[]): void {
  if (entries.length < 2) {
    throw new UnbalancedLedgerTransactionError(0n, 0n);
  }
  const totals = ledgerTotals(entries);
  if (totals.debitsKrw !== totals.creditsKrw) {
    throw new UnbalancedLedgerTransactionError(
      totals.debitsKrw,
      totals.creditsKrw,
    );
  }
}

export function createLedgerTransaction(input: {
  readonly id: string;
  readonly kind: LedgerTransactionKind;
  readonly orderId: string;
  readonly externalReference: string;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
  readonly reversalOf?: string;
  readonly entries: readonly LedgerEntry[];
}): Readonly<LedgerTransaction> {
  assertText(input.id, "id");
  assertText(input.orderId, "orderId");
  assertText(input.externalReference, "externalReference");
  assertText(input.idempotencyKey, "idempotencyKey");
  assertTimestamp(input.occurredAt);
  assertBalancedEntries(input.entries);
  if (input.kind === "REVERSAL" && input.reversalOf === undefined) {
    throw new TypeError("REVERSAL transaction requires reversalOf");
  }
  if (input.kind !== "REVERSAL" && input.reversalOf !== undefined) {
    throw new TypeError("only REVERSAL transactions may set reversalOf");
  }
  const entries = input.entries.map((entry) => Object.freeze({ ...entry }));

  return Object.freeze({
    id: input.id,
    kind: input.kind,
    orderId: input.orderId,
    externalReference: input.externalReference,
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    reversalOf: input.reversalOf ?? null,
    entries: Object.freeze(entries),
  });
}

type PostingIdentity = Readonly<{
  transactionId: string;
  orderId: string;
  externalReference: string;
  idempotencyKey: string;
  occurredAt: string;
}>;

export function postPaymentFunded(
  input: PostingIdentity & { readonly amountKrw: KrwAmount },
): Readonly<LedgerTransaction> {
  assertPositiveKrwAmount(input.amountKrw);
  return createLedgerTransaction({
    id: input.transactionId,
    kind: "PAYMENT_FUNDED",
    orderId: input.orderId,
    externalReference: input.externalReference,
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    entries: [
      { account: "PG_CLEARING", side: "DEBIT", amountKrw: input.amountKrw },
      {
        account: "CUSTOMER_PAYMENT_LIABILITY",
        side: "CREDIT",
        amountKrw: input.amountKrw,
      },
    ],
  });
}

export function postOrderAllocation(
  input: PostingIdentity & { readonly feeSnapshot: FeeSnapshot },
): Readonly<LedgerTransaction> {
  assertFeeSnapshotInvariant(input.feeSnapshot);
  assertPositiveKrwAmount(input.feeSnapshot.buyerChargeKrw, "buyerChargeKrw");
  if (input.feeSnapshot.orderId !== input.orderId) {
    throw new Error("fee snapshot belongs to a different order");
  }
  const entries: LedgerEntry[] = [
    {
      account: "CUSTOMER_PAYMENT_LIABILITY",
      side: "DEBIT",
      amountKrw: input.feeSnapshot.buyerChargeKrw,
    },
  ];
  if (input.feeSnapshot.creatorReceivableKrw > 0n) {
    entries.push({
      account: "CREATOR_PAYABLE",
      side: "CREDIT",
      amountKrw: input.feeSnapshot.creatorReceivableKrw,
    });
  }
  const totalPlatformFee =
    input.feeSnapshot.sellerFeeKrw + input.feeSnapshot.buyerFeeKrw;
  if (totalPlatformFee > 0n) {
    entries.push({
      account: "PLATFORM_FEE_REVENUE",
      side: "CREDIT",
      amountKrw: totalPlatformFee,
    });
  }
  return createLedgerTransaction({
    id: input.transactionId,
    kind: "ORDER_ALLOCATED",
    orderId: input.orderId,
    externalReference: input.externalReference,
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    entries,
  });
}

export function postCreatorPayout(
  input: PostingIdentity & { readonly amountKrw: KrwAmount },
): Readonly<LedgerTransaction> {
  assertPositiveKrwAmount(input.amountKrw);
  return createLedgerTransaction({
    id: input.transactionId,
    kind: "CREATOR_PAYOUT",
    orderId: input.orderId,
    externalReference: input.externalReference,
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    entries: [
      {
        account: "CREATOR_PAYABLE",
        side: "DEBIT",
        amountKrw: input.amountKrw,
      },
      { account: "PG_CLEARING", side: "CREDIT", amountKrw: input.amountKrw },
    ],
  });
}

export function postUnallocatedRefund(
  input: PostingIdentity & { readonly amountKrw: KrwAmount },
): Readonly<LedgerTransaction> {
  assertPositiveKrwAmount(input.amountKrw);
  return createLedgerTransaction({
    id: input.transactionId,
    kind: "REFUND_UNALLOCATED",
    orderId: input.orderId,
    externalReference: input.externalReference,
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    entries: [
      {
        account: "CUSTOMER_PAYMENT_LIABILITY",
        side: "DEBIT",
        amountKrw: input.amountKrw,
      },
      { account: "PG_CLEARING", side: "CREDIT", amountKrw: input.amountKrw },
    ],
  });
}

/** Caller supplies the versioned refund policy allocation; no tax rule is assumed. */
export function postAllocatedRefund(
  input: PostingIdentity & {
    readonly creatorPayableReductionKrw: KrwAmount;
    readonly platformFeeReductionKrw: KrwAmount;
  },
): Readonly<LedgerTransaction> {
  assertKrwAmount(
    input.creatorPayableReductionKrw,
    "creatorPayableReductionKrw",
  );
  assertKrwAmount(
    input.platformFeeReductionKrw,
    "platformFeeReductionKrw",
  );
  const refundKrw =
    input.creatorPayableReductionKrw + input.platformFeeReductionKrw;
  assertPositiveKrwAmount(refundKrw, "refundKrw");
  const entries: LedgerEntry[] = [];
  if (input.creatorPayableReductionKrw > 0n) {
    entries.push({
      account: "CREATOR_PAYABLE",
      side: "DEBIT",
      amountKrw: input.creatorPayableReductionKrw,
    });
  }
  if (input.platformFeeReductionKrw > 0n) {
    entries.push({
      account: "PLATFORM_FEE_REVENUE",
      side: "DEBIT",
      amountKrw: input.platformFeeReductionKrw,
    });
  }
  entries.push({ account: "PG_CLEARING", side: "CREDIT", amountKrw: refundKrw });

  return createLedgerTransaction({
    id: input.transactionId,
    kind: "REFUND_ALLOCATED",
    orderId: input.orderId,
    externalReference: input.externalReference,
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    entries,
  });
}

export function reverseLedgerTransaction(input: {
  readonly transactionId: string;
  readonly original: LedgerTransaction;
  readonly externalReference: string;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
}): Readonly<LedgerTransaction> {
  if (input.original.kind === "REVERSAL") {
    throw new Error("a reversal transaction cannot itself be reversed");
  }
  return createLedgerTransaction({
    id: input.transactionId,
    kind: "REVERSAL",
    orderId: input.original.orderId,
    externalReference: input.externalReference,
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    reversalOf: input.original.id,
    entries: input.original.entries.map((entry) => ({
      account: entry.account,
      side: entry.side === "DEBIT" ? "CREDIT" : "DEBIT",
      amountKrw: entry.amountKrw,
    })),
  });
}

export function assertLedgerJournalInvariant(
  transactions: readonly LedgerTransaction[],
): void {
  const ids = new Set<string>();
  const transactionsById = new Map<string, LedgerTransaction>();
  const idempotencyKeys = new Set<string>();
  const reversedIds = new Set<string>();
  for (const transaction of transactions) {
    assertBalancedEntries(transaction.entries);
    if (ids.has(transaction.id)) throw new Error(`duplicate ledger id: ${transaction.id}`);
    if (idempotencyKeys.has(transaction.idempotencyKey)) {
      throw new Error(`duplicate ledger idempotency key: ${transaction.idempotencyKey}`);
    }
    ids.add(transaction.id);
    transactionsById.set(transaction.id, transaction);
    idempotencyKeys.add(transaction.idempotencyKey);
  }
  for (const transaction of transactions) {
    if (transaction.reversalOf === null) continue;
    if (!ids.has(transaction.reversalOf)) {
      throw new Error(`reversal target is missing: ${transaction.reversalOf}`);
    }
    if (reversedIds.has(transaction.reversalOf)) {
      throw new Error(`ledger transaction reversed more than once: ${transaction.reversalOf}`);
    }
    const original = transactionsById.get(transaction.reversalOf);
    if (original === undefined || original.kind === "REVERSAL") {
      throw new Error(`invalid reversal target: ${transaction.reversalOf}`);
    }
    if (transaction.orderId !== original.orderId) {
      throw new Error("reversal and original must belong to the same order");
    }
    const unmatched = [...transaction.entries];
    for (const originalEntry of original.entries) {
      const expectedSide: LedgerSide =
        originalEntry.side === "DEBIT" ? "CREDIT" : "DEBIT";
      const matchIndex = unmatched.findIndex(
        (entry) =>
          entry.account === originalEntry.account &&
          entry.side === expectedSide &&
          entry.amountKrw === originalEntry.amountKrw,
      );
      if (matchIndex < 0) {
        throw new Error(`reversal entries do not mirror: ${transaction.reversalOf}`);
      }
      unmatched.splice(matchIndex, 1);
    }
    if (unmatched.length > 0) {
      throw new Error(`reversal has unexpected entries: ${transaction.reversalOf}`);
    }
    reversedIds.add(transaction.reversalOf);
  }
}
