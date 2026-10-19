import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getEnvironment } from "../config/env.js";
import { closePool, getDemoPool, runWithDatabaseScope } from "./pool.js";
import { seedDemo } from "./seed-demo.js";

async function seedDemoEnvironment(): Promise<void> {
  if (!getEnvironment().DEMO_MODE_ENABLED) return;
  const pool = getDemoPool();
  const role = (await pool.query<Array<{ id: number }>>("SELECT id FROM roles WHERE code = 'SUPERADMINISTRADOR' LIMIT 1"))[0];
  if (!role) throw new Error("Ejecute primero las migraciones de la base demo.");
  await pool.query("INSERT INTO users (role_id, names, username, email, password_hash, active) VALUES (?, 'Sistema demostración', 'demo.system', 'demo.system@invalid.local', 'DEMO_SEED_ONLY', 1) ON DUPLICATE KEY UPDATE active = 1", [role.id]);
  await runWithDatabaseScope("demo", () => seedDemo());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  seedDemoEnvironment().then(() => closePool()).catch(async (error: unknown) => { console.error(error); await closePool(); process.exitCode = 1; });
