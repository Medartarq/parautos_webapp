import { afterEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ query: vi.fn() }));
const environment = vi.hoisted(() => ({ getEnvironment: vi.fn() }));
vi.mock("../../db/pool.js", () => ({ getPool: () => database }));
vi.mock("../../config/env.js", () => environment);

import { findFactilizaClient, findFactilizaVehicle, findLocalClient, findLocalVehicle } from "./service.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("local reception lookups", () => {
  it("returns a local client by document", async () => {
    database.query.mockResolvedValueOnce([{ documentType: "DNI", documentNumber: "12345678", fullName: "Ana Pérez", phone: "999888777", email: "ana@example.pe" }]);

    await expect(findLocalClient("12345678")).resolves.toEqual({ documentType: "DNI", documentNumber: "12345678", fullName: "Ana Pérez", phone: "999888777", email: "ana@example.pe" });
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("FROM clients"), ["DNI", "12345678"]);
  });

  it("normalizes a plate before looking up a local vehicle", async () => {
    database.query.mockResolvedValueOnce([{ plate: "ABC123", brand: "TOYOTA", model: "COROLLA", color: "Plata", colorType: "CATALOGO", year: 2024, vin: "1HGCM82633A004352", bodyTypeId: 3 }]);

    await expect(findLocalVehicle("abc-123")).resolves.toMatchObject({ plate: "ABC123", brand: "TOYOTA", model: "COROLLA", bodyTypeId: 3 });
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("FROM vehicles"), ["ABC123"]);
  });
});

describe("Factiliza reception lookups", () => {
  it("uses the bearer token and maps a DNI response", async () => {
    environment.getEnvironment.mockReturnValue({ FACTILIZA_API_BASE_URL: "https://api.factiliza.com/v1", FACTILIZA_API_TOKEN: "secret-token" });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { nombre_completo: "CASTILLO TERRONES, JOSE PEDRO" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(findFactilizaClient("27427864")).resolves.toMatchObject({ documentType: "DNI", fullName: "CASTILLO TERRONES, JOSE PEDRO" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.factiliza.com/v1/dni/info/27427864", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer secret-token" }) }));
  });

  it("maps vehicle data as editable custom-color data", async () => {
    environment.getEnvironment.mockReturnValue({ FACTILIZA_API_BASE_URL: "https://api.factiliza.com/v1", FACTILIZA_API_TOKEN: "secret-token" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 200, data: { placa: "F3H792", marca: "FIAT", modelo: "FIORINO", color: "BLANCO BANCHISA", vin: "9BD25521A98854312" } }), { status: 200 })));

    await expect(findFactilizaVehicle("f3h-792")).resolves.toEqual({ plate: "F3H-792", brand: "FIAT", model: "FIORINO", color: "BLANCO BANCHISA", colorType: "PERSONALIZADO", vin: "9BD25521A98854312" });
  });
});
