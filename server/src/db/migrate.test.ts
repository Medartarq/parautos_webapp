import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { compareMigrationNames, splitMigrationStatements } from "./migrate.js";

it("keeps the numbered migration order independent from locale", async () => {
  const files = ["025_reception_snapshots.sql", "010_orders.sql", "002_cases.sql", "001_identity.sql"];
  expect(files.sort(compareMigrationNames)).toEqual(["001_identity.sql", "002_cases.sql", "010_orders.sql", "025_reception_snapshots.sql"]);
  expect(compareMigrationNames("001.sql", "001.sql")).toBe(0);
  const actual = (await import("node:fs/promises")).readdir;
  const names = await actual(new URL("../../../database/migrations/", import.meta.url));
  const ordered = names.filter((name) => name.endsWith(".sql")).sort(compareMigrationNames);
  expect(ordered.map((name) => Number(name.slice(0, 3)))).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
});

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
