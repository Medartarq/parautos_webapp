import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const connection = { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: vi.fn() };
  return { connection, pool: { getConnection: vi.fn(async () => connection), query: vi.fn() } };
});
vi.mock("../../db/pool.js", () => ({ getPool: () => database.pool }));

import { correctOperationalData } from "./service.js";

const context = [3, "request-1", "127.0.0.1", "vitest"] as const;
const input = { phoneOverride: "999888777", emailOverride: "operaciones@parautos.pe", claimNumber: "SIN-22", claimPendingReminder: false, reason: "Corrección reportada por el cliente" };

describe("operational data correction service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects terminal orders without writing operational or historical records", async () => {
    database.connection.query.mockResolvedValueOnce([{ modality: "MAPFRE", internalStatus: "ENTREGADA", claimNumber: "SIN-21", claimPending: 0 }]);
    await expect(correctOperationalData(5, input, ...context)).rejects.toMatchObject({ code: "ORDER_TERMINAL" });
    expect(database.connection.query).toHaveBeenCalledTimes(1);
    expect(database.connection.rollback).toHaveBeenCalledOnce();
  });

  it("enforces the insurer claim modality invariant", async () => {
    database.connection.query.mockResolvedValueOnce([{ modality: "MAPFRE", internalStatus: "EN_REPARACION", claimNumber: "SIN-21", claimPending: 0 }]);
    await expect(correctOperationalData(5, { ...input, claimNumber: undefined, claimPendingReminder: false }, ...context)).rejects.toMatchObject({ code: "CLAIM_INVARIANT" });
    expect(database.connection.query).toHaveBeenCalledTimes(1);
  });

  it("allows contact corrections for particular orders that retain an existing claim number", async () => {
    const particularInput = { ...input, claimNumber: "SIN-21" };
    database.connection.query
      .mockResolvedValueOnce([{ modality: "PARTICULAR", internalStatus: "COTIZACION_PENDIENTE", claimNumber: "SIN-21", claimPending: 0 }])
      .mockResolvedValue({});

    await expect(correctOperationalData(5, particularInput, ...context)).resolves.toBeUndefined();

    expect(database.connection.query.mock.calls).toContainEqual([expect.stringContaining("UPDATE service_orders SET claim_number"), ["SIN-21", 0, 5]]);
    expect(database.connection.commit).toHaveBeenCalledOnce();
  });

  it("rejects a correction that does not change operational data", async () => {
    database.connection.query.mockResolvedValueOnce([{ modality: "MAPFRE", internalStatus: "EN_REPARACION", claimNumber: "SIN-22", claimPending: 0, phoneOverride: "999888777", emailOverride: "operaciones@parautos.pe" }]);
    await expect(correctOperationalData(5, input, ...context)).rejects.toMatchObject({ code: "NO_MEANINGFUL_CHANGE" });
    expect(database.connection.query).toHaveBeenCalledTimes(1);
  });

  it("updates only order-local fields and audits complete old/new values with request metadata", async () => {
    database.connection.query
      .mockResolvedValueOnce([{ modality: "MAPFRE", internalStatus: "EN_REPARACION", claimNumber: "SIN-21", claimPending: 0, phoneOverride: "988777666", emailOverride: "old@parautos.pe" }])
      .mockResolvedValue({});
    await correctOperationalData(5, input, ...context);
    const calls = database.connection.query.mock.calls;
    expect(calls.map(([sql]) => String(sql)).join("\n")).not.toMatch(/\bclients\b|\bvehicles\b|\breceptions\b|checklist|damage_marks|attachments|quote/);
    expect(calls).toContainEqual([expect.stringContaining("INSERT INTO order_operational_data"), [5, "999888777", "operaciones@parautos.pe"]]);
    expect(calls).toContainEqual([expect.stringContaining("UPDATE service_orders SET claim_number"), ["SIN-22", 0, 5]]);
    const audit = calls.find(([sql]) => String(sql).includes("OPERATIONAL_DATA_CORRECTED"))!;
    expect(JSON.parse(audit[1][2])).toEqual({ phoneOverride: "988777666", emailOverride: "old@parautos.pe", claimNumber: "SIN-21", claimPendingReminder: false });
    expect(JSON.parse(audit[1][3])).toEqual({ ...input });
    expect(audit[1].slice(4)).toEqual(["request-1", "127.0.0.1", "vitest"]);
    expect(database.connection.commit).toHaveBeenCalledOnce();
  });
});
