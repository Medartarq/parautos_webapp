import type { NextFunction, Request, Response } from "express";
import { getEnvironment } from "../config/env.js";
import { getDemoPool, runWithDatabaseScope } from "../db/pool.js";
import { getCurrentUser, sessionCookieName } from "../modules/auth/service.js";

const demoCookie = "parautos_demo_mode";

function hasDemoCookie(header: string | undefined): boolean {
  return Boolean(header?.split(";").some((value) => value.trim() === `${demoCookie}=1`));
}

function sessionToken(header: string | undefined): string | undefined {
  return header?.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${sessionCookieName}=`))?.slice(sessionCookieName.length + 1);
}

async function mirrorSuperadministrator(user: { id: number; names: string; username: string; email: string }): Promise<void> {
  const pool = getDemoPool();
  const role = (await pool.query<Array<{ id: number }>>("SELECT id FROM roles WHERE code = 'SUPERADMINISTRADOR' LIMIT 1"))[0];
  if (!role) throw new Error("La base demo no contiene el rol de superadministrador.");
  await pool.query("INSERT INTO users (id, role_id, names, username, email, password_hash, active) VALUES (?, ?, ?, ?, ?, 'DEMO_SESSION_ONLY', 1) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), names = VALUES(names), username = VALUES(username), email = VALUES(email), active = 1", [user.id, role.id, user.names, user.username, user.email]);
}

export async function demoContext(request: Request, _response: Response, next: NextFunction): Promise<void> {
  try {
    if (!getEnvironment().DEMO_MODE_ENABLED || !hasDemoCookie(request.headers.cookie)) return next();
    const token = sessionToken(request.headers.cookie);
    const user = token ? await getCurrentUser(token) : undefined;
    if (!user || user.role !== "SUPERADMINISTRADOR") return next();
    await mirrorSuperadministrator(user);
    runWithDatabaseScope("demo", next);
  } catch (error) {
    next(error);
  }
}

export { demoCookie };
