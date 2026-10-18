import { createHash } from "node:crypto";
import { getPool } from "../../db/pool.js";

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<T> };

export type RateLimitPolicy = { windowSeconds: number; maxAttempts: number };
const trackingPolicy: RateLimitPolicy = { windowSeconds: 60, maxAttempts: 10 };
let lastPruneAt = 0;

function clientKeyHash(clientKey: string): string {
  return createHash("sha256").update(clientKey).digest("hex");
}

async function pruneExpiredRows(database: Queryable): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < 15 * 60_000) return;
  lastPruneAt = now;
  await database.query(
    "DELETE FROM api_rate_limits WHERE window_started_at < DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 2 HOUR) LIMIT 500",
  );
}

export async function consumeRateLimit(
  scope: string,
  clientKey: string,
  policy: RateLimitPolicy = trackingPolicy,
  database: Queryable = getPool(),
): Promise<{ attempts: number; limited: boolean }> {
  await pruneExpiredRows(database);
  const hash = clientKeyHash(clientKey);
  await database.query(
    `INSERT INTO api_rate_limits (scope, client_key_hash, window_started_at, attempts)
     VALUES (?, ?, UTC_TIMESTAMP(6), 1)
     ON DUPLICATE KEY UPDATE
       attempts = IF(window_started_at <= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL ${policy.windowSeconds} SECOND), 1, LEAST(attempts + 1, ${policy.maxAttempts + 1})),
       window_started_at = IF(window_started_at <= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL ${policy.windowSeconds} SECOND), UTC_TIMESTAMP(6), window_started_at)`,
    [scope, hash],
  );
  const rows = await database.query<Array<{ attempts: number }>>(
    "SELECT attempts FROM api_rate_limits WHERE scope = ? AND client_key_hash = ?",
    [scope, hash],
  );
  const attempts = Number(rows[0]?.attempts ?? policy.maxAttempts + 1);
  return { attempts, limited: attempts > policy.maxAttempts };
}

export async function clearRateLimit(scope: string, clientKey: string, database: Queryable = getPool()): Promise<void> {
  await database.query("DELETE FROM api_rate_limits WHERE scope = ? AND client_key_hash = ?", [scope, clientKeyHash(clientKey)]);
}
