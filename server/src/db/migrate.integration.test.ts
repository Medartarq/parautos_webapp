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

    const triggers = await pool!.query<{ total: number }[]>(
      `SELECT COUNT(*) AS total FROM information_schema.triggers
       WHERE trigger_schema = DATABASE()
         AND trigger_name IN ('trg_service_orders_internal_status_before_update', 'trg_service_orders_public_status_before_update')`,
    );
    const directDeliveries = await pool!.query<{ total: number }[]>(
      "SELECT COUNT(*) AS total FROM order_status_transitions WHERE from_status = 'COTIZACION_PENDIENTE' AND to_status = 'ENTREGADA'",
    );

    expect(Number(migrations[0]?.total)).toBe(23);
    expect(Number(columns[0]?.total)).toBe(2);
    expect(Number(triggers[0]?.total)).toBe(2);
    expect(Number(directDeliveries[0]?.total)).toBe(0);
  });

  it("reapplies migration 020 by promoting administrators and recording its audit event once", async () => {
    const administratorRole = await pool!.query<{ id: number }[]>("SELECT id FROM roles WHERE code = 'ADMINISTRADOR'");
    const created = await pool!.query<{ insertId: number }>("INSERT INTO users (role_id, names, username, email, password_hash) VALUES (?, 'Administrador histórico', 'admin.hist', 'admin.hist@parautos.pe', 'not-used-in-test')", [administratorRole[0]!.id]);
    const userId = Number(created.insertId);
    await pool!.query("DELETE FROM schema_migrations WHERE version = '020_superadministrator_role.sql'");

    await applyMigrations(pool!);

    const users = await pool!.query<{ role: string }[]>("SELECT r.code AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?", [userId]);
    const events = await pool!.query<{ total: number }[]>("SELECT COUNT(*) AS total FROM audit_events WHERE entity = 'user' AND record_id = ? AND action = 'ROLE_MIGRATED_TO_SUPERADMINISTRADOR'", [String(userId)]);
    expect(users[0]?.role).toBe("SUPERADMINISTRADOR");
    expect(Number(events[0]?.total)).toBe(1);

    await applyMigrations(pool!);
    const eventsAfterRerun = await pool!.query<{ total: number }[]>("SELECT COUNT(*) AS total FROM audit_events WHERE entity = 'user' AND record_id = ? AND action = 'ROLE_MIGRATED_TO_SUPERADMINISTRADOR'", [String(userId)]);
    expect(Number(eventsAfterRerun[0]?.total)).toBe(1);
  });
});
