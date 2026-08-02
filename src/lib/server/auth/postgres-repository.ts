import "server-only";

import type { DatabaseResources } from "@/lib/server/db/client";
import type { ActorRole } from "@/lib/server/authorization";
import type {
  LocalDemoRole,
  NewSessionRecord,
  SessionAuthMethod,
  SessionIdentity,
  SessionRecord,
  SessionRevokeReason,
} from "./types";
import type { SessionRepository } from "./repository";
import { LOCAL_DEMO_USER_IDS } from "./repository";

type SessionRow = Readonly<{
  id: string;
  user_id: string;
  token_digest: string;
  csrf_token_digest: string;
  auth_method: string;
  demo_role: string | null;
  rotated_from_session_id: string | null;
  rotation_generation: number;
  expires_at: Date;
  idle_expires_at: Date;
  absolute_expires_at: Date;
  last_seen_at: Date;
  mfa_verified_at: Date | null;
  revoked_at: Date | null;
  revoke_reason: string | null;
  created_at: Date;
  updated_at: Date;
}>;

const actorRoles = new Set<ActorRole>([
  "CREATOR",
  "ADVERTISER",
  "AGENCY",
  "ADMIN",
  "SUPPORT",
  "FINANCE",
  "RISK",
  "MODERATOR",
]);
const authMethods = new Set<SessionAuthMethod>(["EXTERNAL_PROVIDER", "LOCAL_DEMO"]);
const revokeReasons = new Set<SessionRevokeReason>([
  "USER_LOGOUT",
  "ROTATED",
  "ADMIN_REVOKE",
  "PASSWORD_CHANGED",
  "PRIVILEGE_CHANGED",
  "EXPIRED",
  "USER_DISABLED",
  "SECURITY_EVENT",
]);

const demoUsers: Readonly<Record<LocalDemoRole, Readonly<{ id: string; email: string; displayName: string }>>> =
  Object.freeze({
    ADVERTISER: Object.freeze({
      id: LOCAL_DEMO_USER_IDS.ADVERTISER,
      email: "local-demo-advertiser@tuberbot.invalid",
      displayName: "로컬 데모 광고주",
    }),
    CREATOR: Object.freeze({
      id: LOCAL_DEMO_USER_IDS.CREATOR,
      email: "local-demo-creator@tuberbot.invalid",
      displayName: "로컬 데모 크리에이터",
    }),
  });

