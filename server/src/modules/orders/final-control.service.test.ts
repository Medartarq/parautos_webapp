import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const connection = { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: vi.fn() };
  return { connection, pool: { getConnection: vi.fn(async () => connection), query: vi.fn() } };
});
vi.mock("../../db/pool.js", () => ({ getPool: () => database.pool }));

import { completeFinalControl, deliverOrder, publishReadyForPickup, reopenFinalControl, setAllLaborVerifications, setLaborVerification } from "./service.js";

const context = { actorUserId: 3, requestId: "request-1" };

describe("final control workflow service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects control completion without an approved quote", async () => {
    database.connection.query.mockResolvedValueOnce([{ internalStatus: "EN_REPARACION", publicStatus: "EN_REPARACION" }]).mockResolvedValueOnce([]);
    await expect(completeFinalControl(5, context)).rejects.toMatchObject({ code: "QUOTE_NOT_APPROVED" });
    expect(database.connection.rollback).toHaveBeenCalledOnce();
  });

  it("requires every approved labor line to be verified before completing control", async () => {
    database.connection.query
      .mockResolvedValueOnce([{ internalStatus: "EN_REPARACION", publicStatus: "EN_REPARACION" }])
      .mockResolvedValueOnce([{ id: 9 }]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 21 }, { id: 22 }]).mockResolvedValueOnce([{ quoteLineId: 21 }]);
    await expect(completeFinalControl(5, context)).rejects.toMatchObject({ code: "LABOR_NOT_VERIFIED" });
  });

  it("completes control with distinct internal and public states", async () => {
    database.connection.query
      .mockResolvedValueOnce([{ internalStatus: "EN_REPARACION", publicStatus: "EN_REPARACION" }])
      .mockResolvedValueOnce([{ id: 9 }]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 21 }]).mockResolvedValueOnce([{ quoteLineId: 21 }])
      .mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce({});
    await completeFinalControl(5, context);
    expect(database.connection.query).toHaveBeenCalledWith(expect.stringContaining("internal_status = 'LISTA_PARA_ENTREGA', public_status = 'EN_REPARACION'"), [5]);
    expect(database.connection.commit).toHaveBeenCalledOnce();
  });

  it("requires a recorded control and blocks reopening after delivery", async () => {
    database.connection.query.mockResolvedValueOnce([{ deliveredAt: new Date() }]);
    await expect(reopenFinalControl(5, "Corrección", context)).rejects.toMatchObject({ code: "ORDER_ALREADY_DELIVERED" });
  });

  it("requires the audited reopen action before changing a completed control", async () => {
    database.connection.query.mockResolvedValueOnce([{ id: 21 }]).mockResolvedValueOnce([{ completedAt: new Date(), deliveredAt: null }]);
    await expect(setLaborVerification(5, 21, false, context)).rejects.toMatchObject({ code: "FINAL_CONTROL_REOPEN_REQUIRED" });
  });

  it("verifies all approved labor lines in one transaction", async () => {
    database.connection.query
      .mockResolvedValueOnce([{ id: 21 }, { id: 22 }]).mockResolvedValueOnce([])
      .mockResolvedValueOnce({}).mockResolvedValueOnce({});
    await setAllLaborVerifications(5, true, context);
    expect(database.connection.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO order_labor_verifications"), [5, 3, [21, 22]]);
    expect(database.connection.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO audit_events"), expect.arrayContaining(["ALL_LABOR_VERIFIED"]));
    expect(database.connection.commit).toHaveBeenCalledOnce();
  });

  it("does not bulk change a completed control", async () => {
    database.connection.query.mockResolvedValueOnce([{ id: 21 }]).mockResolvedValueOnce([{ completedAt: new Date(), deliveredAt: null }]);
    await expect(setAllLaborVerifications(5, false, context)).rejects.toMatchObject({ code: "FINAL_CONTROL_REOPEN_REQUIRED" });
  });

  it("delivers only an internally and publicly ready order", async () => {
    database.connection.query.mockResolvedValueOnce([{ internalStatus: "LISTA_PARA_ENTREGA", publicStatus: "EN_REPARACION" }]).mockResolvedValueOnce({});
    await expect(deliverOrder(5, context)).rejects.toMatchObject({ code: "ORDER_NOT_PUBLISHED" });
  });

  it("publishes ready pickup separately from internal readiness", async () => {
    database.connection.query
      .mockResolvedValueOnce([{ internalStatus: "LISTA_PARA_ENTREGA", publicStatus: "EN_REPARACION" }])
      .mockResolvedValueOnce([{ completedAt: new Date(), deliveredAt: null }])
      .mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce({});
    await publishReadyForPickup(5, { channel: "WhatsApp", note: "Cliente avisado" }, context);
    expect(database.connection.query).toHaveBeenCalledWith(expect.stringContaining("SET public_status = 'LISTA_PARA_ENTREGA'"), [5]);
  });

  it("records conformity and moves both states to delivered", async () => {
    database.connection.query
      .mockResolvedValueOnce([{ internalStatus: "LISTA_PARA_ENTREGA", publicStatus: "LISTA_PARA_ENTREGA" }])
      .mockResolvedValueOnce([{ deliveredAt: null }]).mockResolvedValueOnce({})
      .mockResolvedValueOnce({}).mockResolvedValueOnce({});
    await deliverOrder(5, context);
    expect(database.connection.query).toHaveBeenCalledWith(expect.stringContaining("internal_status = 'ENTREGADA', public_status = 'ENTREGADA'"), [5]);
    expect(database.connection.commit).toHaveBeenCalledOnce();
  });
});
