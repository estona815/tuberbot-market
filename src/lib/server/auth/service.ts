import "server-only";

import type { AuthenticatedActor } from "@/lib/server/authorization";
import type { AuthRuntimeConfig } from "./config";
import type { SessionRepository } from "./repository";
import { createOpaqueToken, digestToken, isOpaqueToken } from "./token";
import type {
  AuthenticatedSession,
  IssuedSession,
  LocalDemoRole,
  NewSessionRecord,
  SessionRecord,
} from "./types";

export class LocalDemoAuthUnavailableError extends Error {
  constructor() {
    super("Local demo authentication is unavailable");
    this.name = "LocalDemoAuthUnavailableError";
  }
}

function addMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

function earlierDate(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}

function isActiveAt(session: SessionRecord, now: Date): boolean {
  const timestamp = now.getTime();
  return (
    session.revokedAt === null &&
    session.expiresAt.getTime() > timestamp &&
    session.idleExpiresAt.getTime() > timestamp &&
    session.absoluteExpiresAt.getTime() > timestamp
  );
}

function hasValidAuthShape(session: SessionRecord): boolean {
  return (
    (session.authMethod === "LOCAL_DEMO" && session.demoRole !== null) ||
    (session.authMethod === "EXTERNAL_PROVIDER" && session.demoRole === null)
  );
}

function buildActor(
  session: SessionRecord,
  identity: Awaited<ReturnType<SessionRepository["loadIdentity"]>>,
  now: Date,
): AuthenticatedActor {
  const isDemo = session.authMethod === "LOCAL_DEMO";
  const roles = isDemo && session.demoRole !== null ? [session.demoRole] : [...identity.roles];
  return Object.freeze({
    userId: session.userId,
    roles: Object.freeze(roles),
    organizationIds: Object.freeze(isDemo ? [] : [...identity.organizationIds]),
    mfaVerified:
      !isDemo &&
      session.mfaVerifiedAt !== null &&
      session.mfaVerifiedAt.getTime() <= now.getTime(),
    sessionId: session.id,
  });
}

export class AuthSessionService {
  readonly #repository: SessionRepository;
  readonly #config: AuthRuntimeConfig;

  constructor(repository: SessionRepository, config: AuthRuntimeConfig) {
    this.#repository = repository;
    this.#config = config;
  }

