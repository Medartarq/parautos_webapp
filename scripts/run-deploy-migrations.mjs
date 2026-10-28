import { spawn } from "node:child_process";

if (process.env.DEPLOY_RUN_MIGRATIONS !== "true") {
  console.info("Database migrations skipped. Set DEPLOY_RUN_MIGRATIONS=true only in the deployment environment.");
  process.exit(0);
}

function run(script) {
  return new Promise((resolve, reject) => {
    // Usar npx tsx para ejecutar scripts TypeScript, igual que hace el proyecto
    const migration = spawn("npx", ["tsx", script], {
      env: process.env,
      stdio: "inherit",
      shell: true,
    });
    migration.on("error", reject);
    migration.on("exit", (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`Script failed${signal ? ` (${signal})` : ""}.`))
    );
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