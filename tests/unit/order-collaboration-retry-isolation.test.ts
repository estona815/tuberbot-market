import { describe, expect, it } from "vitest";

import {
  createOrderCollaborationAuthorization,
  MemoryOrderCollaborationRepository,
  ORDER_COLLABORATION_DEMO,
  ORDER_COLLABORATION_E2E_ORDER_NUMBERS,
  OrderCollaborationService,
} from "../../src/application/order-collaboration";
import type { AuthenticatedActor } from "../../src/lib/server/authorization";

const buyer: AuthenticatedActor = {
  userId: ORDER_COLLABORATION_DEMO.buyerUserId,
  roles: ["ADVERTISER"],
  organizationIds: [ORDER_COLLABORATION_DEMO.buyerOrganizationId],
  mfaVerified: false,
  sessionId: "retry-isolation-buyer",
};

describe("order collaboration retry fixtures", () => {
  it("keeps each configured Playwright retry order independent", async () => {
    const repository = MemoryOrderCollaborationRepository.createLoopbackDemo();
    const service = new OrderCollaborationService(
      repository,
      createOrderCollaborationAuthorization((actor, _permission, scope) =>
        [scope.buyerUserId, scope.creatorUserId].includes(actor.userId),
      ),
      { now: () => new Date("2026-08-02T04:00:00.000Z") },
    );

    for (const [retry, orderNumber] of ORDER_COLLABORATION_E2E_ORDER_NUMBERS.entries()) {
      const before = await service.getWorkspace(buyer, orderNumber);
      const deliverable = before.deliverables[0];
      expect(before.order.status).toBe("DRAFT_SUBMITTED");
      expect(deliverable?.version).not.toBeNull();

      await service.reviewDeliverable(
        buyer,
        orderNumber,
        {
          action: "APPROVE_DELIVERABLE",
          expectedVersion: 1,
          deliverableId: deliverable?.id ?? "",
          deliverableVersion: deliverable?.version?.version ?? 0,
          clientMessageId: `retry-${retry}-approval`,
        },
        {
          idempotencyKey: `retry-${retry}-approval`,
          requestId: `retry-${retry}-request`,
        },
      );

      const approved = await service.getWorkspace(buyer, orderNumber);
      expect(approved.order.status).toBe("FINAL_APPROVAL_PENDING");
      const nextOrder = ORDER_COLLABORATION_E2E_ORDER_NUMBERS[retry + 1];
      if (nextOrder !== undefined) {
        expect((await service.getWorkspace(buyer, nextOrder)).order.status).toBe(
          "DRAFT_SUBMITTED",
        );
      }
    }
  });
});
