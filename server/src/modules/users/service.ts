import { releaseConnection } from "../../db/release-connection.js";
import argon2 from "argon2";
import type { ManagedUserInput, UserRole } from "@parautos/shared";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";

export type ManagedUser = { id: number; names: string; username: string; email: string; role: UserRole; active: boolean; createdAt: Date; deactivatedAt?: Date; anonymizedAt?: Date; canDelete: boolean; deleteHint: string };

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const rows = await getPool().query<Array<Omit<ManagedUser, "active" | "canDelete" | "deleteHint"> & { active: number; historyCount: number }>>(
    "SELECT u.id, u.names, u.username, u.email, r.code AS role, u.active, u.created_at AS createdAt, u.deactivated_at AS deactivatedAt, u.anonymized_at AS anonymizedAt, (SELECT COUNT(*) FROM audit_events ae WHERE ae.actor_user_id = u.id) + (SELECT COUNT(*) FROM service_orders so WHERE so.advisor_user_id = u.id) + (SELECT COUNT(*) FROM receptions re WHERE re.advisor_user_id = u.id) + (SELECT COUNT(*) FROM attachments at WHERE at.uploaded_by_user_id = u.id) AS historyCount FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.active DESC, u.names",
  );
  return rows.map((user) => {
    if (user.anonymizedAt) return { ...user, role: user.role as UserRole, active: false, canDelete: false, deleteHint: "Cuenta anonimizada" };
    const retentionRequired = Number(user.historyCount) > 0 || Date.now() - new Date(user.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000;
    const remaining = user.deactivatedAt ? Math.max(0, Math.ceil((30 * 24 * 60 * 60 * 1000 - (Date.now() - new Date(user.deactivatedAt).getTime())) / (24 * 60 * 60 * 1000))) : 30;
    const canDelete = !retentionRequired || (!user.active && remaining === 0);
    return { ...user, role: user.role as UserRole, active: Boolean(user.active), canDelete, deleteHint: canDelete ? Number(user.historyCount) > 0 ? "Anonimizar y retirar acceso" : "Eliminar permanentemente" : user.active ? "Requiere desactivación" : `Disponible en ${remaining} día(s)` };
  });
}

export async function createManagedUser(input: ManagedUserInput, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string): Promise<ManagedUser> {
  const pool = getPool();
  const roleRows = await pool.query<Array<{ id: number }>>("SELECT id FROM roles WHERE code = ? AND active = 1 LIMIT 1", [input.role]);
  if (!roleRows[0]) throw new AppError(400, "ROLE_NOT_FOUND", "El rol seleccionado no está disponible.");
  const existing = await pool.query<Array<{ username: string; email: string }>>("SELECT username, email FROM users WHERE username = ? OR email = ? LIMIT 1", [input.username, input.email.toLowerCase()]);
  if (existing[0]?.username === input.username) throw new AppError(409, "USERNAME_ALREADY_EXISTS", "El nombre de usuario ya está registrado.");
  if (existing[0]?.email === input.email.toLowerCase()) throw new AppError(409, "EMAIL_ALREADY_EXISTS", "El correo ya está registrado.");
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const connection = await pool.getConnection();
  let failed = true;
  let id: number;
  try {
    await connection.beginTransaction();
    const result = await connection.query<{ insertId: number }>("INSERT INTO users (role_id, names, username, email, password_hash) VALUES (?, ?, ?, ?, ?)", [roleRows[0].id, input.names, input.username, input.email.toLowerCase(), passwordHash]);
    id = Number(result.insertId);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'user', ?, 'USER_CREATED', JSON_OBJECT('username', ?, 'email', ?, 'role', ?), ?, ?, ?)", [actorUserId, String(id), input.username, input.email.toLowerCase(), input.role, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit();
    failed = false;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ER_DUP_ENTRY")
      throw new AppError(409, "USER_ALREADY_EXISTS", "El usuario o correo ya está registrado.");
    throw error;
  } finally { try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); } }
  const users = await listManagedUsers();
  return users.find((user) => user.id === id)!;
}

