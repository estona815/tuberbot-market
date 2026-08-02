import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export function createDatabase(databaseUrl: string) {
  if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL must use the postgres:// or postgresql:// scheme");
  }

  const queryClient = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    connection: { application_name: "tuberbot-market" },
    onnotice: () => undefined,
  });

  return {
    db: drizzle(queryClient, { schema }),
    queryClient,
  };
}

export type DatabaseResources = ReturnType<typeof createDatabase>;
export type Database = DatabaseResources["db"];

const databaseGlobal = globalThis as typeof globalThis & {
  __tuberbotDatabaseResources?: DatabaseResources;
};

export function getDatabase(): DatabaseResources {
  if (databaseGlobal.__tuberbotDatabaseResources) {
    return databaseGlobal.__tuberbotDatabaseResources;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required before database access");
  }

  databaseGlobal.__tuberbotDatabaseResources = createDatabase(databaseUrl);
  return databaseGlobal.__tuberbotDatabaseResources;
}

export async function closeDatabase(): Promise<void> {
  const resources = databaseGlobal.__tuberbotDatabaseResources;
  if (!resources) {
    return;
  }

  await resources.queryClient.end({ timeout: 5 });
  databaseGlobal.__tuberbotDatabaseResources = undefined;
}
