import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadMigrationFiles } from "../../src/lib/server/db/migrations";

const userId = "00000000-0000-4000-8000-00000000a001";
const firstSessionId = "00000000-0000-4000-8000-00000000a011";
const secondSessionId = "00000000-0000-4000-8000-00000000a012";
const firstDigest = "a".repeat(64);
const firstCsrfDigest = "b".repeat(64);
const secondDigest = "c".repeat(64);
const secondCsrfDigest = "d".repeat(64);

describe.sequential("user session persistence boundary", () => {
  const database = new PGlite();

  beforeAll(async () => {
    for (const migration of await loadMigrationFiles()) await database.exec(migration.sql);
    await database.exec(`
      insert into users (id, email, display_name)
      values ('${userId}', 'auth-session@example.invalid', 'Auth Session Fixture');
    `);
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it("persists digest columns and no raw token columns", async () => {
    const result = await database.query<{ column_name: string }>(`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'user_sessions'
      order by ordinal_position
    `);
    const columns = result.rows.map((row) => row.column_name);
    expect(columns).toContain("token_digest");
    expect(columns).toContain("csrf_token_digest");
    expect(columns).not.toContain("token");
    expect(columns).not.toContain("csrf_token");
  });

  it("accepts a bounded local-demo session and rejects malformed digests", async () => {
    await database.exec(`
      insert into user_sessions (
        id, user_id, token_digest, csrf_token_digest, auth_method, demo_role,
        rotation_generation, expires_at, idle_expires_at, absolute_expires_at,
        last_seen_at, created_at, updated_at
      ) values (
        '${firstSessionId}', '${userId}', '${firstDigest}', '${firstCsrfDigest}',
        'LOCAL_DEMO', 'ADVERTISER', 0,
        '2026-08-02T16:00:00Z', '2026-08-02T08:30:00Z', '2026-08-03T08:00:00Z',
        '2026-08-02T08:00:00Z', '2026-08-02T08:00:00Z', '2026-08-02T08:00:00Z'
      );
    `);

    await expect(
      database.exec(`
        insert into user_sessions (
          user_id, token_digest, csrf_token_digest, auth_method, demo_role,
          expires_at, idle_expires_at, absolute_expires_at, last_seen_at, created_at
        ) values (
          '${userId}', 'raw-token-value', '${secondCsrfDigest}', 'LOCAL_DEMO', 'CREATOR',
          '2026-08-02T16:00:00Z', '2026-08-02T08:30:00Z', '2026-08-03T08:00:00Z',
          '2026-08-02T08:00:00Z', '2026-08-02T08:00:00Z'
        );
      `),
    ).rejects.toThrow(/token_digest_check|check constraint/i);
  });

  it("enforces rotation lineage uniqueness and revocation reasons", async () => {
    await database.exec(`
      update user_sessions
      set revoked_at = '2026-08-02T08:05:00Z', revoke_reason = 'ROTATED'
      where id = '${firstSessionId}';

      insert into user_sessions (
        id, user_id, token_digest, csrf_token_digest, auth_method, demo_role,
        rotated_from_session_id, rotation_generation, expires_at, idle_expires_at,
        absolute_expires_at, last_seen_at, created_at, updated_at
      ) values (
        '${secondSessionId}', '${userId}', '${secondDigest}', '${secondCsrfDigest}',
        'LOCAL_DEMO', 'ADVERTISER', '${firstSessionId}', 1,
        '2026-08-02T16:05:00Z', '2026-08-02T08:35:00Z', '2026-08-03T08:00:00Z',
        '2026-08-02T08:05:00Z', '2026-08-02T08:05:00Z', '2026-08-02T08:05:00Z'
      );
    `);

    await expect(
      database.exec(`
        insert into user_sessions (
          user_id, token_digest, csrf_token_digest, auth_method, demo_role,
          rotated_from_session_id, rotation_generation, expires_at, idle_expires_at,
          absolute_expires_at, last_seen_at, created_at
        ) values (
          '${userId}', '${"e".repeat(64)}', '${"f".repeat(64)}',
          'LOCAL_DEMO', 'ADVERTISER', '${firstSessionId}', 1,
          '2026-08-02T16:06:00Z', '2026-08-02T08:36:00Z', '2026-08-03T08:00:00Z',
          '2026-08-02T08:06:00Z', '2026-08-02T08:06:00Z'
        );
      `),
    ).rejects.toThrow(/rotated_from_uidx|duplicate key/i);

    await expect(
      database.exec(`
        update user_sessions
        set revoked_at = '2026-08-02T08:10:00Z', revoke_reason = 'ARBITRARY_REASON'
        where id = '${secondSessionId}';
      `),
    ).rejects.toThrow(/revocation_check|check constraint/i);
  });
});