function mapSession(row: SessionRow): SessionRecord {
  if (!authMethods.has(row.auth_method as SessionAuthMethod)) throw new Error("Invalid stored auth method");
  if (row.demo_role !== null && row.demo_role !== "ADVERTISER" && row.demo_role !== "CREATOR") {
    throw new Error("Invalid stored demo role");
  }
  if (row.revoke_reason !== null && !revokeReasons.has(row.revoke_reason as SessionRevokeReason)) {
    throw new Error("Invalid stored revoke reason");
  }

  return Object.freeze({
    id: row.id,
    userId: row.user_id,
    tokenDigest: row.token_digest,
    csrfTokenDigest: row.csrf_token_digest,
    authMethod: row.auth_method as SessionAuthMethod,
    demoRole: row.demo_role as LocalDemoRole | null,
    rotatedFromSessionId: row.rotated_from_session_id,
    rotationGeneration: row.rotation_generation,
    expiresAt: new Date(row.expires_at),
    idleExpiresAt: new Date(row.idle_expires_at),
    absoluteExpiresAt: new Date(row.absolute_expires_at),
    lastSeenAt: new Date(row.last_seen_at),
    mfaVerifiedAt: row.mfa_verified_at === null ? null : new Date(row.mfa_verified_at),
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at),
    revokeReason: row.revoke_reason as SessionRevokeReason | null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

function assertRotationLineage(current: SessionRecord, replacement: NewSessionRecord): void {
  if (
    replacement.userId !== current.userId ||
    replacement.authMethod !== current.authMethod ||
    replacement.demoRole !== current.demoRole ||
    replacement.rotatedFromSessionId !== current.id ||
    replacement.rotationGeneration !== current.rotationGeneration + 1 ||
    replacement.absoluteExpiresAt.getTime() !== current.absoluteExpiresAt.getTime() ||
    replacement.mfaVerifiedAt?.getTime() !== current.mfaVerifiedAt?.getTime()
  ) {
    throw new Error("Invalid session rotation lineage");
  }
}

export class PostgresSessionRepository implements SessionRepository {
  readonly #sql: DatabaseResources["queryClient"];

  constructor(resources: DatabaseResources) {
    this.#sql = resources.queryClient;
  }

  async ensureLocalDemoUser(role: LocalDemoRole): Promise<string> {
    const demoUser = demoUsers[role];
    await this.#sql`
      insert into users (id, email, display_name, status, locale, time_zone, admin_mfa_enabled)
      values (${demoUser.id}, ${demoUser.email}, ${demoUser.displayName}, 'ACTIVE', 'ko-KR', 'Asia/Seoul', false)
      on conflict (id) do nothing
    `;
    const rows = await this.#sql<ReadonlyArray<{
      id: string;
      email: string;
      display_name: string;
      status: string;
      deleted_at: Date | null;
    }>>`
      select id, email, display_name, status, deleted_at
      from users
      where id = ${demoUser.id}
      limit 1
    `;
    const row = rows[0];
    if (
      row === undefined ||
      row.email !== demoUser.email ||
      row.display_name !== demoUser.displayName ||
      row.status !== "ACTIVE" ||
      row.deleted_at !== null
    ) {
      throw new Error("Local demo identity is unavailable");
    }
    return demoUser.id;
  }

  async createSession(session: NewSessionRecord): Promise<SessionRecord> {
    const rows = await this.#sql<SessionRow[]>`
      insert into user_sessions (
        user_id, token_digest, csrf_token_digest, auth_method, demo_role,
        rotated_from_session_id, rotation_generation, expires_at, idle_expires_at,
        absolute_expires_at, last_seen_at, mfa_verified_at, created_at, updated_at
      ) values (
        ${session.userId}, ${session.tokenDigest}, ${session.csrfTokenDigest},
        ${session.authMethod}, ${session.demoRole}, ${session.rotatedFromSessionId},
        ${session.rotationGeneration}, ${session.expiresAt}, ${session.idleExpiresAt},
        ${session.absoluteExpiresAt}, ${session.lastSeenAt}, ${session.mfaVerifiedAt},
        ${session.createdAt}, ${session.updatedAt}
      )
      returning *
    `;
    const row = rows[0];
    if (row === undefined) throw new Error("Session creation failed");
    return mapSession(row);
  }

  async findSessionByTokenDigest(tokenDigest: string): Promise<SessionRecord | null> {
    const rows = await this.#sql<SessionRow[]>`
      select * from user_sessions
      where token_digest = ${tokenDigest}
      limit 1
    `;
    return rows[0] === undefined ? null : mapSession(rows[0]);
  }

  async loadIdentity(userId: string): Promise<SessionIdentity> {
    const rows = await this.#sql<ReadonlyArray<{
      status: string;
      deleted_at: Date | null;
      roles: string[];
      organization_ids: string[];
    }>>`
      select
        u.status,
        u.deleted_at,
        array(
          select ur.role::text
          from user_roles ur
          where ur.user_id = u.id and ur.revoked_at is null
          order by ur.role::text
        ) as roles,
        array(
          select om.organization_id::text
          from organization_members om
          where om.user_id = u.id and om.status = 'ACTIVE' and om.revoked_at is null
          order by om.organization_id::text
        ) as organization_ids
      from users u
      where u.id = ${userId}
      limit 1
    `;
    const row = rows[0];
    if (row === undefined || row.status !== "ACTIVE" || row.deleted_at !== null) {
      return Object.freeze({ active: false, roles: Object.freeze([]), organizationIds: Object.freeze([]) });
    }

    const roles = row.roles.filter((role): role is ActorRole => actorRoles.has(role as ActorRole));
    return Object.freeze({
      active: true,
      roles: Object.freeze(roles),
      organizationIds: Object.freeze([...row.organization_ids]),
    });
  }

  async touchSession(input: Readonly<{
    sessionId: string;
    tokenDigest: string;
    previousLastSeenAt: Date;
    lastSeenAt: Date;
    idleExpiresAt: Date;
  }>): Promise<void> {
    await this.#sql`
      update user_sessions
      set last_seen_at = ${input.lastSeenAt},
          idle_expires_at = ${input.idleExpiresAt},
          updated_at = ${input.lastSeenAt}
      where id = ${input.sessionId}
        and token_digest = ${input.tokenDigest}
        and revoked_at is null
        and last_seen_at <= ${input.previousLastSeenAt}
        and expires_at > ${input.lastSeenAt}
        and idle_expires_at > ${input.lastSeenAt}
        and absolute_expires_at > ${input.lastSeenAt}
    `;
  }

  async rotateSession(input: Readonly<{
    currentSessionId: string;
    currentTokenDigest: string;
    replacement: NewSessionRecord;
    rotatedAt: Date;
  }>): Promise<SessionRecord | null> {
    return this.#sql.begin(async (transaction) => {
      const currentRows = await transaction<SessionRow[]>`
        select * from user_sessions
        where id = ${input.currentSessionId}
          and token_digest = ${input.currentTokenDigest}
          and revoked_at is null
          and expires_at > ${input.rotatedAt}
          and idle_expires_at > ${input.rotatedAt}
          and absolute_expires_at > ${input.rotatedAt}
        for update
      `;
      const currentRow = currentRows[0];
      if (currentRow === undefined) return null;

      const current = mapSession(currentRow);
      assertRotationLineage(current, input.replacement);
      await transaction`
        update user_sessions
        set revoked_at = ${input.rotatedAt}, revoke_reason = 'ROTATED', updated_at = ${input.rotatedAt}
        where id = ${current.id} and revoked_at is null
      `;
      const replacementRows = await transaction<SessionRow[]>`
        insert into user_sessions (
          user_id, token_digest, csrf_token_digest, auth_method, demo_role,
          rotated_from_session_id, rotation_generation, expires_at, idle_expires_at,
          absolute_expires_at, last_seen_at, mfa_verified_at, created_at, updated_at
        ) values (
          ${input.replacement.userId}, ${input.replacement.tokenDigest},
          ${input.replacement.csrfTokenDigest}, ${input.replacement.authMethod},
          ${input.replacement.demoRole}, ${input.replacement.rotatedFromSessionId},
          ${input.replacement.rotationGeneration}, ${input.replacement.expiresAt},
          ${input.replacement.idleExpiresAt}, ${input.replacement.absoluteExpiresAt},
          ${input.replacement.lastSeenAt}, ${input.replacement.mfaVerifiedAt},
          ${input.replacement.createdAt}, ${input.replacement.updatedAt}
        )
        returning *
      `;
      const replacementRow = replacementRows[0];
      if (replacementRow === undefined) throw new Error("Session rotation failed");
      return mapSession(replacementRow);
    });
  }

  async revokeSession(input: Readonly<{
    sessionId: string;
    tokenDigest: string;
    reason: SessionRevokeReason;
    revokedAt: Date;
  }>): Promise<boolean> {
    const rows = await this.#sql<ReadonlyArray<{ id: string }>>`
      update user_sessions
      set revoked_at = ${input.revokedAt}, revoke_reason = ${input.reason}, updated_at = ${input.revokedAt}
      where id = ${input.sessionId}
        and token_digest = ${input.tokenDigest}
        and revoked_at is null
      returning id
    `;
    return rows.length === 1;
  }
}
