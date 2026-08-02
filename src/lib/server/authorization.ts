import "server-only";

export type ActorRole = "CREATOR" | "ADVERTISER" | "AGENCY" | "ADMIN" | "SUPPORT" | "FINANCE" | "RISK" | "MODERATOR";
export type Permission =
  | "ORDER_READ"
  | "ORDER_WRITE"
  | "CAMPAIGN_READ"
  | "CAMPAIGN_WRITE"
  | "PAYMENT_READ"
  | "REFUND_EXECUTE"
  | "PAYOUT_READ"
  | "PAYOUT_RETRY"
  | "DISPUTE_READ"
  | "DISPUTE_DECIDE"
  | "PUBLIC_CONTENT_MODERATE"
  | "ADMIN_CONFIGURE";

export type AuthenticatedActor = Readonly<{
  userId: string;
  roles: readonly ActorRole[];
  organizationIds: readonly string[];
  mfaVerified: boolean;
  sessionId: string;
}>;

export type ScopedResource = Readonly<{
  ownerUserIds?: readonly string[];
  organizationId?: string;
  advertiserUserId?: string;
  creatorUserId?: string;
}>;

const operationsRoles: Readonly<Record<Permission, readonly ActorRole[]>> = {
  // Order collaboration has no staff-assignment model yet. Operations access
  // must remain fail closed until a resource-scoped assignment is introduced.
  ORDER_READ: [],
  ORDER_WRITE: [],
  CAMPAIGN_READ: ["SUPPORT", "MODERATOR", "ADMIN"],
  CAMPAIGN_WRITE: ["MODERATOR", "ADMIN"],
  PAYMENT_READ: ["FINANCE", "RISK", "ADMIN"],
  REFUND_EXECUTE: ["FINANCE", "ADMIN"],
  PAYOUT_READ: ["FINANCE", "RISK", "ADMIN"],
  PAYOUT_RETRY: ["FINANCE", "ADMIN"],
  DISPUTE_READ: ["SUPPORT", "RISK", "ADMIN"],
  DISPUTE_DECIDE: ["RISK", "ADMIN"],
  PUBLIC_CONTENT_MODERATE: ["MODERATOR", "ADMIN"],
  ADMIN_CONFIGURE: ["ADMIN"],
};

const writePermissions = new Set<Permission>(["ORDER_WRITE", "CAMPAIGN_WRITE", "REFUND_EXECUTE", "PAYOUT_RETRY", "DISPUTE_DECIDE", "PUBLIC_CONTENT_MODERATE", "ADMIN_CONFIGURE"]);

export class AuthorizationError extends Error {
  constructor() {
    super("The requested resource is unavailable");
    this.name = "AuthorizationError";
  }
}

function isParticipant(actor: AuthenticatedActor, resource: ScopedResource): boolean {
  return resource.ownerUserIds?.includes(actor.userId) === true || resource.advertiserUserId === actor.userId || resource.creatorUserId === actor.userId || (resource.organizationId !== undefined && actor.organizationIds.includes(resource.organizationId));
}

function isOrderParty(actor: AuthenticatedActor, resource: ScopedResource): boolean {
  return (
    (resource.advertiserUserId === actor.userId && actor.roles.includes("ADVERTISER")) ||
    (resource.creatorUserId === actor.userId && actor.roles.includes("CREATOR"))
  );
}

/**
 * A role never grants cross-tenant access by itself. Consumer roles must be a
 * participant; operations roles are narrowed by action and administrators must
 * have completed MFA for every privileged request.
 */
export function isAuthorized(actor: AuthenticatedActor, permission: Permission, resource: ScopedResource): boolean {
  if (!actor.userId || !actor.sessionId) return false;

  // A staff role, organization membership, or generic owner list is not an
  // order-workspace assignment. Only the two recorded consumer parties may
  // read or mutate collaboration data until an explicit assignment model exists.
  if (permission === "ORDER_READ" || permission === "ORDER_WRITE") {
    return isOrderParty(actor, resource);
  }

  const participant = isParticipant(actor, resource);
  if (permission === "PAYMENT_READ" || permission === "DISPUTE_READ") {
    if (participant) return permission !== "PAYMENT_READ" || actor.roles.some((role) => role === "ADVERTISER" || role === "AGENCY");
  }
  if ((permission === "CAMPAIGN_READ" || permission === "CAMPAIGN_WRITE") && participant) return actor.roles.some((role) => role === "ADVERTISER" || role === "AGENCY");
  if (permission === "PAYOUT_READ" && participant) return actor.roles.includes("CREATOR");

  const allowedOperationsRole = operationsRoles[permission].some((role) => actor.roles.includes(role));
  if (!allowedOperationsRole) return false;
  if (actor.roles.includes("ADMIN") && !actor.mfaVerified) return false;
  if (writePermissions.has(permission) && !actor.mfaVerified) return false;
  return true;
}

export function assertAuthorized(actor: AuthenticatedActor, permission: Permission, resource: ScopedResource): void {
  if (!isAuthorized(actor, permission, resource)) throw new AuthorizationError();
}
