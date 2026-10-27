import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ connection: { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: vi.fn() } }));
vi.mock("../../db/pool.js", () => ({ getPool: () => ({ getConnection: async () => database.connection }) }));
import { completeFinalControl } from "./final-control-service.js";
import { startRepair } from "./parts-service.js";
import { transitionQuote } from "./quote-service.js";

describe("closed order state integrity", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it.each(["ENTREGADA", "CANCELADA"])("cannot complete final control for %s", async (internalStatus) => {
    database.connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM service_orders")) return [{ internalStatus }];
      if (sql.includes("FROM quote_versions")) return [{ id: 9 }];
      if (sql.includes("FROM quote_lines")) return [{ id: 21 }];
      if (sql.includes("FROM order_labor_verifications")) return [{ quoteLineId: 21 }];
      return [];
    });
    await expect(completeFinalControl(1, { actorUserId: 2, requestId: "audit-test" })).rejects.toMatchObject({ code: "ORDER_TERMINAL" });
    expect(database.connection.commit).not.toHaveBeenCalled();
    expect(database.connection.release).toHaveBeenCalledOnce();
  });
  it("cannot silently reset a completed final control", async () => {
    database.connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM service_orders")) return [{ internalStatus: "LISTA_PARA_ENTREGA" }];
      if (sql.includes("FROM quote_versions")) return [{ id: 9 }];
      if (sql.includes("FROM quote_lines")) return [{ id: 21 }];
      if (sql.includes("FROM order_labor_verifications")) return [{ quoteLineId: 21 }];
      return [];
    });
    await expect(completeFinalControl(1, { actorUserId: 2, requestId: "audit-test" })).rejects.toMatchObject({ code: "FINAL_CONTROL_REOPEN_REQUIRED" });
    expect(database.connection.commit).not.toHaveBeenCalled();
  });
  it.each(["ENTREGADA", "CANCELADA", "LISTA_PARA_ENTREGA"])("cannot restart repair for %s", async (internalStatus) => {
    database.connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM service_orders")) return [{ internalStatus }];
      if (sql.includes("FROM quote_versions")) return [{ id: 9 }];
      return [];
    });
    await expect(startRepair(1, 2, "audit-test")).rejects.toMatchObject({ code: "INVALID_REPAIR_TRANSITION" });
    expect(database.connection.commit).not.toHaveBeenCalled();
  });
  it("releases a connection even when rollback fails", async () => {
    database.connection.query.mockRejectedValue(new Error("database unavailable"));
    database.connection.rollback.mockRejectedValue(new Error("rollback unavailable"));
    await expect(startRepair(1, 2, "audit-test")).rejects.toThrow();
    expect(database.connection.release).toHaveBeenCalledOnce();
  });
  it.each(["ENTREGADA", "CANCELADA"])("cannot approve a quote on %s", async (internalStatus) => {
    database.connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM quote_versions")) return [{ id: 9, status: "ENVIADA", internalStatus, currency: "PEN", versionNumber: 1 }];
      if (sql.includes("FROM quote_lines")) return [{ id: 21, type: "MANO_OBRA", quantity: 1, unitPrice: 10 }];
      return [];
    });
    await expect(transitionQuote(1, 9, "APPROVE", 2, "audit-test")).rejects.toMatchObject({ code: "ORDER_TERMINAL" });
    expect(database.connection.commit).not.toHaveBeenCalled();
  });
});
