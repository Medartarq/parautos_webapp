import { normalizePlate } from "@parautos/shared";
import { getEnvironment } from "../../config/env.js";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";

type FactilizaResponse<T> = { success?: boolean; message?: string; data?: T };
type FactilizaDni = { nombre_completo?: string };
type FactilizaRuc = { nombre_o_razon_social?: string };
type FactilizaVehicle = { placa?: string; marca?: string; modelo?: string; color?: string; vin?: string };

export type ClientLookup = { documentType: "DNI" | "RUC"; documentNumber: string; fullName: string; phone?: string; email?: string };
export type VehicleLookup = { plate: string; brand: string; model: string; color: string; colorType: "CATALOGO" | "PERSONALIZADO"; year?: number; vin?: string; bodyTypeId?: number };

export async function findLocalClient(documentNumber: string): Promise<ClientLookup | undefined> {
  const documentType = documentNumber.length === 8 ? "DNI" : "RUC";
  const rows = await getPool().query<Array<{ documentType: "DNI" | "RUC"; documentNumber: string; fullName: string; phone: string | null; email: string | null }>>(
    "SELECT document_type AS documentType, document_number AS documentNumber, full_name AS fullName, phone, email FROM clients WHERE document_type = ? AND document_number = ? LIMIT 1",
    [documentType, documentNumber],
  );
  const client = rows[0];
  return client ? { ...client, phone: client.phone || undefined, email: client.email || undefined } : undefined;
}

export async function findLocalVehicle(plateInput: string): Promise<VehicleLookup | undefined> {
  const normalizedPlate = normalizePlate(plateInput).replace(/[^A-Z0-9]/g, "");
  const rows = await getPool().query<Array<{ plate: string; brand: string; model: string; color: string; colorType: "CATALOGO" | "PERSONALIZADO"; year: number | null; vin: string | null; bodyTypeId: number }>>(
    "SELECT plate, brand, model, color, color_type AS colorType, manufacture_year AS year, vin, body_type_id AS bodyTypeId FROM vehicles WHERE plate = ? LIMIT 1",
    [normalizedPlate],
  );
  const vehicle = rows[0];
  return vehicle ? { ...vehicle, year: vehicle.year || undefined, vin: vehicle.vin || undefined } : undefined;
}

async function factiliza<T>(path: string): Promise<T> {
  const environment = getEnvironment();
  if (!environment.FACTILIZA_API_TOKEN)
    throw new AppError(503, "FACTILIZA_NOT_CONFIGURED", "La consulta externa no está configurada.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), environment.FACTILIZA_API_TIMEOUT_MS);
  try {
    const response = await fetch(`${environment.FACTILIZA_API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${environment.FACTILIZA_API_TOKEN}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok)
      throw new AppError(502, "FACTILIZA_UNAVAILABLE", "No fue posible consultar el servicio externo en este momento.");
    const body = await response.json() as FactilizaResponse<T>;
    // Factiliza omite `success` en algunas respuestas válidas, incluida la
    // consulta de placa. Solo un false explícito o la ausencia de datos es error.
    if (body.success === false || !body.data)
      throw new AppError(404, "FACTILIZA_NOT_FOUND", body.message || "No se encontraron datos para la consulta.");
    return body.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === "AbortError")
      throw new AppError(504, "FACTILIZA_TIMEOUT", "La consulta externa tardó demasiado. Inténtelo nuevamente.");
    throw new AppError(502, "FACTILIZA_UNAVAILABLE", "No fue posible consultar el servicio externo en este momento.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function findFactilizaClient(documentNumber: string): Promise<ClientLookup> {
  if (documentNumber.length === 8) {
    const data = await factiliza<FactilizaDni>(`/dni/info/${documentNumber}`);
    if (!data.nombre_completo) throw new AppError(404, "FACTILIZA_NOT_FOUND", "No se encontraron datos para el DNI consultado.");
    return { documentType: "DNI", documentNumber, fullName: data.nombre_completo };
  }
  const data = await factiliza<FactilizaRuc>(`/ruc/info/${documentNumber}`);
  if (!data.nombre_o_razon_social) throw new AppError(404, "FACTILIZA_NOT_FOUND", "No se encontraron datos para el RUC consultado.");
  return { documentType: "RUC", documentNumber, fullName: data.nombre_o_razon_social };
}

export async function findFactilizaVehicle(plateInput: string): Promise<VehicleLookup> {
  const plate = normalizePlate(plateInput).replace(/[^A-Z0-9]/g, "");
  const data = await factiliza<FactilizaVehicle>(`/placa/info/${encodeURIComponent(plate)}`);
  if (!data.marca || !data.modelo || !data.color)
    throw new AppError(404, "FACTILIZA_NOT_FOUND", "No se encontraron datos completos para la placa consultada.");
  return { plate: normalizePlate(data.placa || plate), brand: data.marca, model: data.modelo, color: data.color, colorType: "PERSONALIZADO", vin: data.vin || undefined };
}
