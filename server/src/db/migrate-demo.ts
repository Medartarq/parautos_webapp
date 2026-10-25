import { technicalLogger } from "../logging/technical-logger.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getEnvironment } from "../config/env.js";
import { closePool, getDemoPool } from "./pool.js";
import { applyMigrations } from "./migrate.js";

async function migrateDemo(): Promise<void> {
  if (!getEnvironment().DEMO_MODE_ENABLED) return;
  await applyMigrations(getDemoPool());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrateDemo().then(() => closePool()).catch(async (error: unknown) => {
    technicalLogger.failure("database_task_failed", error);
    await closePool();
    process.exitCode = 1;
  });
}
