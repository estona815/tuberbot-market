import { PGlite } from "@electric-sql/pglite";

import { loadMigrationFiles } from "../src/lib/server/db/migrations";

const requiredTables = [
  "users",
  "user_sessions",
  "organizations",
  "creator_profiles",
  "youtube_channels",
  "creator_packages",
  "campaigns",
  "proposals",
  "contract_versions",
  "orders",
  "order_status_events",
  "deliverables",
  "messages",
  "payment_intents",
  "payment_events",
  "refunds",
  "payouts",
  "payout_holds",
  "ledger_accounts",
  "ledger_transactions",
  "ledger_entries",
  "disputes",
  "licenses",
  "webhook_events",
  "outbox_events",
  "idempotency_keys",
  "audit_logs",
  "feature_flags",
] as const;

function rejectDestructiveDdl(name: string, migrationSql: string): void {
  const withoutComments = migrationSql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ");

  if (/\b(drop\s+(table|schema|column|type)|truncate\s+table)\b/i.test(withoutComments)) {
    throw new Error(`Destructive DDL is not permitted in migration ${name}`);
  }
}

async function main(): Promise<void> {
  const migrations = await loadMigrationFiles();
  const database = new PGlite();

  try {
    for (const migration of migrations) {
      rejectDestructiveDdl(migration.name, migration.sql);
      await database.exec(migration.sql);
      console.info(`[db:check] ${migration.name}: dry-run applied`);
    }

    const result = await database.query<{ table_name: string }>(
      `select table_name
         from information_schema.tables
        where table_schema = 'public'
          and table_name = any($1::text[])
        order by table_name`,
      [[...requiredTables]],
    );
    const found = new Set(result.rows.map((row) => row.table_name));
    const missing = requiredTables.filter((name) => !found.has(name));

    if (missing.length > 0) {
      throw new Error(`Migration dry-run is missing required tables: ${missing.join(", ")}`);
    }

    const guardResult = await database.query<{ trigger_name: string }>(
      `select distinct trigger_name
         from information_schema.triggers
        where trigger_schema = 'public'
          and trigger_name in (
            'ledger_transactions_posting_guard',
            'ledger_entries_draft_only',
            'payouts_authority_guard',
            'audit_logs_append_only'
          )`,
    );

    if (guardResult.rows.length !== 4) {
      throw new Error("Migration dry-run did not install every required authority guard");
    }

    const missingForeignKeyIndexes = await database.query<{
      table_name: string;
      column_name: string;
    }>(`
      select c.conrelid::regclass::text as table_name, a.attname as column_name
        from pg_constraint c
        join pg_attribute a
          on a.attrelid = c.conrelid
         and a.attnum = any(c.conkey)
       where c.contype = 'f'
         and not exists (
           select 1
            from pg_index i
           where i.indrelid = c.conrelid
              and a.attnum = i.indkey[0]
         )
       order by c.conrelid::regclass::text, a.attname
    `);

    if (missingForeignKeyIndexes.rows.length > 0) {
      const columns = missingForeignKeyIndexes.rows
        .map((row) => `${row.table_name}.${row.column_name}`)
        .join(", ");
      throw new Error(`Foreign-key columns without supporting indexes: ${columns}`);
    }

    const unsafeTimestampColumns = await database.query<{ qualified_name: string }>(`
      select table_name || '.' || column_name as qualified_name
        from information_schema.columns
       where table_schema = 'public'
         and data_type = 'timestamp without time zone'
       order by table_name, ordinal_position
    `);
    if (unsafeTimestampColumns.rows.length > 0) {
      throw new Error(
        `UTC-unsafe timestamp columns: ${unsafeTimestampColumns.rows.map((row) => row.qualified_name).join(", ")}`,
      );
    }

    const invalidKrwColumns = await database.query<{ qualified_name: string }>(`
      select table_name || '.' || column_name as qualified_name
        from information_schema.columns
       where table_schema = 'public'
         and column_name like '%\\_krw' escape '\\'
         and data_type <> 'bigint'
       order by table_name, ordinal_position
    `);
    if (invalidKrwColumns.rows.length > 0) {
      throw new Error(
        `KRW columns must be bigint: ${invalidKrwColumns.rows.map((row) => row.qualified_name).join(", ")}`,
      );
    }

    const invalidPublicIds = await database.query<{ qualified_name: string }>(`
      select table_name || '.id' as qualified_name
        from information_schema.columns
       where table_schema = 'public'
         and column_name = 'id'
         and data_type <> 'uuid'
       order by table_name
    `);
    if (invalidPublicIds.rows.length > 0) {
      throw new Error(
        `Public IDs must be UUID: ${invalidPublicIds.rows.map((row) => row.qualified_name).join(", ")}`,
      );
    }

    const sessionColumns = await database.query<{ column_name: string }>(`
      select column_name
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'user_sessions'
       order by ordinal_position
    `);
    const sessionColumnNames = new Set(sessionColumns.rows.map((row) => row.column_name));
    if (
      !sessionColumnNames.has("token_digest")
      || !sessionColumnNames.has("csrf_token_digest")
      || sessionColumnNames.has("token")
      || sessionColumnNames.has("csrf_token")
    ) {
      throw new Error("user_sessions must persist digests only, never raw tokens");
    }

    console.info(
      `[db:check] ${migrations.length} migrations, ${found.size} required tables, ${guardResult.rows.length} guards, FK indexes, digest-only sessions, UUID IDs, bigint KRW, and UTC timestamps verified`,
    );
  } finally {
    await database.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown migration check failure";
  console.error(`[db:check] failed: ${message}`);
  process.exitCode = 1;
});
