import mariadb, { type Pool } from "mariadb";
import { AsyncLocalStorage } from "node:async_hooks";
import { getEnvironment } from "../config/env.js";

let pool: Pool | undefined;
let demoPool: Pool | undefined;
const databaseScope = new AsyncLocalStorage<"production" | "demo">();

export function runWithDatabaseScope<T>(scope: "production" | "demo", callback: () => T): T {
  return databaseScope.run(scope, callback);
}

export function isDemoScope(): boolean { return databaseScope.getStore() === "demo"; }

export function getPool(): Pool {
  if (isDemoScope()) return getDemoPool();
  return getProductionPool();
}

export function getProductionPool(): Pool {
  if (pool) return pool;
  const env = getEnvironment();
  pool = mariadb.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    timezone: "Z",
    bigIntAsNumber: true
  });
  return pool;
}

export function getDemoPool(): Pool {
  if (demoPool) return demoPool;
  const env = getEnvironment();
  if (!env.DEMO_MODE_ENABLED) throw new Error("El modo demostración está desactivado.");
  demoPool = mariadb.createPool({ host: env.DEMO_DB_HOST!, port: env.DEMO_DB_PORT!, user: env.DEMO_DB_USER!, password: env.DEMO_DB_PASSWORD!, database: env.DEMO_DB_NAME!, connectionLimit: env.DB_CONNECTION_LIMIT, timezone: "Z", bigIntAsNumber: true });
  return demoPool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  await demoPool?.end();
  pool = undefined;
  demoPool = undefined;
}
