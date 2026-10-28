/**
 * Lanzador local de la carga de 1.000 casos demo.
 * La implementación vive en `server/src/db/seed-1000-demo.ts` para que también
 * se compile a `server/dist` y el despliegue pueda ejecutarla con `node`.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const script = resolve(__dirname, "..", "server", "src", "db", "seed-1000-demo.ts");
const result = spawnSync(process.execPath, ["--import", "tsx", script], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
