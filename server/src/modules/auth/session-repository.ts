import type { CurrentUser } from "@parautos/shared";
import { getProductionPool } from "../../db/pool.js";

export type AuthenticatedUserRow = CurrentUser & { password_hash: string };

export interface SessionRepository {
  findActiveUser(identifier: string): Promise<AuthenticatedUserRow | undefined>;
  createSession(userId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  findCurrentUser(tokenHash: string): Promise<CurrentUser | undefined>;
  touchSession(tokenHash: string): Promise<void>;
  revokeSession(tokenHash: string): Promise<void>;
}

/** MariaDB adapter. Sessions intentionally remain in the production database. */
export const mariaDbSessionRepository: SessionRepository = {
  async findActiveUser(identifier) {
    return (await getProductionPool().query<AuthenticatedUserRow[]>(
      `SELECT u.id, u.names, u.username, u.email, r.code AS role, u.password_hash
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE (u.email = ? OR u.username = ?) AND u.active = 1 AND r.active = 1 LIMIT 1`,
      [identifier.toLowerCase(), identifier],
    ))[0];
  },
  async createSession(userId, tokenHash, expiresAt) {
    await getProductionPool().query(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
      [userId, tokenHash, expiresAt],
    );
  },
  async findCurrentUser(tokenHash) {
    return (await getProductionPool().query<CurrentUser[]>(
      `SELECT u.id, u.names, u.username, u.email, r.code AS role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP(6)
         AND u.active = 1 AND r.active = 1
       LIMIT 1`,
      [tokenHash],
    ))[0];
  },
  async touchSession(tokenHash) {
    await getProductionPool().query("UPDATE sessions SET last_seen_at = UTC_TIMESTAMP(6) WHERE token_hash = ?", [tokenHash]);
  },
  async revokeSession(tokenHash) {
    await getProductionPool().query("UPDATE sessions SET revoked_at = UTC_TIMESTAMP(6) WHERE token_hash = ? AND revoked_at IS NULL", [tokenHash]);
  },
};