export async function setManagedUserActive(userId: number, active: boolean, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string): Promise<void> {
  if (userId === actorUserId && !active) throw new AppError(400, "SELF_DEACTIVATION", "No puede desactivar su propia cuenta.");
  const connection = await getPool().getConnection();
  let failed = true;
  try {
    await connection.beginTransaction();
  const result = await connection.query<{ affectedRows: number }>("UPDATE users SET active = ?, deactivated_at = CASE WHEN ? THEN NULL ELSE UTC_TIMESTAMP(6) END WHERE id = ? AND anonymized_at IS NULL", [active ? 1 : 0, active ? 1 : 0, userId]);
  if (!result.affectedRows) throw new AppError(404, "USER_NOT_FOUND", "El usuario no existe.");
  await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'user', ?, ?, JSON_OBJECT('active', ?), ?, ?, ?)", [actorUserId, String(userId), active ? "USER_ACTIVATED" : "USER_DEACTIVATED", active, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit();
    failed = false;
  } finally { try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); } }
}

export async function deleteManagedUser(userId: number, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string): Promise<void> {
  if (userId === actorUserId) throw new AppError(400, "SELF_DELETION", "No puede eliminar su propia cuenta.");
  const connection = await getPool().getConnection();
  let failed = true;
  try {
    await connection.beginTransaction();
    const user = (await connection.query<Array<{ id: number; username: string; role: UserRole; active: number; createdAt: Date; deactivatedAt?: Date; anonymizedAt?: Date }>>("SELECT u.id, u.username, u.active, u.created_at AS createdAt, u.deactivated_at AS deactivatedAt, u.anonymized_at AS anonymizedAt, r.code AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? FOR UPDATE", [userId]))[0];
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "El usuario no existe.");
    if (user.anonymizedAt) throw new AppError(409, "USER_ANONYMIZED", "La cuenta ya fue anonimizada y no puede modificarse.");
    if (user.role === "SUPERADMINISTRADOR") {
      const superadmins = await connection.query<Array<{ total: number }>>("SELECT COUNT(*) AS total FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'SUPERADMINISTRADOR' AND u.active = 1");
      if (Number(superadmins[0]?.total) <= 1) throw new AppError(400, "LAST_SUPERADMIN", "No puede eliminar al último superadministrador activo.");
    }
    const references = await connection.query<Array<{ total: number }>>("SELECT (SELECT COUNT(*) FROM audit_events WHERE actor_user_id = ?) + (SELECT COUNT(*) FROM service_orders WHERE advisor_user_id = ?) + (SELECT COUNT(*) FROM receptions WHERE advisor_user_id = ?) + (SELECT COUNT(*) FROM attachments WHERE uploaded_by_user_id = ?) AS total", [userId, userId, userId, userId]);
    const hasHistory = Number(references[0]?.total) > 0;
    const olderThanWeek = Date.now() - new Date(user.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000;
    if (hasHistory || olderThanWeek) {
      if (user.active || !user.deactivatedAt || Date.now() - new Date(user.deactivatedAt).getTime() < 30 * 24 * 60 * 60 * 1000) throw new AppError(409, "RETENTION_REQUIRED", "Esta cuenta debe permanecer inactiva durante 30 días antes de retirarla.");
    }
    if (hasHistory) {
      await connection.query("UPDATE users SET names = 'Usuario eliminado', username = CONCAT('deleted.', id), email = CONCAT('deleted.', id, '@invalid.local'), password_hash = 'ANONYMIZED', active = 0, anonymized_at = UTC_TIMESTAMP(6) WHERE id = ?", [userId]);
      await connection.query("DELETE FROM sessions WHERE user_id = ?", [userId]);
    } else {
      await connection.query("DELETE FROM sessions WHERE user_id = ?", [userId]);
      await connection.query("DELETE FROM users WHERE id = ?", [userId]);
    }
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'user', ?, ?, JSON_OBJECT('username', ?), ?, ?, ?)", [actorUserId, String(userId), hasHistory ? 'USER_ANONYMIZED' : 'USER_DELETED', user.username, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false;
  } finally { try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); } }
}
