import "server-only";

import type { AuthenticatedActor, ActorRole } from "@/lib/server/authorization";

export type SessionAuthMethod = "EXTERNAL_PROVIDER" | "LOCAL_DEMO";
export type LocalDemoRole = "ADVERTISER" | "CREATOR";
export type SessionRevokeReason =
  | "USER_LOGOUT"
  | "ROTATED"
  | "ADMIN_REVOKE"
  | "PASSWORD_CHANGED"
  | "PRIVILEGE_CHANGED"
  | "EXPIRED"
  | "USER_DISABLED"
  | "SECURITY_EVENT";

export type SessionRecord = Readonly<{
  id: string;
  userId: string;
  tokenDigest: string;
  csrfTokenDigest: string;
  authMethod: SessionAuthMethod;
  demoRole: LocalDemoRole | null;
  rotatedFromSessionId: string | null;
  rotationGeneration: number;
  expiresAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  lastSeenAt: Date;
  mfaVerifiedAt: Date | null;
  revokedAt: Date | null;
  revokeReason: SessionRevokeReason | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type NewSessionRecord = Omit<SessionRecord, "id" | "revokedAt" | "revokeReason">;

export type SessionIdentity = Readonly<{
  active: boolean;
  roles: readonly ActorRole[];
  organizationIds: readonly string[];
}>;

export type IssuedSession = Readonly<{
  actor: AuthenticatedActor;
  session: SessionRecord;
  sessionToken: string;
  csrfToken: string;
}>;

export type AuthenticatedSession = Readonly<{
  actor: AuthenticatedActor;
  session: SessionRecord;
}>;

export type SessionPolicy = Readonly<{
  tokenLifetimeMs: number;
  idleLifetimeMs: number;
  absoluteLifetimeMs: number;
  touchIntervalMs: number;
}>;

export const DEFAULT_SESSION_POLICY: SessionPolicy = Object.freeze({
  tokenLifetimeMs: 8 * 60 * 60 * 1_000,
  idleLifetimeMs: 30 * 60 * 1_000,
  absoluteLifetimeMs: 24 * 60 * 60 * 1_000,
  touchIntervalMs: 5 * 60 * 1_000,
});
