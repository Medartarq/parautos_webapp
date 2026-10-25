import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { splitMigrationStatements } from "./migrate.js";

describe("splitMigrationStatements", () => {
  it("keeps a trigger body with nested IF blocks as one statement", () => {
    const statements = splitMigrationStatements(`
      CREATE TABLE transitions (from_status VARCHAR(50));
      CREATE TRIGGER validate_status BEFORE UPDATE ON service_orders FOR EACH ROW
      BEGIN
        IF NEW.internal_status <> OLD.internal_status THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid transition';
        END IF;
      END;
      INSERT INTO transitions (from_status) VALUES ('EN_REPARACION');
    `);

    expect(statements).toHaveLength(3);
    expect(statements[1]).toContain("SIGNAL SQLSTATE '45000'");
    expect(statements[1]).toContain("END IF;");
    expect(statements[1]).toMatch(/END$/);
  });

  it("keeps each status trigger in migration 023 intact", async () => {
    const migration = await readFile(new URL("../../../database/migrations/023_add_order_status_triggers.sql", import.meta.url), "utf8");
    const statements = splitMigrationStatements(migration);

    expect(statements).toHaveLength(6);
    expect(statements.filter((statement) => statement.startsWith("CREATE TRIGGER"))).toHaveLength(2);
    expect(statements.filter((statement) => statement.includes("MYSQL_ERRNO = 30001"))).toHaveLength(2);
  });
});
