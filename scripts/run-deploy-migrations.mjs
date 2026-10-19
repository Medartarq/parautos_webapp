import { spawn } from "node:child_process";

if (process.env.DEPLOY_RUN_MIGRATIONS !== "true") {
  console.info("Database migrations skipped. Set DEPLOY_RUN_MIGRATIONS=true only in the deployment environment.");
  process.exit(0);
}

console.info("Applying database migrations before publishing the deployment.");
const migration = spawn(process.execPath, ["server/dist/db/migrate.js"], {
  env: process.env,
  stdio: "inherit",
});
migration.on("error", (error) => {
  console.error("Could not start database migrations.", error);
  process.exitCode = 1;
});
migration.on("exit", (code, signal) => {
  if (code === 0) return;
  console.error(`Database migrations failed${signal ? ` (${signal})` : ""}.`);
  process.exitCode = code ?? 1;
});
