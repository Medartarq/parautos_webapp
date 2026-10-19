import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { CurrentUser, LoginInput, UserRole } from "@parautos/shared";
import { getEnvironment } from "../../config/env.js";
import { getProductionPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";

type UserRow = CurrentUser & { password_hash: string };

export const sessionCookieName = "parautos_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + getEnvironment().SESSION_TTL_HOURS);
  return expiresAt;
}

export function cookieOptions() {
  const env = getEnvironment();
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000
  };
}

export async function login(input: LoginInput): Promise<{ user: CurrentUser; token: string }> {
  const rows = await getProductionPool().query<UserRow[]>(
    `SELECT u.id, u.names, u.username, u.email, r.code AS role, u.password_hash
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE (u.email = ? OR u.username = ?) AND u.active = 1 AND r.active = 1 LIMIT 1`,
    [input.identifier.toLowerCase(), input.identifier]
  );
  const user = rows[0];
  if (!user || !(await argon2.verify(user.password_hash, input.password))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Usuario o contrasena incorrectos.");
  }

  const token = randomBytes(32).toString("base64url");
  await getProductionPool().query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [user.id, hashToken(token), sessionExpiry()]
  );
  const { password_hash: _passwordHash, ...currentUser } = user;
  return { user: { ...currentUser, role: currentUser.role as UserRole }, token };
}

export async function getCurrentUser(token: string): Promise<CurrentUser | undefined> {
  const rows = await getProductionPool().query<CurrentUser[]>(
    `SELECT u.id, u.names, u.username, u.email, r.code AS role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP(6)
       AND u.active = 1 AND r.active = 1
     LIMIT 1`,
    [hashToken(token)]
  );
  const user = rows[0];
  if (!user) return undefined;
  await getProductionPool().query("UPDATE sessions SET last_seen_at = UTC_TIMESTAMP(6) WHERE token_hash = ?", [hashToken(token)]);
  return { ...user, role: user.role as UserRole };
}

export async function logout(token: string): Promise<void> {
  await getProductionPool().query("UPDATE sessions SET revoked_at = UTC_TIMESTAMP(6) WHERE token_hash = ? AND revoked_at IS NULL", [hashToken(token)]);
}
