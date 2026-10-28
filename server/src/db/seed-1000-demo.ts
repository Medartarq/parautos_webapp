import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { technicalLogger } from "../logging/technical-logger.js";
import { getEnvironment } from "../config/env.js";
import { closePool, getPool, runWithDatabaseScope } from "./pool.js";
import { createOrder, createQuote, transitionQuote } from "../modules/orders/service.js";
import type { CreateOrderInput } from "@parautos/shared";

type Modality = CreateOrderInput["modality"];
type QuoteLine = Parameters<typeof createQuote>[1]["lines"][number];

const MODALITIES = [
  "PARTICULAR",
  "MAPFRE",
  "RIMAC",
  "PACIFICO",
  "LA_POSITIVA",
  "QUALITAS",
] as const satisfies readonly Modality[];

// Firma PNG 1x1 válida: createOrder exige una firma con formato data:image/png;base64.
const SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5wQAAAABJRU5ErkJggg==";

const BRANDS = ["TOYOTA", "HYUNDAI", "KIA", "MAZDA", "CHEVROLET", "FORD", "VOLKSWAGEN", "RENAULT", "NISSAN", "CITROEN"] as const;
const MODELS = ["COROLLA", "TUCSON", "SPORTAGE", "CX-5", "AVEO", "FOCUS", "GOL", "CLIO", "QASHQAI", "MEGANE"] as const;
const COLORS = ["Plata", "Blanco", "Negro", "Azul", "Rojo", "Gris", "Plateado", "Negro Perla", "Blanco Nacarado", "Grafito"] as const;
const DIAGNOSES = [
  "Rayones y abolladura leve en puerta delantera izquierda.",
  "Daño en parachoques posterior y tapa de maletera.",
  "Impacto frontal leve. Requiere cambio de faro derecho.",
  "Varios daños en laterales y maletero.",
  "Daño en faro izquierdo y espejo lateral.",
  "Agujetas y daño menor tras un siniestro.",
  "Abolladura en puerta trasera derecha.",
  "Rayo en capó y daño en parabrisas.",
  "Daño en bumper frontal y guardafangos.",
  "Siniestro múltiple lateral y trasero.",
] as const;

const FUEL_LEVELS = [0, 25, 50, 75, 100] as const;

export type SeedSummary = { created: number; skipped: number; failed: number };

function nonNegativeInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${name} debe ser un entero no negativo.`);
  return value;
}

function plateFor(index: number): string {
  return `DM-${String(index + 1).padStart(4, "0")}`;
}

function quoteLines(index: number): { noParts: boolean; lines: QuoteLine[] } {
  const withParts = index % 3 === 0;
  const lines: QuoteLine[] = [
    { type: "MANO_OBRA", category: "PLANCHADO", description: "Planchado y alineado de panel", quantity: 1, unitPrice: 140 + (index % 11) * 15 },
    { type: "MANO_OBRA", category: "PINTURA", description: "Pintura y acabado de panel", quantity: 1, unitPrice: 165 + (index % 13) * 18 },
  ];
  if (withParts)
    lines.push({ type: "REPUESTO", description: "Repuesto demostrativo de carrocería", quantity: 1, unitPrice: 190 + (index % 7) * 35 });
  return { noParts: !withParts, lines };
}

/**
 * Carga casos ficticios SOLO en la base demo.
 *
 * - `runWithDatabaseScope("demo")` hace que `createOrder`, `createQuote` y
 *   `transitionQuote` (que usan `getPool()`) apunten a la base demo y a la
 *   carpeta de adjuntos demo.
 * - Es idempotente por placa: las órdenes ya cargadas se omiten.
 * - Los errores de un caso se registran y se continúa con el siguiente.
 */
export async function seed1000Demo(): Promise<SeedSummary> {
  if (!getEnvironment().DEMO_MODE_ENABLED)
    throw new Error("DEMO_MODE_ENABLED debe ser true para ejecutar la carga demo.");

  const count = nonNegativeInt("DEMO_SEED_COUNT", 1000);
  const start = nonNegativeInt("DEMO_SEED_START", 0);

  return runWithDatabaseScope("demo", async () => {
    const pool = getPool();

    const advisors = await pool.query<Array<{ id: number }>>(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.active = 1 AND r.code IN ('ASESOR','ADMINISTRADOR','SUPERADMINISTRADOR')
       ORDER BY u.id`,
    );
    const bodyTypes = await pool.query<Array<{ id: number }>>("SELECT id FROM body_types WHERE active = 1 ORDER BY id");
    const checklist = await pool.query<Array<{ id: number }>>("SELECT id FROM checklist_items WHERE active = 1 ORDER BY id");
    if (!advisors.length) throw new Error("La base demo no tiene usuarios activos para registrar órdenes.");
    if (!bodyTypes.length || !checklist.length) throw new Error("La base demo no tiene catálogos de recepción activos.");

    const existing = await pool.query<Array<{ plate: string }>>(
      `SELECT v.plate FROM service_orders o
       JOIN client_vehicles cv ON cv.id = o.client_vehicle_id
       JOIN vehicles v ON v.id = cv.vehicle_id
       WHERE v.plate LIKE 'DM%'`,
    );
    const existingPlates = new Set(existing.map((row) => String(row.plate)));

    const summary: SeedSummary = { created: 0, skipped: 0, failed: 0 };
    const startedAt = Date.now();
    console.info(`[seed-1000] Iniciando ${count} casos demo desde el índice ${start}...`);

    for (let offset = 0; offset < count; offset += 1) {
      const index = start + offset;
      const plate = plateFor(index);
      const normalizedPlate = plate.replace(/[^A-Z0-9]/g, "");
      if (existingPlates.has(normalizedPlate)) { summary.skipped += 1; continue; }

      const slot = index % BRANDS.length;
      const modality = MODALITIES[index % MODALITIES.length];
      const documentNumber = String(70_000_000 + index);
      const checklistAnswers = checklist.map((item, itemIndex) => ({
        itemId: item.id,
        answer: itemIndex % 11 === 0 ? ("NO" as const) : ("SI" as const),
        observation: itemIndex % 11 === 0 ? "Revisar durante la reparación" : undefined,
      }));

      try {
        const order = await createOrder({
          client: {
            documentType: "DNI",
            documentNumber,
            fullName: `Cliente Demo ${String(index + 1).padStart(4, "0")}`,
            phone: "999888777",
            email: `cliente${index + 1}@demo.parautos.pe`,
          },
          vehicle: {
            plate,
            brand: BRANDS[slot],
            model: MODELS[slot],
            year: 2015 + (index % 10),
            // El VIN excluye I, O y Q: "DMV" + 8 dígitos + 6 dígitos = 17 caracteres.
            vin: `DMV${documentNumber}${String(index).padStart(6, "0")}`,
            color: COLORS[slot],
            colorType: "CATALOGO",
            bodyTypeId: bodyTypes[index % bodyTypes.length].id,
          },
          modality,
          claimNumber: modality === "PARTICULAR" ? undefined : `DM-2026-${String(index + 1).padStart(4, "0")}`,
          claimPendingReminder: false,
          diagnosisPendingReminder: false,
          mileage: 12_000 + (index % 90) * 137,
          fuelLevel: FUEL_LEVELS[index % FUEL_LEVELS.length],
          considerations: ["Caso generado para la prueba de carga de 1,000 órdenes demo."],
          damages: [],
          diagnosis: DIAGNOSES[index % DIAGNOSES.length],
          diagnosisLegibility: "LEGIBLE",
          diagnosisReviewState: "REVISADA",
          checklistReviewed: true,
          signature: SIGNATURE,
          checklist: checklistAnswers,
          acceptedTerms: true,
        }, advisors[index % advisors.length].id, `demo-1000-${normalizedPlate}`, "127.0.0.1", "PARAUTOS demo 1000");

        const quote = await createQuote(order.id, { currency: "PEN", ...quoteLines(index) }, advisors[index % advisors.length].id, `demo-1000-quote-${normalizedPlate}`);

        const stage = index % 4;
        if (stage === 1 || stage === 2 || stage === 3)
          await transitionQuote(order.id, quote.id, "SEND", advisors[index % advisors.length].id, `demo-1000-send-${normalizedPlate}`);
        if (stage === 3)
          await transitionQuote(order.id, quote.id, "APPROVE", advisors[index % advisors.length].id, `demo-1000-approve-${normalizedPlate}`);

        existingPlates.add(normalizedPlate);
        summary.created += 1;
        if (summary.created % 50 === 0) {
          const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
          console.info(`[seed-1000] ${summary.created}/${count} creadas (${seconds}s, ${summary.failed} fallidas)`);
        }
      } catch (error: unknown) {
        summary.failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[seed-1000] Falló índice=${index} placa=${plate}: ${message}`);
      }
    }

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.info(`[seed-1000] Creadas=${summary.created} existentes=${summary.skipped} fallidas=${summary.failed} en ${seconds}s.`);
    return summary;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  seed1000Demo()
    .then((summary) => {
      if (summary.created === 0 && summary.failed > 0) process.exitCode = 1;
    })
    .then(() => closePool())
    .catch(async (error: unknown) => {
      technicalLogger.failure("database_task_failed", error);
      await closePool();
      process.exitCode = 1;
    });
