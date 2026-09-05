import "server-only";
import { createHash } from "node:crypto";
import { getDatabase, type DatabaseResources } from "./db/client";
/** Atomic shared PostgreSQL quota. No per-process fallback in a multi-instance deployment. */
export async function consumeServiceLimit(key: string, limit: number, seconds: number, resources: DatabaseResources = getDatabase(), now = new Date()): Promise<boolean> {
  if (!key || key.length > 512 || !Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(seconds) || seconds < 1) throw new Error("Invalid quota configuration");
  const digest = createHash("sha256").update(key).digest("hex");
  const start = new Date(Math.floor(now.getTime() / (seconds * 1000)) * seconds * 1000);
  const expiry = new Date(start.getTime() + seconds * 1000);
  const rows = await resources.queryClient<{ request_count: number }[]>`
    INSERT INTO service_rate_limits (key_digest, window_start, request_count, expires_at)
    VALUES (${digest}, ${start}, 1, ${expiry})
    ON CONFLICT (key_digest) DO UPDATE SET
      request_count = CASE WHEN service_rate_limits.window_start = excluded.window_start THEN LEAST(service_rate_limits.request_count + 1, ${limit + 1}) ELSE 1 END,
      window_start = excluded.window_start, expires_at = excluded.expires_at
    RETURNING request_count
  `;
  return (rows[0]?.request_count ?? limit + 1) <= limit;
}
