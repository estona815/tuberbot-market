import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createOrderCollaborationAuthorization,
  OrderCollaborationAccessError,
  type OrderAccessScope,
  type OrderCollaborationAction,
} from "../../src/application/order-collaboration";
import type {
  ActorRole,
  AuthenticatedActor,
} from "../../src/lib/server/authorization";

const scope: OrderAccessScope = {
  orderId: "order-a",
  orderNumber: "TBM-ORDER-A",
  buyerUserId: "advertiser-a",
  buyerOrganizationId: "organization-a",
  creatorUserId: "creator-a",
  status: "DRAFT_SUBMITTED",
  version: 1,
};

function actor(
  userId: string,
  roles: readonly ActorRole[],
  organizationIds: readonly string[] = [],
): AuthenticatedActor {
  return {
    userId,
    roles,
    organizationIds,
    mfaVerified: true,
    sessionId: `session-${userId}`,
  };
}

describe("order collaboration least-privilege authorization", () => {
  const authorization = createOrderCollaborationAuthorization(() => true);

  it("allows the recorded advertiser and creator to read and chat, with review kept buyer-only", () => {
    const advertiser = actor(scope.buyerUserId, ["ADVERTISER"]);
    const creator = actor(scope.creatorUserId, ["CREATOR"]);

    expect(() => authorization.assertAuthorized(advertiser, "READ_WORKSPACE", scope)).not.toThrow();
    expect(() => authorization.assertAuthorized(advertiser, "SEND_MESSAGE", scope)).not.toThrow();
    expect(() => authorization.assertAuthorized(advertiser, "REVIEW_DELIVERABLE", scope)).not.toThrow();
    expect(() => authorization.assertAuthorized(creator, "READ_WORKSPACE", scope)).not.toThrow();
    expect(() => authorization.assertAuthorized(creator, "SEND_MESSAGE", scope)).not.toThrow();
    expect(() => authorization.assertAuthorized(creator, "REVIEW_DELIVERABLE", scope)).toThrow(
      OrderCollaborationAccessError,
    );
  });

  it.each(["SUPPORT", "FINANCE", "RISK", "ADMIN"] as const)(
    "denies %s every collaboration action even when the delegated checker is permissive",
    (role) => {
      const actions: readonly OrderCollaborationAction[] = [
        "READ_WORKSPACE",
        "SEND_MESSAGE",
        "REVIEW_DELIVERABLE",
      ];
      const crossTenantStaff = actor(`staff-${role.toLowerCase()}`, [role], [
        scope.buyerOrganizationId!,
      ]);
      const partyIdWithoutPartyRole = actor(scope.buyerUserId, [role], [
        scope.buyerOrganizationId!,
      ]);

      for (const action of actions) {
        expect(() =>
          authorization.assertAuthorized(crossTenantStaff, action, scope),
        ).toThrow(OrderCollaborationAccessError);
        expect(() =>
          authorization.assertAuthorized(partyIdWithoutPartyRole, action, scope),
        ).toThrow(OrderCollaborationAccessError);
      }
    },
  );

  it("denies cross-tenant consumer roles and organization-only agency membership", () => {
    const deniedActors = [
      actor("advertiser-b", ["ADVERTISER"]),
      actor("creator-b", ["CREATOR"]),
      actor("agency-a", ["AGENCY"], [scope.buyerOrganizationId!]),
    ];

    for (const deniedActor of deniedActors) {
      expect(() =>
        authorization.assertAuthorized(deniedActor, "READ_WORKSPACE", scope),
      ).toThrow(OrderCollaborationAccessError);
      expect(() =>
        authorization.assertAuthorized(deniedActor, "SEND_MESSAGE", scope),
      ).toThrow(OrderCollaborationAccessError);
    }
  });

  it("still honors a stricter delegated permission decision for a real party", () => {
    const deniedByDelegate = createOrderCollaborationAuthorization(() => false);
    expect(() =>
      deniedByDelegate.assertAuthorized(
        actor(scope.buyerUserId, ["ADVERTISER"]),
        "READ_WORKSPACE",
        scope,
      ),
    ).toThrow(OrderCollaborationAccessError);
  });
});
