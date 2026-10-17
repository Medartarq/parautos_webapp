import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const connection = {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
    query: vi.fn(),
  };
  return { connection, pool: { getConnection: vi.fn(async () => connection), query: vi.fn() } };
});

vi.mock("../../db/pool.js", () => ({ getPool: () => database.pool }));

import { deleteQuote, listQuotes, transitionQuote, updateQuote } from "./service.js";

const input = {
  currency: "PEN" as const,
  noParts: false,
  lines: [
    { type: "MANO_OBRA" as const, category: "PLANCHADO" as const, description: "Reparar guardafango", quantity: 1, unitPrice: 180 },
    { type: "REPUESTO" as const, description: "Guardafango", quantity: 1, unitPrice: 240 },
  ],
};

describe("quote workflow service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates only a pending draft and replaces its lines atomically", async () => {
    database.connection.query
      .mockResolvedValueOnce([{ id: 9, versionNumber: 2, status: "PENDIENTE" }])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await expect(updateQuote(5, 9, input, 3, "request-1")).resolves.toMatchObject({ id: 9, versionNumber: 2, totalWithoutIgv: 420 });
    expect(database.connection.beginTransaction).toHaveBeenCalledOnce();
    expect(database.connection.commit).toHaveBeenCalledOnce();
    expect(database.connection.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM quote_lines"), [9]);
    expect(database.connection.query).toHaveBeenCalledWith(expect.stringContaining("QUOTE_UPDATED"), expect.any(Array));
  });

  it("normalizes MariaDB decimal quote lines before returning a draft", async () => {
    database.pool.query
      .mockResolvedValueOnce([{ id: 9, versionNumber: 1, status: "PENDIENTE", currency: "PEN", noParts: 1 }])
      .mockResolvedValueOnce([{ type: "MANO_OBRA", category: "PLANCHADO", description: "Reparar guardafango", quantity: "1.000", unitPrice: "220.00" }]);

    await expect(listQuotes(5)).resolves.toMatchObject([{ id: 9, noParts: true, lines: [{ quantity: 1, unitPrice: 220 }], totalWithoutIgv: 220 }]);
  });

  it("rejects editing a quote already sent", async () => {
    database.connection.query.mockResolvedValueOnce([{ id: 9, versionNumber: 2, status: "ENVIADA" }]);

    await expect(updateQuote(5, 9, input, 3, "request-2")).rejects.toMatchObject({ code: "QUOTE_NOT_EDITABLE" });
    expect(database.connection.rollback).toHaveBeenCalledOnce();
    expect(database.connection.commit).not.toHaveBeenCalled();
  });

  it("restores the prior sent version and order state when an adjustment is deleted", async () => {
    database.connection.query
      .mockResolvedValueOnce([{ id: 12, versionNumber: 3, status: "PENDIENTE", currency: "PEN" }])
      .mockResolvedValueOnce([{ type: "MANO_OBRA", description: "Ajuste", quantity: 1, unitPrice: 20 }])
      .mockResolvedValueOnce([{ id: 11, sentAt: new Date("2026-01-01") }])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await deleteQuote(5, 12, 3, "request-3");
    expect(database.connection.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE quote_versions SET status"), ["ENVIADA", 11]);
    expect(database.connection.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE service_orders SET internal_status"), ["ESPERA_APROBACION", "ESPERA_APROBACION", 5]);
    expect(database.connection.commit).toHaveBeenCalledOnce();
  });

  it("rejects approving a quote that has not been sent", async () => {
    database.connection.query.mockResolvedValueOnce([{ id: 9, status: "PENDIENTE", currency: "PEN", noParts: 0, versionNumber: 2 }]);

    await expect(transitionQuote(5, 9, "APPROVE", 3, "request-4")).rejects.toMatchObject({ code: "INVALID_QUOTE_TRANSITION" });
    expect(database.connection.rollback).toHaveBeenCalledOnce();
  });

  it("derives approved parts using their quote-line identifiers", async () => {
    database.connection.query
      .mockResolvedValueOnce([{ id: 9, status: "ENVIADA", currency: "PEN", noParts: 0, versionNumber: 2 }])
      .mockResolvedValueOnce([{ id: 21, type: "MANO_OBRA", description: "Reparar guardafango", quantity: 1, unitPrice: 180 }, { id: 22, type: "REPUESTO", description: "Guardafango", quantity: 1, unitPrice: 240 }])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await expect(transitionQuote(5, 9, "APPROVE", 3, "request-5")).resolves.toMatchObject({ status: "ESPERA_REPUESTOS" });
    expect(database.connection.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO order_parts"), [5, 22, "Guardafango", 1]);
    expect(database.connection.commit).toHaveBeenCalledOnce();
  });
});
