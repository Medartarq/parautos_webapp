import { releaseConnection } from "./release-connection.js";
import { technicalLogger } from "../logging/technical-logger.js";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "mariadb";
import { getPool, closePool } from "./pool.js";

const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), "../../../database/migrations");

export function splitMigrationStatements(sql: string): string[] {
  const statements: string[] = [];
  let statementStart = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;
  let createSeen = false;
  let triggerStatement = false;
  let triggerBlockDepth = 0;

  const resetStatementState = () => {
    createSeen = false;
    triggerStatement = false;
    triggerBlockDepth = 0;
  };

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]!;
    const next = sql[index + 1];

    if (inLineComment) {
      if (character === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (character === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }
    if (!inSingleQuote && !inDoubleQuote && !inBacktick && character === "-" && next === "-") {
      inLineComment = true;
      index += 1;
      continue;
    }
    if (!inSingleQuote && !inDoubleQuote && !inBacktick && character === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }
    if (!inDoubleQuote && !inBacktick && character === "'" && sql[index - 1] !== "\\") {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (!inSingleQuote && !inBacktick && character === '"' && sql[index - 1] !== "\\") {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (!inSingleQuote && !inDoubleQuote && character === "`") {
      inBacktick = !inBacktick;
      continue;
    }
    if (inSingleQuote || inDoubleQuote || inBacktick) continue;

    if (/[A-Za-z_]/.test(character)) {
      const wordStart = index;
      while (/[A-Za-z_]/.test(sql[index + 1] ?? "")) index += 1;
      const word = sql.slice(wordStart, index + 1).toUpperCase();
      if (word === "CREATE") createSeen = true;
      else if (createSeen && word === "TRIGGER") triggerStatement = true;
      else if (triggerStatement && word === "BEGIN") triggerBlockDepth += 1;
      else if (triggerStatement && word === "END") {
        const followingWord = sql.slice(index + 1).match(/^\s*([A-Za-z_]+)/)?.[1]?.toUpperCase();
        if (!["IF", "LOOP", "WHILE", "CASE"].includes(followingWord ?? "") && triggerBlockDepth > 0)
          triggerBlockDepth -= 1;
      }
      continue;
    }

    if (character === ";" && (!triggerStatement || triggerBlockDepth === 0)) {
      const statement = sql.slice(statementStart, index).trim();
      if (statement) statements.push(statement);
      statementStart = index + 1;
      resetStatementState();
    }
  }

  const statement = sql.slice(statementStart).trim();
  if (statement) statements.push(statement);
  return statements;
}

// Migration prefixes use an ordinal order independent of the host locale.
export function compareMigrationNames(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export async function applyMigrations(pool: Pool, directory = migrationDirectory): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
  ) ENGINE=InnoDB`);

  const appliedRows = await pool.query<{ version: string }[]>("SELECT version FROM schema_migrations");
  const applied = new Set(appliedRows.map((row) => row.version));
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort(compareMigrationNames);

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(directory, file), "utf8");
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const statements = splitMigrationStatements(sql);
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
      await releaseConnection(connection);
    }
  }
}

async function migrate(): Promise<void> {
  await applyMigrations(getPool());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate().then(() => closePool()).catch(async (error: unknown) => {
    technicalLogger.failure("database_task_failed", error);
    await closePool();
    process.exitCode = 1;
  });
}
