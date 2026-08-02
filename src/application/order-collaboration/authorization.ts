import type { AuthenticatedActor } from "../../lib/server/authorization";
import { OrderCollaborationAccessError } from "./errors";
import type {
  OrderAccessScope,
  OrderCollaborationAction,
  OrderCollaborationAuthorization,
} from "./types";

export type OrderPermissionCheck = (
  actor: AuthenticatedActor,
  permission: "ORDER_READ" | "ORDER_WRITE",
  scope: OrderAccessScope,
) => boolean;

export function createOrderCollaborationAuthorization(
  isAllowed: OrderPermissionCheck,
): OrderCollaborationAuthorization {
  return {
    assertAuthorized(
      actor: AuthenticatedActor,
      action: OrderCollaborationAction,
      scope: OrderAccessScope,
    ): void {
      const isRecordedParty =
        (actor.userId === scope.buyerUserId && actor.roles.includes("ADVERTISER")) ||
        (actor.userId === scope.creatorUserId && actor.roles.includes("CREATOR"));
      if (!isRecordedParty) {
        throw new OrderCollaborationAccessError();
      }

      const permission = action === "READ_WORKSPACE" ? "ORDER_READ" : "ORDER_WRITE";
      if (!isAllowed(actor, permission, scope)) {
        throw new OrderCollaborationAccessError();
      }
      if (action === "REVIEW_DELIVERABLE" && actor.userId !== scope.buyerUserId) {
        throw new OrderCollaborationAccessError();
      }
    },
  };
}
