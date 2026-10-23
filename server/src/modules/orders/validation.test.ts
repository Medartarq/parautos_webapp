import { describe, expect, it } from "vitest";
import { normalizePlate, operationalDataSchema, receptionStepOneSchema } from "@parautos/shared";

const valid = {
  documentType: "DNI" as const, documentNumber: "12345678", fullName: "  Maria   Salazar  ", phone: "999 888 777",
  email: "maria@parautos.pe", plate: "abc123", modality: "PARTICULAR" as const, claimPendingReminder: false,
  brand: "toyota", model: "corolla", color: "Blanco", colorType: "CATALOGO" as const, year: "2024", vin: "1HGCM82633A004352", mileage: "12500", bodyTypeId: 1
};

describe("reception step-one validation", () => {
  it("normalizes whitespace, numeric fields, plate, VIN, brand, and model", () => {
    const result = receptionStepOneSchema.parse(valid);
    expect(result.fullName).toBe("Maria Salazar");
    expect(result.phone).toBe("999888777");
    expect(result.plate).toBe("ABC-123");
    expect(result.brand).toBe("TOYOTA");
    expect(result.model).toBe("COROLLA");
    expect(result.vin).toBe("1HGCM82633A004352");
  });

  it("rejects invalid document, phone, VIN, and uninsured claim", () => {
    expect(receptionStepOneSchema.safeParse({ ...valid, documentNumber: "123" }).success).toBe(false);
    expect(receptionStepOneSchema.safeParse({ ...valid, phone: "123456" }).success).toBe(false);
    expect(receptionStepOneSchema.safeParse({ ...valid, vin: "1HGCM82633A00435I" }).success).toBe(false);
    expect(receptionStepOneSchema.safeParse({ ...valid, modality: "MAPFRE", claimNumber: "", claimPendingReminder: false }).success).toBe(false);
  });

  it("accepts QUALITAS as an insured modality and requires its claim or reminder", () => {
    expect(receptionStepOneSchema.safeParse({ ...valid, modality: "QUALITAS", claimNumber: "QUI-2026-001", claimPendingReminder: false }).success).toBe(true);
    expect(receptionStepOneSchema.safeParse({ ...valid, modality: "QUALITAS", claimNumber: "", claimPendingReminder: false }).success).toBe(false);
  });

  it("formats the known plate variants from the prototype", () => {
    expect(normalizePlate("e abc789")).toBe("E ABC-789");
    expect(normalizePlate("cd0123")).toBe("CD-0123");
    expect(normalizePlate("ng1234")).toBe("NG-1234");
  });
});

describe("operational data validation", () => {
  it("normalizes operational contacts and requires a correction reason", () => {
    const result = operationalDataSchema.parse({ phoneOverride: "999 888 777", emailOverride: "  operaciones@parautos.pe ", claimNumber: " SIN-22 ", claimPendingReminder: false, reason: "  Cliente   confirmó  " });
    expect(result).toMatchObject({ phoneOverride: "999888777", emailOverride: "operaciones@parautos.pe", claimNumber: "SIN-22", reason: "Cliente confirmó" });
  });

  it("rejects invalid contacts and an empty correction reason", () => {
    const validOperational = { phoneOverride: "999888777", emailOverride: "operaciones@parautos.pe", claimPendingReminder: true, reason: "Corrección" };
    expect(operationalDataSchema.safeParse({ ...validOperational, phoneOverride: "123456" }).success).toBe(false);
    expect(operationalDataSchema.safeParse({ ...validOperational, emailOverride: "no-es-correo" }).success).toBe(false);
    expect(operationalDataSchema.safeParse({ ...validOperational, reason: "   " }).success).toBe(false);
  });
});
