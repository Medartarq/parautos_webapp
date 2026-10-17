import { randomUUID } from "node:crypto";
import mariadb, { type Connection, type Pool } from "mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./migrate.js";

const configuration = {
  host: process.env.MIGRATION_TEST_DB_HOST,
  port: process.env.MIGRATION_TEST_DB_PORT ? Number(process.env.MIGRATION_TEST_DB_PORT) : undefined,
  user: process.env.MIGRATION_TEST_DB_USER,
  password: process.env.MIGRATION_TEST_DB_PASSWORD,
};

const enabled = Boolean(configuration.host && configuration.port && configuration.user && configuration.password);
const temporaryDatabase = `parautos_migration_test_${randomUUID().replaceAll("-", "")}`;
let administrator: Connection | undefined;
let pool: Pool | undefined;

(enabled ? describe : describe.skip)("database migrations", () => {
  beforeAll(async () => {
    administrator = await mariadb.createConnection(configuration);
    await administrator.query(`CREATE DATABASE \`${temporaryDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    pool = mariadb.createPool({ ...configuration, database: temporaryDatabase, connectionLimit: 1 });
    await applyMigrations(pool);
  });

  afterAll(async () => {
    await pool?.end();
    if (administrator) {
      await administrator.query(`DROP DATABASE IF EXISTS \`${temporaryDatabase}\``);
      await administrator.end();
    }
  });

  it("installs every migration once from an empty MariaDB database", async () => {
    const migrations = await pool!.query<{ total: number }[]>("SELECT COUNT(*) AS total FROM schema_migrations");
    const columns = await pool!.query<{ total: number }[]>(
      `SELECT COUNT(*) AS total FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND ((table_name = 'damage_marks' AND column_name = 'body_code')
           OR (table_name = 'receptions' AND column_name = 'diagnosis_review_state'))`,
    );

    expect(Number(migrations[0]?.total)).toBe(16);
    expect(Number(columns[0]?.total)).toBe(2);
  });
});
