/**
 * Lanzador local del purgado de la carga demo.
 * La implementación vive en `server/src/db/purge-1000-demo.ts`.
 *
 * Sin DEMO_PURGE_CONFIRM=PURGE solo simula (dry-run).
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const script = resolve(__dirname, "..", "server", "src", "db", "purge-1000-demo.ts");
const result = spawnSync(process.execPath, ["--import", "tsx", script], {
  stdio: "inherit",
  env: process.env,
  cwd: resolve(__dirname, "..", "server"),
});
process.exit(result.status ?? 1);
