import { spawn } from "node:child_process";
import { resolve } from "node:path";

if (process.env.DEPLOY_RUN_MIGRATIONS !== "true") {
  console.info("Database migrations skipped. Set DEPLOY_RUN_MIGRATIONS=true only in the deployment environment.");
  process.exit(0);
}

// Resolve tsx path once so the child process can find it
const tsxPath = resolve(require.resolve("tsx"), ".."); // tsx entry dir, we'll use the binary via spawn
// Actually, simpler: spawn with the full tsx path
const tsxBinary = resolve("tsx");

function run(script) {
  return new Promise((resolve, reject) => {
    // Use the full resolved path to tsx so the child process can require/resolve it
    const migration = spawn(process.execPath, [tsxBinary, script], { env: process.env, stdio: "inherit" });
    migration.on("error", reject);
    migration.on("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Database migrations failed${signal ? ` (${signal})` : ""}.`)));
  });
}

console.info("Applying database migrations before publishing the deployment.");
try {
  await run("server/src/db/migrate.ts");
  if (process.env.DEMO_MODE_ENABLED === "true") {
    console.info("Running demo database migrations and seed...");
    await run("server/src/db/seed-demo.ts");
    // Cargar 1000 casos ficticios en la base demo para entornos de prueba
    console.info("Seeding 1000 demo orders from scripts/...");
    await run("scripts/seed-1000-demo.ts");
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}