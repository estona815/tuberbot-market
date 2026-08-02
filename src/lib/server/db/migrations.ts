import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const migrationFilePattern = /^\d{4}_[a-z0-9_]+\.sql$/;

export interface MigrationFile {
  name: string;
  path: string;
  sql: string;
  sha256: string;
}

export async function loadMigrationFiles(
  directory = path.resolve(process.cwd(), "db/migrations"),
): Promise<MigrationFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isFile() && migrationFilePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (names.length === 0) {
    throw new Error(`No migration files found in ${directory}`);
  }

  const duplicatePrefixes = names
    .map((name) => name.slice(0, 4))
    .filter((prefix, index, prefixes) => prefixes.indexOf(prefix) !== index);
  if (duplicatePrefixes.length > 0) {
    throw new Error(`Duplicate migration sequence: ${[...new Set(duplicatePrefixes)].join(", ")}`);
  }

  return Promise.all(
    names.map(async (name) => {
      const migrationPath = path.join(directory, name);
      const migrationSql = await readFile(migrationPath, "utf8");
      if (!migrationSql.trim()) {
        throw new Error(`Migration is empty: ${name}`);
      }

      return {
        name,
        path: migrationPath,
        sql: migrationSql,
        sha256: createHash("sha256").update(migrationSql).digest("hex"),
      };
    }),
  );
}

