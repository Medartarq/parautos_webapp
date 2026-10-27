import { releaseConnection } from "../../db/release-connection.js";
import { timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import type { PoolConnection } from "mariadb";
import type { BootstrapAdminInput } from "@parautos/shared";
import { getEnvironment } from "../../config/env.js";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";

type CountRow = { total: number };
type RoleRow = { id: number };

function matchesBootstrapToken(token: string, expectedToken: string): boolean {
  const received = Buffer.from(token);
  const expected = Buffer.from(expectedToken);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function releaseTransaction(connection: PoolConnection, failed: boolean): Promise<void> {
  try {
    if (failed) await connection.rollback();
    else await connection.commit();
  } finally { await releaseConnection(connection); }
}

export async function getSetupStatus(): Promise<{ configured: boolean }> {
  const rows = await getPool().query<CountRow[]>("SELECT COUNT(*) AS total FROM users WHERE active = 1");
  return { configured: Number(rows[0]?.total ?? 0) > 0 };
}

export async function bootstrapAdministrator(input: BootstrapAdminInput, requestId: string, ipAddress?: string, userAgent?: string): Promise<void> {
  const env = getEnvironment();
  if (!env.BOOTSTRAP_ADMIN_TOKEN)
    throw new AppError(409, "SETUP_DISABLED", "La configuración inicial ya no está disponible.");
  if (!matchesBootstrapToken(input.token, env.BOOTSTRAP_ADMIN_TOKEN)) {
    throw new AppError(403, "INVALID_BOOTSTRAP_TOKEN", "El token de configuracion no es valido.");
  }
  if (input.email.toLowerCase() !== env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    throw new AppError(403, "INVALID_BOOTSTRAP_EMAIL", "El correo no coincide con la configuracion inicial.");
  }

  const connection = await getPool().getConnection();
  let failed = true;
  try {
    await connection.beginTransaction();
    const users = await connection.query<CountRow[]>("SELECT COUNT(*) AS total FROM users FOR UPDATE");
    if (Number(users[0]?.total ?? 0) > 0) {
      throw new AppError(409, "SETUP_ALREADY_COMPLETED", "La configuracion inicial ya fue completada.");
    }

    const roles = await connection.query<RoleRow[]>("SELECT id FROM roles WHERE code = 'SUPERADMINISTRADOR' AND active = 1 LIMIT 1");
    const role = roles[0];
    if (!role) throw new AppError(500, "SUPERADMIN_ROLE_MISSING", "No existe el rol de superadministrador.");

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const result = await connection.query<{ insertId: number }>(
      "INSERT INTO users (role_id, names, username, email, password_hash) VALUES (?, ?, ?, ?, ?)",
      [role.id, input.names, input.username, input.email.toLowerCase(), passwordHash]
    );
    const userId = Number(result.insertId);
    await connection.query(
      "INSERT INTO app_settings (setting_key, setting_value) VALUES ('bootstrap_completed_at', UTC_TIMESTAMP(6))"
    );
    await connection.query(
      `INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent)
       VALUES (?, 'user', ?, 'BOOTSTRAP_ADMIN_CREATED', JSON_OBJECT('email', ?, 'username', ?), ?, ?, ?)`,
      [userId, String(userId), input.email.toLowerCase(), input.username, requestId, ipAddress ?? null, userAgent ?? null]
    );
    failed = false;
  } finally {
    await releaseTransaction(connection, failed);
  }
}
