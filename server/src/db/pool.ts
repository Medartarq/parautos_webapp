import mariadb, { type Pool } from "mariadb";
import { getEnvironment } from "../config/env.js";

let pool: Pool | undefined;

export function getPool(): Pool {
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

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
