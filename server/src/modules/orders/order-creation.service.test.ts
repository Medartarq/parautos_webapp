import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const connection = { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), destroy: vi.fn(), query: vi.fn() };
  return { connection, pool: { query: vi.fn(), getConnection: vi.fn(async () => connection) } };
});
const storage = vi.hoisted(() => ({
  storeSignature: vi.fn(),
  deleteStoredFile: vi.fn(),
}));

vi.mock("../../db/pool.js", () => ({ getPool: () => database.pool }));
vi.mock("../attachments/storage.js", () => storage);

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
    if (sql.startsWith("SELECT id, plate, vin FROM vehicles")) return [];
    if (sql.startsWith("INSERT INTO clients")) return { insertId: 11 };
    if (sql.startsWith("INSERT INTO vehicles")) return { insertId: 12 };
    if (sql.startsWith("INSERT INTO client_vehicles")) return { insertId: 13 };
    if (sql.includes("SELECT o.id FROM service_orders")) return [];
    if (sql.startsWith("INSERT INTO service_orders")) return { insertId: 14 };
    if (sql.startsWith("INSERT INTO receptions")) return { insertId: 15 };
    return {};
  });
  storage.storeSignature.mockResolvedValue({ provider: "local", objectKey: "2026-10-17/signature.png", byteSize: 67, sha256: "a".repeat(64) });
}

describe("order creation signature persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not complete a committed reception before its connection is released", async () => {
    configureSuccessfulCreation();
    let finish!: () => void;
    const releasing = new Promise<void>((resolve) => { finish = resolve; });
    database.connection.release.mockImplementationOnce(() => releasing);
    let completed = false;
    const pending = createOrder(structuredClone(input), 3, "release-wait").then(() => { completed = true; });
    await vi.waitFor(() => expect(database.connection.release).toHaveBeenCalledOnce());
    expect(completed).toBe(false);
    finish();
    await pending;
    expect(completed).toBe(true);
    expect(storage.deleteStoredFile).not.toHaveBeenCalled();
  });

  it("preserves persistence errors and removes stored signatures even if release fails", async () => {
    configureSuccessfulCreation();
    const original = new Error("attachment persistence failure");
    const successfulQuery = database.connection.query.getMockImplementation()!;
    database.connection.query.mockImplementation(async (...args) => {
      if (String(args[0]).includes("INSERT INTO attachments")) throw original;
      return successfulQuery(...args);
    });
    database.connection.release.mockRejectedValueOnce(new Error("release failure"));
    await expect(createOrder(structuredClone(input), 3, "release-failure")).rejects.toBe(original);
    expect(database.connection.rollback).toHaveBeenCalledOnce();
    expect(database.connection.destroy).toHaveBeenCalledOnce();
    expect(storage.deleteStoredFile).toHaveBeenCalledWith("local", "2026-10-17/signature.png");
  });

  it("rejects duplicate checklist answers before opening a transaction", async () => {
    configureSuccessfulCreation();
    await expect(createOrder({ ...structuredClone(input), checklist: [input.checklist[0], input.checklist[0]] }, 3, "duplicate-test")).rejects.toMatchObject({ code: "CHECKLIST_INCOMPLETE" });
    expect(database.pool.getConnection).not.toHaveBeenCalled();
  });

  it("persists the required signature attachment inside the order transaction", async () => {
    configureSuccessfulCreation();

    await expect(createOrder(structuredClone(input), 3, "request-1")).resolves.toMatchObject({ id: 14 });

    expect(storage.storeSignature).toHaveBeenCalledWith(expect.any(Buffer));
    expect(database.connection.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO attachments"),
      [14, 15, 3, "local", "2026-10-17/signature.png", 67, "a".repeat(64)],
    );
    expect(database.connection.commit).toHaveBeenCalledOnce();
    expect(database.connection.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO reception_snapshots"), [15, 14]);
    expect(storage.deleteStoredFile).not.toHaveBeenCalled();
  });

  it("updates a vehicle only when plate and VIN identify the same record", async () => {
    configureSuccessfulCreation();
    const query = database.connection.query.getMockImplementation()!;
    database.connection.query.mockImplementation(async (sql, ...args) => sql.startsWith("SELECT id, plate, vin FROM vehicles")
      ? [{ id: 12, plate: "ABC123", vin: input.vehicle.vin }] : query(sql, ...args));
    await createOrder(structuredClone(input), 3, "same-identity");
    expect(database.connection.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE vehicles SET"),
      ["TOYOTA", "COROLLA", 2024, input.vehicle.vin, "Blanco", "CATALOGO", 1, 12]);
  });

  it.each([
    [{ id: 12, plate: "XYZ789", vin: input.vehicle.vin }],
    [{ id: 12, plate: "ABC123", vin: "8AJHA8CD0R1234567" }],
    [{ id: 12, plate: "ABC123", vin: null }, { id: 13, plate: "XYZ789", vin: input.vehicle.vin }],
  ])("rejects conflicting vehicle identities and rolls back", async (...identities) => {
    configureSuccessfulCreation();
    const query = database.connection.query.getMockImplementation()!;
    database.connection.query.mockImplementation(async (sql, ...args) => sql.startsWith("SELECT id, plate, vin FROM vehicles") ? identities : query(sql, ...args));
    await expect(createOrder(structuredClone(input), 3, "conflict")).rejects.toMatchObject({ code: "VEHICLE_IDENTITY_CONFLICT" });
    expect(database.connection.rollback).toHaveBeenCalledOnce();
    expect(database.connection.commit).not.toHaveBeenCalled();
    expect(storage.storeSignature).not.toHaveBeenCalled();
  });

  it("reports a concurrent unique-key conflict without completing a reception", async () => {
    configureSuccessfulCreation();
    const query = database.connection.query.getMockImplementation()!;
    database.connection.query.mockImplementation(async (sql, ...args) => {
      if (sql.startsWith("INSERT INTO vehicles")) throw Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
      return query(sql, ...args);
    });
    await expect(createOrder(structuredClone(input), 3, "race")).rejects.toMatchObject({ code: "VEHICLE_IDENTITY_CONFLICT" });
    expect(database.connection.rollback).toHaveBeenCalledOnce();
  });

  it("rolls back and removes the signature file when attachment persistence fails", async () => {
    configureSuccessfulCreation();
    database.connection.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT id, plate, vin FROM vehicles")) return [];
      if (sql.startsWith("INSERT INTO clients")) return { insertId: 11 };
      if (sql.startsWith("INSERT INTO vehicles")) return { insertId: 12 };
      if (sql.startsWith("INSERT INTO client_vehicles")) return { insertId: 13 };
      if (sql.includes("SELECT o.id FROM service_orders")) return [];
      if (sql.startsWith("INSERT INTO service_orders")) return { insertId: 14 };
      if (sql.startsWith("INSERT INTO receptions")) return { insertId: 15 };
      if (sql.includes("INSERT INTO attachments")) throw new Error("attachment failure");
      return {};
    });

    await expect(createOrder(structuredClone(input), 3, "request-2")).rejects.toThrow("attachment failure");

    expect(database.connection.rollback).toHaveBeenCalledOnce();
    expect(storage.deleteStoredFile).toHaveBeenCalledWith("local", "2026-10-17/signature.png");
  });
});
