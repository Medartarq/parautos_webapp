import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "mariadb";
import { getPool, closePool } from "./pool.js";

const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), "../../../database/migrations");

export async function applyMigrations(pool: Pool, directory = migrationDirectory): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
  ) ENGINE=InnoDB`);

  const appliedRows = await pool.query<{ version: string }[]>("SELECT version FROM schema_migrations");
  const applied = new Set(appliedRows.map((row) => row.version));
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(directory, file), "utf8");
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
      for (const statement of statements) {
        await connection.query(statement);
      }
      await connection.query("INSERT INTO schema_migrations (version) VALUES (?)", [file]);
      await connection.commit();
      console.info(`Applied migration ${file}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

async function migrate(): Promise<void> {
  await applyMigrations(getPool());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate().then(() => closePool()).catch(async (error: unknown) => {
    console.error(error);
    await closePool();
    process.exitCode = 1;
  });
}
