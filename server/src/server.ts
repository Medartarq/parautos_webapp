import { createApp } from "./app.js";
import { getEnvironment } from "./config/env.js";
import { getPool } from "./db/pool.js";
import { applyMigrations } from "./db/migrate.js";

async function start(): Promise<void> {
  const env = getEnvironment();
  if (env.RUN_MIGRATIONS_ON_START) {
    console.info("Applying database migrations before starting PARAUTOS API.");
    await applyMigrations(getPool());
  }
  const app = createApp();
  app.listen(env.PORT, "0.0.0.0", () => {
    console.info(`PARAUTOS API listening on port ${env.PORT}`);
  });
}

start().catch((error: unknown) => {
  console.error("PARAUTOS API could not start.", error);
  process.exitCode = 1;
});
