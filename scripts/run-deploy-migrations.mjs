import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// En Hostinger las variables pueden vivir en .env; este script corre antes de
// que la aplicación cargue dotenv, así que se leen aquí sin sobrescribir el
// entorno real de la plataforma.
function loadDotEnv() {
  try {
    const content = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      let value = rawValue.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      )
        value = value.slice(1, -1);
      process.env[key] = value;
    }
  } catch {
    // Sin .env: se usa el entorno provisto por la plataforma.
  }
}

loadDotEnv();

if (process.env.DEPLOY_RUN_MIGRATIONS !== "true") {
  console.info("Database migrations skipped. Set DEPLOY_RUN_MIGRATIONS=true only in the deployment environment.");
  process.exit(0);
}

function run(script) {
  if (!existsSync(script)) {
    console.error(`No se encontró el script compilado: ${script}. Ejecute "npm run build:app" antes.`);
    process.exitCode = 1;
    return Promise.reject(new Error(`Missing compiled script: ${script}`));
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { env: process.env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`Script failed: ${script}${signal ? ` (${signal})` : ""}.`))
    );
  });
}

console.info("Applying database migrations before publishing the deployment.");
try {
  await run("server/dist/db/migrate.js");
  if (process.env.DEMO_MODE_ENABLED === "true") {
    console.info("Applying demo database migrations and base demo seed...");
    await run("server/dist/db/migrate-demo.js");
    await run("server/dist/db/seed-demo-environment.js");
    if (process.env.DEMO_SEED_1000 !== "false") {
      if (process.env.DEMO_PURGE_CONFIRM === "PURGE") {
        console.info("Purging the previous fictional demo batch before reloading it...");
        await run("server/dist/db/purge-1000-demo.js");
      }
      console.info("Loading fictional demo orders for the pagination and volume test...");
      await run("server/dist/db/seed-1000-demo.js");
    }
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
