export const ORDER_STATUSES = [
  "DRAFT",
  "NEGOTIATING",
  "AWAITING_PARTY_ACCEPTANCE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
  "FUNDED",
  "BRIEF_CONFIRMATION_PENDING",
  "IN_PRODUCTION",
  "DRAFT_SUBMITTED",
  "REVISION_REQUESTED",
  "FINAL_APPROVAL_PENDING",
  "SCHEDULED_FOR_PUBLICATION",
  "PUBLISHED",
  "BUYER_CONFIRMATION_PENDING",
  "PAYOUT_BLOCKED",
  "PAYOUT_SCHEDULED",
  "PAYOUT_PROCESSING",
  "COMPLETED",
  "CANCELLATION_REQUESTED",
  "CANCELED",
  "DISPUTED",
  "REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "CHARGEBACK",
  "PAYOUT_FAILED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderActorType =
  | "ADVERTISER"
  | "CREATOR"
  | "ADMIN"
  | "SUPPORT"
  | "FINANCE"
  | "RISK"
  | "SYSTEM"
  | "PROVIDER";

export interface OrderWorkflowState {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly version: number;
  readonly updatedAt: string;
}

export interface OrderTransitionCommand {
  readonly transitionId: string;
  readonly to: OrderStatus;
  readonly expectedVersion: number;
  readonly actorId: string;
  readonly actorType: OrderActorType;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
}

export interface OrderStatusEvent {
  readonly id: string;
  readonly orderId: string;
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  readonly orderVersion: number;
  readonly actorId: string;
  readonly actorType: OrderActorType;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
}

export interface OrderTransitionOutboxEvent {
  readonly deduplicationKey: string;
  readonly type: "order.status_changed";
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly payload: Readonly<{
    from: OrderStatus;
    to: OrderStatus;
    transitionId: string;
  }>;
  readonly occurredAt: string;
}

export interface AppliedOrderTransition {
  readonly nextState: Readonly<OrderWorkflowState>;
  readonly statusEvent: Readonly<OrderStatusEvent>;
  readonly outboxEvent: Readonly<OrderTransitionOutboxEvent>;
}

export class InvalidOrderTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Order cannot transition from ${from} to ${to}`);
    this.name = "InvalidOrderTransitionError";
  }
}

export class OrderVersionConflictError extends Error {
  constructor(expected: number, actual: number) {
    super(`Order version conflict: expected ${expected}, actual ${actual}`);
    this.name = "OrderVersionConflictError";
  }
}

const BASE_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = Object.freeze({
  DRAFT: ["NEGOTIATING", "AWAITING_PARTY_ACCEPTANCE", "CANCELED"],
  NEGOTIATING: [
    "AWAITING_PARTY_ACCEPTANCE",
    "CANCELLATION_REQUESTED",
    "CANCELED",
  ],
  AWAITING_PARTY_ACCEPTANCE: [
    "NEGOTIATING",
    "AWAITING_PAYMENT",
    "CANCELLATION_REQUESTED",
    "CANCELED",
  ],
  AWAITING_PAYMENT: [
    "PAYMENT_PROCESSING",
    "CANCELLATION_REQUESTED",
    "CANCELED",
  ],
  PAYMENT_PROCESSING: [
    "FUNDED",
    "AWAITING_PAYMENT",
    "REFUND_PENDING",
    "CANCELED",
  ],
  FUNDED: [
    "BRIEF_CONFIRMATION_PENDING",
    "IN_PRODUCTION",
    "CANCELLATION_REQUESTED",
    "DISPUTED",
    "REFUND_PENDING",
  ],
  BRIEF_CONFIRMATION_PENDING: [
    "IN_PRODUCTION",
    "CANCELLATION_REQUESTED",
    "DISPUTED",
    "REFUND_PENDING",
  ],
  IN_PRODUCTION: [
    "DRAFT_SUBMITTED",
    "CANCELLATION_REQUESTED",
    "DISPUTED",
    "REFUND_PENDING",
  ],
  DRAFT_SUBMITTED: [
    "REVISION_REQUESTED",
    "FINAL_APPROVAL_PENDING",
    "DISPUTED",
  ],
  REVISION_REQUESTED: ["DRAFT_SUBMITTED", "DISPUTED", "REFUND_PENDING"],
  FINAL_APPROVAL_PENDING: [
    "REVISION_REQUESTED",
    "SCHEDULED_FOR_PUBLICATION",
    "PUBLISHED",
    "DISPUTED",
  ],
  SCHEDULED_FOR_PUBLICATION: ["PUBLISHED", "DISPUTED", "REFUND_PENDING"],
  PUBLISHED: ["BUYER_CONFIRMATION_PENDING", "DISPUTED", "REFUND_PENDING"],
  BUYER_CONFIRMATION_PENDING: [
    "PAYOUT_BLOCKED",
    "PAYOUT_SCHEDULED",
    "DISPUTED",
    "REFUND_PENDING",
  ],
  PAYOUT_BLOCKED: ["PAYOUT_SCHEDULED", "DISPUTED", "REFUND_PENDING"],
  PAYOUT_SCHEDULED: [
    "PAYOUT_PROCESSING",
    "PAYOUT_BLOCKED",
    "DISPUTED",
  ],
  PAYOUT_PROCESSING: ["COMPLETED", "PAYOUT_FAILED", "DISPUTED"],
  COMPLETED: ["CHARGEBACK"],
  CANCELLATION_REQUESTED: [
    "CANCELED",
    "REFUND_PENDING",
    "DISPUTED",
  ],
  CANCELED: [],
  DISPUTED: [
    "PAYOUT_BLOCKED",
    "REFUND_PENDING",
    "PARTIALLY_REFUNDED",
    "REFUNDED",
  ],
  REFUND_PENDING: [
    "PARTIALLY_REFUNDED",
    "REFUNDED",
    "PAYOUT_BLOCKED",
  ],
  PARTIALLY_REFUNDED: [
    "PAYOUT_BLOCKED",
    "PAYOUT_SCHEDULED",
    "REFUND_PENDING",
    "DISPUTED",
  ],
  REFUNDED: ["CANCELED"],
  CHARGEBACK: [],
  PAYOUT_FAILED: ["PAYOUT_SCHEDULED", "PAYOUT_BLOCKED", "DISPUTED"],
});

export function allowedOrderTransitions(
  status: OrderStatus,
): readonly OrderStatus[] {
  return BASE_TRANSITIONS[status];
}

export function canTransitionOrder(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return BASE_TRANSITIONS[from].includes(to);
}

function requireText(value: string, field: string, maxLength: number): void {
  const length = value.trim().length;
  if (length === 0 || length > maxLength) {
    throw new TypeError(`${field} must contain 1-${maxLength} characters`);
  }
}

function assertTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new TypeError("occurredAt must be an ISO-8601 timestamp");
  }
}

/**
 * Pure transition function. Persist the returned state, append-only status event,
 * and outbox event in one database transaction guarded by expectedVersion.
 */
export function applyOrderTransition(
  current: OrderWorkflowState,
  command: OrderTransitionCommand,
): Readonly<AppliedOrderTransition> {
  if (command.expectedVersion !== current.version) {
    throw new OrderVersionConflictError(command.expectedVersion, current.version);
  }
  if (!canTransitionOrder(current.status, command.to)) {
    throw new InvalidOrderTransitionError(current.status, command.to);
  }
  requireText(current.orderId, "orderId", 128);
  requireText(command.transitionId, "transitionId", 128);
  requireText(command.actorId, "actorId", 128);
  requireText(command.reason, "reason", 500);
  requireText(command.idempotencyKey, "idempotencyKey", 300);
  assertTimestamp(command.occurredAt);

  const nextVersion = current.version + 1;
  const nextState = Object.freeze({
    orderId: current.orderId,
    status: command.to,
    version: nextVersion,
    updatedAt: command.occurredAt,
  });
  const statusEvent = Object.freeze({
    id: command.transitionId,
    orderId: current.orderId,
    from: current.status,
    to: command.to,
    orderVersion: nextVersion,
    actorId: command.actorId,
    actorType: command.actorType,
    reason: command.reason.trim(),
    idempotencyKey: command.idempotencyKey,
    occurredAt: command.occurredAt,
  });
  const outboxEvent = Object.freeze({
    deduplicationKey: `order-status:${command.transitionId}`,
    type: "order.status_changed" as const,
    aggregateId: current.orderId,
    aggregateVersion: nextVersion,
    payload: Object.freeze({
      from: current.status,
      to: command.to,
      transitionId: command.transitionId,
    }),
    occurredAt: command.occurredAt,
  });

  return Object.freeze({ nextState, statusEvent, outboxEvent });
}
