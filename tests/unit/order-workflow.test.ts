import { describe, expect, it } from "vitest";

import {
  ORDER_STATUSES,
  applyOrderTransition,
  projectOrderStatus,
  type OrderStatus,
  type OrderWorkflowState,
} from "../../src/domain";

describe("order workflow", () => {
  it("executes the funded-to-completed happy path with append-only evidence", () => {
    const path: readonly OrderStatus[] = [
      "NEGOTIATING",
      "AWAITING_PARTY_ACCEPTANCE",
      "AWAITING_PAYMENT",
      "PAYMENT_PROCESSING",
      "FUNDED",
      "BRIEF_CONFIRMATION_PENDING",
      "IN_PRODUCTION",
      "DRAFT_SUBMITTED",
      "FINAL_APPROVAL_PENDING",
      "SCHEDULED_FOR_PUBLICATION",
      "PUBLISHED",
      "BUYER_CONFIRMATION_PENDING",
      "PAYOUT_SCHEDULED",
      "PAYOUT_PROCESSING",
      "COMPLETED",
    ];
    let state: OrderWorkflowState = {
      orderId: "order-123",
      status: "DRAFT",
      version: 0,
      updatedAt: "2026-08-02T00:00:00.000Z",
    };

    for (const [index, status] of path.entries()) {
      const result = applyOrderTransition(state, {
        transitionId: `transition-${index}`,
        to: status,
        expectedVersion: index,
        actorId: "system-1",
        actorType: "SYSTEM",
        reason: `advance to ${status}`,
        idempotencyKey: `order-123-${index}`,
        occurredAt: new Date(Date.UTC(2026, 7, 2, 0, index + 1)).toISOString(),
      });
      expect(result.statusEvent.from).toBe(state.status);
      expect(result.statusEvent.orderVersion).toBe(index + 1);
      expect(result.outboxEvent.aggregateVersion).toBe(index + 1);
      expect(Object.isFrozen(result.statusEvent)).toBe(true);
      state = result.nextState;
    }

    expect(state).toMatchObject({ status: "COMPLETED", version: path.length });
  });

  it("rejects illegal shortcuts and stale optimistic-lock versions", () => {
    const state: OrderWorkflowState = {
      orderId: "order-1",
      status: "FUNDED",
      version: 8,
      updatedAt: "2026-08-02T00:00:00.000Z",
    };
    const base = {
      transitionId: "transition-x",
      to: "COMPLETED" as const,
      expectedVersion: 8,
      actorId: "admin-1",
      actorType: "ADMIN" as const,
      reason: "attempted shortcut",
      idempotencyKey: "order-transition-x",
      occurredAt: "2026-08-02T00:01:00.000Z",
    };

    expect(() => applyOrderTransition(state, base)).toThrow(/cannot transition/iu);
    expect(() =>
      applyOrderTransition(state, {
        ...base,
        to: "IN_PRODUCTION",
        expectedVersion: 7,
      }),
    ).toThrow(/version conflict/iu);
  });

  it("keeps UI projection separate and exhaustive", () => {
    for (const status of ORDER_STATUSES) {
      const projection = projectOrderStatus(status);
      expect(projection.labelKo.length).toBeGreaterThan(0);
      expect(projection.progressPercent).toBeGreaterThanOrEqual(0);
      expect(projection.progressPercent).toBeLessThanOrEqual(100);
    }
    expect(projectOrderStatus("DISPUTED")).toMatchObject({
      phase: "EXCEPTION",
      tone: "DANGER",
      terminal: false,
    });
    expect(projectOrderStatus("COMPLETED").terminal).toBe(true);
  });
});
