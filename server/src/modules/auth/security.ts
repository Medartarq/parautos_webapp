import { getPool } from "../../db/pool.js";

export const loginIpPolicy = { windowSeconds: 60, maxAttempts: 20 };
export const loginIdentifierPolicy = { windowSeconds: 60, maxAttempts: 5 };
export const bootstrapIpPolicy = { windowSeconds: 60, maxAttempts: 5 };
export const bootstrapEmailPolicy = { windowSeconds: 60, maxAttempts: 3 };

export function normalizedIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

export async function progressiveAuthDelay(attempts: number): Promise<void> {
  const delay = Math.min(1_500, Math.max(0, attempts - 1) * 250);
  if (delay) await new Promise<void>((resolve) => setTimeout(resolve, delay));
}

export async function recordRateLimitedAttempt(
  scope: string,
  attempts: number,
  requestId: string,
  ipAddress: string | undefined,
  userAgent: string | undefined,
): Promise<void> {
  await getPool().query(
    `INSERT INTO audit_events (entity, record_id, action, new_data, request_id, ip_address, user_agent)
     VALUES ('authentication', ?, 'RATE_LIMITED', JSON_OBJECT('scope', ?, 'attempts', ?), ?, ?, ?)`,
    [scope, scope, attempts, requestId, ipAddress ?? null, userAgent ?? null],
  );
}
