import { spawn } from "node:child_process";

if (process.env.DEPLOY_RUN_MIGRATIONS !== "true") {
  console.info("Database migrations skipped. Set DEPLOY_RUN_MIGRATIONS=true only in the deployment environment.");
  process.exit(0);
}

function run(script) {
  return new Promise((resolve, reject) => {
    const migration = spawn(process.execPath, [script], { env: process.env, stdio: "inherit" });
    migration.on("error", reject);
    migration.on("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Database migrations failed${signal ? ` (${signal})` : ""}.`)));
  });
}

console.info("Applying database migrations before publishing the deployment.");
try {
  await run("server/dist/db/migrate.js");
  if (process.env.DEMO_MODE_ENABLED === "true") {
    await run("server/dist/db/migrate-demo.js");
    await run("server/dist/db/seed-demo-environment.js");
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