  async issueLocalDemo(role: LocalDemoRole, now = new Date()): Promise<IssuedSession> {
    if (!this.#config.enableLocalDemoAuth) throw new LocalDemoAuthUnavailableError();

    const userId = await this.#repository.ensureLocalDemoUser(role);
    const sessionToken = createOpaqueToken();
    const csrfToken = createOpaqueToken();
    const absoluteExpiresAt = addMilliseconds(now, this.#config.sessionPolicy.absoluteLifetimeMs);
    const session = await this.#repository.createSession({
      userId,
      tokenDigest: digestToken(sessionToken, "session", this.#config.sessionHashPepper),
      csrfTokenDigest: digestToken(csrfToken, "csrf", this.#config.sessionHashPepper),
      authMethod: "LOCAL_DEMO",
      demoRole: role,
      rotatedFromSessionId: null,
      rotationGeneration: 0,
      expiresAt: earlierDate(
        addMilliseconds(now, this.#config.sessionPolicy.tokenLifetimeMs),
        absoluteExpiresAt,
      ),
      idleExpiresAt: earlierDate(
        addMilliseconds(now, this.#config.sessionPolicy.idleLifetimeMs),
        absoluteExpiresAt,
      ),
      absoluteExpiresAt,
      lastSeenAt: now,
      mfaVerifiedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const identity = await this.#repository.loadIdentity(userId);
    if (!identity.active) {
      await this.#repository.revokeSession({
        sessionId: session.id,
        tokenDigest: session.tokenDigest,
        reason: "USER_DISABLED",
        revokedAt: now,
      });
      throw new LocalDemoAuthUnavailableError();
    }

    return Object.freeze({
      actor: buildActor(session, identity, now),
      session,
      sessionToken,
      csrfToken,
    });
  }

  async authenticate(sessionToken: string | null, now = new Date()): Promise<AuthenticatedSession | null> {
    if (!isOpaqueToken(sessionToken)) return null;
    const tokenDigest = digestToken(sessionToken, "session", this.#config.sessionHashPepper);
    const session = await this.#repository.findSessionByTokenDigest(tokenDigest);
    if (session === null || !hasValidAuthShape(session) || !isActiveAt(session, now)) return null;

    const identity = await this.#repository.loadIdentity(session.userId);
    if (!identity.active) {
      await this.#repository.revokeSession({
        sessionId: session.id,
        tokenDigest: session.tokenDigest,
        reason: "USER_DISABLED",
        revokedAt: now,
      });
      return null;
    }

    if (now.getTime() - session.lastSeenAt.getTime() >= this.#config.sessionPolicy.touchIntervalMs) {
      await this.#repository.touchSession({
        sessionId: session.id,
        tokenDigest: session.tokenDigest,
        previousLastSeenAt: session.lastSeenAt,
        lastSeenAt: now,
        idleExpiresAt: earlierDate(
          addMilliseconds(now, this.#config.sessionPolicy.idleLifetimeMs),
          session.absoluteExpiresAt,
        ),
      });
    }

    return Object.freeze({ actor: buildActor(session, identity, now), session });
  }

  async rotate(authenticated: AuthenticatedSession, now = new Date()): Promise<IssuedSession | null> {
    if (!isActiveAt(authenticated.session, now)) return null;

    const sessionToken = createOpaqueToken();
    const csrfToken = createOpaqueToken();
    const expiresAt = earlierDate(
      addMilliseconds(now, this.#config.sessionPolicy.tokenLifetimeMs),
      authenticated.session.absoluteExpiresAt,
    );
    const idleExpiresAt = earlierDate(
      addMilliseconds(now, this.#config.sessionPolicy.idleLifetimeMs),
      authenticated.session.absoluteExpiresAt,
    );
    if (expiresAt.getTime() <= now.getTime() || idleExpiresAt.getTime() <= now.getTime()) return null;

    const replacement: NewSessionRecord = {
      userId: authenticated.session.userId,
      tokenDigest: digestToken(sessionToken, "session", this.#config.sessionHashPepper),
      csrfTokenDigest: digestToken(csrfToken, "csrf", this.#config.sessionHashPepper),
      authMethod: authenticated.session.authMethod,
      demoRole: authenticated.session.demoRole,
      rotatedFromSessionId: authenticated.session.id,
      rotationGeneration: authenticated.session.rotationGeneration + 1,
      expiresAt,
      idleExpiresAt,
      absoluteExpiresAt: authenticated.session.absoluteExpiresAt,
      lastSeenAt: now,
      mfaVerifiedAt: authenticated.session.mfaVerifiedAt,
      createdAt: now,
      updatedAt: now,
    };
    const session = await this.#repository.rotateSession({
      currentSessionId: authenticated.session.id,
      currentTokenDigest: authenticated.session.tokenDigest,
      replacement,
      rotatedAt: now,
    });
    if (session === null) return null;

    const identity = await this.#repository.loadIdentity(session.userId);
    if (!identity.active) {
      await this.#repository.revokeSession({
        sessionId: session.id,
        tokenDigest: session.tokenDigest,
        reason: "USER_DISABLED",
        revokedAt: now,
      });
      return null;
    }
    return Object.freeze({
      actor: buildActor(session, identity, now),
      session,
      sessionToken,
      csrfToken,
    });
  }

  async revoke(
    authenticated: AuthenticatedSession,
    now = new Date(),
  ): Promise<boolean> {
    return this.#repository.revokeSession({
      sessionId: authenticated.session.id,
      tokenDigest: authenticated.session.tokenDigest,
      reason: "USER_LOGOUT",
      revokedAt: now,
    });
  }
}
