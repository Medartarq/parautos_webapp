import argon2 from "argon2";
import type { ManagedUserInput, UserRole } from "@parautos/shared";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";

export type ManagedUser = { id: number; names: string; username: string; email: string; role: UserRole; active: boolean; createdAt: Date };

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const rows = await getPool().query<Array<Omit<ManagedUser, "active"> & { active: number }>>(
    "SELECT u.id, u.names, u.username, u.email, r.code AS role, u.active, u.created_at AS createdAt FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.active DESC, u.names",
  );
  return rows.map((user) => ({ ...user, role: user.role as UserRole, active: Boolean(user.active) }));
}

export async function createManagedUser(input: ManagedUserInput, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string): Promise<ManagedUser> {
  const pool = getPool();
  const roleRows = await pool.query<Array<{ id: number }>>("SELECT id FROM roles WHERE code = ? AND active = 1 LIMIT 1", [input.role]);
  if (!roleRows[0]) throw new AppError(400, "ROLE_NOT_FOUND", "El rol seleccionado no está disponible.");
  try {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const result = await pool.query<{ insertId: number }>("INSERT INTO users (role_id, names, username, email, password_hash) VALUES (?, ?, ?, ?, ?)", [roleRows[0].id, input.names, input.username, input.email.toLowerCase(), passwordHash]);
    const id = Number(result.insertId);
    await pool.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'user', ?, 'USER_CREATED', JSON_OBJECT('username', ?, 'email', ?, 'role', ?), ?, ?, ?)", [actorUserId, String(id), input.username, input.email.toLowerCase(), input.role, requestId, ipAddress ?? null, userAgent ?? null]);
    const users = await listManagedUsers();
    return users.find((user) => user.id === id)!;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ER_DUP_ENTRY")
      throw new AppError(409, "USER_ALREADY_EXISTS", "El usuario o correo ya está registrado.");
    throw error;
  }
}

export async function setManagedUserActive(userId: number, active: boolean, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string): Promise<void> {
  if (userId === actorUserId && !active) throw new AppError(400, "SELF_DEACTIVATION", "No puede desactivar su propia cuenta.");
  const result = await getPool().query<{ affectedRows: number }>("UPDATE users SET active = ? WHERE id = ?", [active ? 1 : 0, userId]);
  if (!result.affectedRows) throw new AppError(404, "USER_NOT_FOUND", "El usuario no existe.");
  await getPool().query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'user', ?, ?, JSON_OBJECT('active', ?), ?, ?, ?)", [actorUserId, String(userId), active ? "USER_ACTIVATED" : "USER_DEACTIVATED", active, requestId, ipAddress ?? null, userAgent ?? null]);
}
