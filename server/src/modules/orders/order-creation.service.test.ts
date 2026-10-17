import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const connection = { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: vi.fn() };
  return { connection, pool: { query: vi.fn(), getConnection: vi.fn(async () => connection) } };
});
const storage = vi.hoisted(() => ({
  storeLocalSignature: vi.fn(),
  deleteLocalFile: vi.fn(),
}));

vi.mock("../../db/pool.js", () => ({ getPool: () => database.pool }));
vi.mock("../attachments/local-storage.js", () => storage);

import { createOrder } from "./service.js";

const signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5wQAAAABJRU5ErkJggg==";
const input = {
  client: { documentType: "DNI" as const, documentNumber: "12345678", fullName: "María Salazar", phone: "999888777", email: "maria@parautos.pe" },
  vehicle: { plate: "ABC-123", brand: "TOYOTA", model: "COROLLA", year: 2024, vin: "1HGCM82633A004352", color: "Blanco", colorType: "CATALOGO" as const, bodyTypeId: 1 },
  modality: "PARTICULAR" as const,
  claimPendingReminder: false,
  diagnosisPendingReminder: false,
  checklistReviewed: true as const,
  acceptedTerms: true as const,
  signature,
  checklist: [{ itemId: 1, answer: "SI" as const }],
  considerations: [],
  damages: [],
};

function configureSuccessfulCreation() {
  database.pool.query.mockResolvedValue([{ id: 1 }]);
  database.connection.query.mockImplementation(async (sql: string) => {
    if (sql.includes("SELECT id FROM clients")) return [{ id: 11 }];
    if (sql.includes("SELECT id FROM vehicles")) return [{ id: 12 }];
    if (sql.includes("SELECT id FROM client_vehicles")) return [{ id: 13 }];
    if (sql.includes("SELECT o.id FROM service_orders")) return [];
    if (sql.startsWith("INSERT INTO service_orders")) return { insertId: 14 };
    if (sql.startsWith("INSERT INTO receptions")) return { insertId: 15 };
    return {};
  });
  storage.storeLocalSignature.mockResolvedValue({ provider: "local", objectKey: "2026-10-17/signature.png", byteSize: 67, sha256: "a".repeat(64) });
}

describe("order creation signature persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists the required signature attachment inside the order transaction", async () => {
    configureSuccessfulCreation();

    await expect(createOrder(structuredClone(input), 3, "request-1")).resolves.toMatchObject({ id: 14 });

    expect(storage.storeLocalSignature).toHaveBeenCalledWith(expect.any(Buffer));
    expect(database.connection.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO attachments"),
      [14, 15, 3, "local", "2026-10-17/signature.png", 67, "a".repeat(64)],
    );
    expect(database.connection.commit).toHaveBeenCalledOnce();
    expect(storage.deleteLocalFile).not.toHaveBeenCalled();
  });

  it("rolls back and removes the signature file when attachment persistence fails", async () => {
    configureSuccessfulCreation();
    database.connection.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id FROM clients")) return [{ id: 11 }];
      if (sql.includes("SELECT id FROM vehicles")) return [{ id: 12 }];
      if (sql.includes("SELECT id FROM client_vehicles")) return [{ id: 13 }];
      if (sql.includes("SELECT o.id FROM service_orders")) return [];
      if (sql.startsWith("INSERT INTO service_orders")) return { insertId: 14 };
      if (sql.startsWith("INSERT INTO receptions")) return { insertId: 15 };
      if (sql.includes("INSERT INTO attachments")) throw new Error("attachment failure");
      return {};
    });

    await expect(createOrder(structuredClone(input), 3, "request-2")).rejects.toThrow("attachment failure");

    expect(database.connection.rollback).toHaveBeenCalledOnce();
    expect(storage.deleteLocalFile).toHaveBeenCalledWith("2026-10-17/signature.png");
  });
});
