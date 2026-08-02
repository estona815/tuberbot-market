import postgres from "postgres";

import { loadMigrationFiles } from "../src/lib/server/db/migrations";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 5,
  connection: { application_name: "tuberbot-migrator" },
  onnotice: () => undefined,
});

async function main(): Promise<void> {
  const migrations = await loadMigrationFiles();

  try {
    await sql`
      create table if not exists tuberbot_schema_migrations (
        name text primary key,
        sha256 text not null,
        applied_at timestamptz not null default now()
      )
    `;

    for (const migration of migrations) {
      const result = await sql.begin(async (transaction) => {
        await transaction`select pg_advisory_xact_lock(hashtext('tuberbot-schema-migrations'))`;
        await transaction`set local time zone 'UTC'`;

        const existing = await transaction<{ sha256: string }[]>`
          select sha256
          from tuberbot_schema_migrations
          where name = ${migration.name}
          for update
        `;

        if (existing[0]) {
          if (existing[0].sha256 !== migration.sha256) {
            throw new Error(
              `Applied migration checksum mismatch for ${migration.name}; create a new additive migration instead`,
            );
          }
          return "already-applied" as const;
        }

        await transaction.unsafe(migration.sql);
        await transaction`
          insert into tuberbot_schema_migrations (name, sha256)
          values (${migration.name}, ${migration.sha256})
        `;
        return "applied" as const;
      });

      console.info(`[db:migrate] ${migration.name}: ${result}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown migration failure";
  console.error(`[db:migrate] failed: ${message}`);
  process.exitCode = 1;
});
