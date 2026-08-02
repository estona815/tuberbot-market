import { describe, expect, it } from "vitest";

import {
  createOrderCollaborationAuthorization,
  MemoryOrderCollaborationRepository,
  OrderCollaborationService,
  type MemoryOrderCollaborationSeed,
  type OrderWorkspaceMessage,
} from "../../src/application/order-collaboration";
import type { AuthenticatedActor } from "../../src/lib/server/authorization";

const fixture = {
  orderId: "30000000-0000-4000-8000-000000000001",
  orderNumber: "TBM-PAGINATION-001",
  buyerUserId: "30000000-0000-4000-8000-000000000002",
  creatorUserId: "30000000-0000-4000-8000-000000000003",
} as const;

const buyer: AuthenticatedActor = {
  userId: fixture.buyerUserId,
  roles: ["ADVERTISER"],
  organizationIds: [],
  mfaVerified: false,
  sessionId: "pagination-buyer-session",
};

function message(index: number): OrderWorkspaceMessage {
  return {
    id: `30000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
    senderUserId: fixture.buyerUserId,
    type: "TEXT",
    body: `message-${index}`,
    replyToMessageId: null,
    clientMessageId: `seed-message-${index}`,
    createdAt: new Date(Date.UTC(2026, 6, 31, 0, 0, index)).toISOString(),
  };
}

function seed(): MemoryOrderCollaborationSeed {
  return {
    scope: {
      orderId: fixture.orderId,
      orderNumber: fixture.orderNumber,
      buyerUserId: fixture.buyerUserId,
      buyerOrganizationId: null,
      creatorUserId: fixture.creatorUserId,
      status: "DRAFT_SUBMITTED",
      version: 1,
    },
    workspace: {
      order: {
        id: fixture.orderId,
        orderNumber: fixture.orderNumber,
        status: "DRAFT_SUBMITTED",
        version: 1,
        revisionCount: 0,
        revisionLimit: 1,
      },
      messages: Array.from({ length: 105 }, (_, index) => message(index)),
      messagePage: { limit: 100, returned: 100, hasMore: true, nextCursor: null },
      deliverables: [],
    },
  };
}

describe("order collaboration message pagination", () => {
  it("returns stable bounded pages and bounds mutation replays", async () => {
    const repository = new MemoryOrderCollaborationRepository([seed()]);
    const service = new OrderCollaborationService(
      repository,
      createOrderCollaborationAuthorization((actor, _permission, scope) =>
        [scope.buyerUserId, scope.creatorUserId].includes(actor.userId),
      ),
      { now: () => new Date("2026-08-02T00:00:00.000Z") },
    );

    const recent = await service.getWorkspace(buyer, fixture.orderNumber);
    expect(recent.messages).toHaveLength(100);
    expect(recent.messagePage).toMatchObject({
      limit: 100,
      returned: 100,
      hasMore: true,
    });
    expect(recent.messagePage.nextCursor).not.toBeNull();
    expect(recent.messages.map((item) => item.body)).toEqual(
      Array.from({ length: 100 }, (_, index) => `message-${index + 5}`),
    );

    const older = await service.getWorkspace(buyer, fixture.orderNumber, {
      before: recent.messagePage.nextCursor ?? undefined,
    });
    expect(older.messages.map((item) => item.body)).toEqual(
      Array.from({ length: 5 }, (_, index) => `message-${index}`),
    );
    expect(older.messagePage).toEqual({
      limit: 100,
      returned: 5,
      hasMore: false,
      nextCursor: null,
    });

    const input = {
      body: "bounded mutation message",
      clientMessageId: "bounded-mutation-message",
      expectedVersion: 1,
    };
    const request = {
      idempotencyKey: "bounded-mutation-idempotency",
      requestId: "bounded-mutation-request",
    };
    const mutation = await service.sendMessage(buyer, fixture.orderNumber, input, request);
    const replay = await service.sendMessage(buyer, fixture.orderNumber, input, request);

    expect(mutation.replayed).toBe(false);
    expect(mutation.workspace.messages).toHaveLength(100);
    expect(mutation.workspace.messagePage).toMatchObject({
      returned: 100,
      hasMore: true,
    });
    expect(replay.replayed).toBe(true);
    expect(replay.workspace.messages).toHaveLength(100);
    expect(replay.workspace).toEqual(mutation.workspace);
  });
});
