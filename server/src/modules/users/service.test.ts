import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ query: vi.fn(), connection: { query: vi.fn(), beginTransaction: vi.fn(), rollback: vi.fn(), commit: vi.fn(), release: vi.fn() } }));
vi.mock("../../db/pool.js", () => ({ getPool: () => ({ query: db.query, getConnection: async () => db.connection }) }));
vi.mock("argon2", () => ({ default: { hash: async () => "test-hash", argon2id: 2 } }));
import { createManagedUser, setManagedUserActive } from "./service.js";
beforeEach(() => {
  vi.resetAllMocks();
  const query = async (sql: string) => {
    if (sql.includes("INSERT INTO audit_events")) throw new Error("audit unavailable");
    if (sql.startsWith("SELECT id FROM roles")) return [{ id: 2 }];
    if (sql.startsWith("INSERT INTO users")) return { insertId: 3 };
    if (sql.startsWith("UPDATE users")) return { affectedRows: 1 };
    return [];
  };
  db.query.mockImplementation(query);
  db.connection.query.mockImplementation(query);
});
it("rolls user creation back when the audit write fails", async () => {
  await expect(createManagedUser({ names: "Usuario de prueba", username: "test.user", email: "test@invalid.local", password: "test-password", role: "ASESOR" }, 1, "test-request")).rejects.toThrow("audit unavailable");
  expect(db.connection.rollback).toHaveBeenCalledOnce();
  expect(db.connection.release).toHaveBeenCalledOnce();
  expect(db.connection.commit).not.toHaveBeenCalled();
});
it("rolls activation back when the audit write fails", async () => {
  await expect(setManagedUserActive(3, false, 1, "test-request")).rejects.toThrow("audit unavailable");
  expect(db.connection.rollback).toHaveBeenCalledOnce();
  expect(db.connection.release).toHaveBeenCalledOnce();
});
