import "server-only";

import { randomUUID } from "node:crypto";

import type {
  LocalDemoRole,
  NewSessionRecord,
  SessionIdentity,
  SessionRecord,
  SessionRevokeReason,
} from "./types";

export interface SessionRepository {
  ensureLocalDemoUser(role: LocalDemoRole): Promise<string>;
  createSession(session: NewSessionRecord): Promise<SessionRecord>;
  findSessionByTokenDigest(tokenDigest: string): Promise<SessionRecord | null>;
  loadIdentity(userId: string): Promise<SessionIdentity>;
  touchSession(input: Readonly<{
    sessionId: string;
    tokenDigest: string;
    previousLastSeenAt: Date;
    lastSeenAt: Date;
    idleExpiresAt: Date;
  }>): Promise<void>;
  rotateSession(input: Readonly<{
    currentSessionId: string;
    currentTokenDigest: string;
    replacement: NewSessionRecord;
    rotatedAt: Date;
  }>): Promise<SessionRecord | null>;
  revokeSession(input: Readonly<{
    sessionId: string;
    tokenDigest: string;
    reason: SessionRevokeReason;
    revokedAt: Date;
  }>): Promise<boolean>;
}

export const LOCAL_DEMO_USER_IDS: Readonly<Record<LocalDemoRole, string>> = Object.freeze({
  ADVERTISER: "00000000-0000-4000-8000-00000000d001",
  CREATOR: "00000000-0000-4000-8000-00000000d002",
});

function cloneSession(session: SessionRecord): SessionRecord {
  return Object.freeze({
    ...session,
    expiresAt: new Date(session.expiresAt),
    idleExpiresAt: new Date(session.idleExpiresAt),
    absoluteExpiresAt: new Date(session.absoluteExpiresAt),
    lastSeenAt: new Date(session.lastSeenAt),
    mfaVerifiedAt: session.mfaVerifiedAt === null ? null : new Date(session.mfaVerifiedAt),
    revokedAt: session.revokedAt === null ? null : new Date(session.revokedAt),
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
  });
}

/** Deterministic in-process repository for tests and explicitly enabled local demos only. */
export class MemorySessionRepository implements SessionRepository {
  readonly #sessions = new Map<string, SessionRecord>();
  readonly #identities = new Map<string, SessionIdentity>();

  async ensureLocalDemoUser(role: LocalDemoRole): Promise<string> {
    const userId = LOCAL_DEMO_USER_IDS[role];
    this.#identities.set(
      userId,
      Object.freeze({ active: true, roles: Object.freeze([]), organizationIds: Object.freeze([]) }),
    );
    return userId;
  }

  async createSession(session: NewSessionRecord): Promise<SessionRecord> {
    if ([...this.#sessions.values()].some((candidate) => candidate.tokenDigest === session.tokenDigest)) {
      throw new Error("Session digest collision");
    }
    const stored = cloneSession({ ...session, id: randomUUID(), revokedAt: null, revokeReason: null });
    this.#sessions.set(stored.id, stored);
    return cloneSession(stored);
  }

  async findSessionByTokenDigest(tokenDigest: string): Promise<SessionRecord | null> {
    const found = [...this.#sessions.values()].find((session) => session.tokenDigest === tokenDigest);
    return found === undefined ? null : cloneSession(found);
  }

  async loadIdentity(userId: string): Promise<SessionIdentity> {
    const identity = this.#identities.get(userId);
    return identity ?? Object.freeze({ active: false, roles: Object.freeze([]), organizationIds: Object.freeze([]) });
  }

  async touchSession(input: Readonly<{
    sessionId: string;
    tokenDigest: string;
    previousLastSeenAt: Date;
    lastSeenAt: Date;
    idleExpiresAt: Date;
  }>): Promise<void> {
    const current = this.#sessions.get(input.sessionId);
    if (
      current === undefined ||
      current.tokenDigest !== input.tokenDigest ||
      current.revokedAt !== null ||
      current.lastSeenAt.getTime() > input.previousLastSeenAt.getTime() ||
      current.expiresAt.getTime() <= input.lastSeenAt.getTime() ||
      current.absoluteExpiresAt.getTime() <= input.lastSeenAt.getTime()
    ) {
      return;
    }
    this.#sessions.set(
      current.id,
      cloneSession({
        ...current,
        lastSeenAt: input.lastSeenAt,
        idleExpiresAt: input.idleExpiresAt,
        updatedAt: input.lastSeenAt,
      }),
    );
  }

  async rotateSession(input: Readonly<{
    currentSessionId: string;
    currentTokenDigest: string;
    replacement: NewSessionRecord;
    rotatedAt: Date;
  }>): Promise<SessionRecord | null> {
    const current = this.#sessions.get(input.currentSessionId);
    if (
      current === undefined ||
      current.tokenDigest !== input.currentTokenDigest ||
      current.revokedAt !== null ||
      current.expiresAt.getTime() <= input.rotatedAt.getTime() ||
      current.idleExpiresAt.getTime() <= input.rotatedAt.getTime() ||
      current.absoluteExpiresAt.getTime() <= input.rotatedAt.getTime() ||
      input.replacement.userId !== current.userId ||
      input.replacement.authMethod !== current.authMethod ||
      input.replacement.demoRole !== current.demoRole ||
      input.replacement.rotatedFromSessionId !== current.id ||
      input.replacement.rotationGeneration !== current.rotationGeneration + 1 ||
      input.replacement.absoluteExpiresAt.getTime() !== current.absoluteExpiresAt.getTime() ||
      input.replacement.mfaVerifiedAt?.getTime() !== current.mfaVerifiedAt?.getTime() ||
      [...this.#sessions.values()].some(
        (candidate) => candidate.tokenDigest === input.replacement.tokenDigest,
      )
    ) {
      return null;
    }

    let replacementId = randomUUID();
    while (this.#sessions.has(replacementId)) replacementId = randomUUID();
    const stored = cloneSession({
      ...input.replacement,
      id: replacementId,
      revokedAt: null,
      revokeReason: null,
    });

    // Both map writes are synchronous and all potentially failing validation
    // and allocation happens before the predecessor is revoked.
    this.#sessions.set(
      current.id,
      cloneSession({
        ...current,
        revokedAt: input.rotatedAt,
        revokeReason: "ROTATED",
        updatedAt: input.rotatedAt,
      }),
    );
    this.#sessions.set(stored.id, stored);
    return cloneSession(stored);
  }

  async revokeSession(input: Readonly<{
    sessionId: string;
    tokenDigest: string;
    reason: SessionRevokeReason;
    revokedAt: Date;
  }>): Promise<boolean> {
    const current = this.#sessions.get(input.sessionId);
    if (current === undefined || current.tokenDigest !== input.tokenDigest || current.revokedAt !== null) {
      return false;
    }
    this.#sessions.set(
      current.id,
      cloneSession({
        ...current,
        revokedAt: input.revokedAt,
        revokeReason: input.reason,
        updatedAt: input.revokedAt,
      }),
    );
    return true;
  }
}
