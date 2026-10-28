import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "mariadb";
import { technicalLogger } from "../logging/technical-logger.js";
import { getEnvironment } from "../config/env.js";
import { closePool, getPool, runWithDatabaseScope } from "./pool.js";
import { createOrder, createQuote, transitionQuote } from "../modules/orders/service.js";
import { demoHash, personaFor } from "./demo-personas.js";
import type { CreateOrderInput } from "@parautos/shared";

type Modality = CreateOrderInput["modality"];
type QuoteLine = Parameters<typeof createQuote>[1]["lines"][number];

const DAY_MS = 86_400_000;

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
export type SeedOutcome = "created" | "failed";

type SeedCatalogs = {
  advisors: Array<{ id: number }>;
  bodyTypes: Array<{ id: number }>;
  checklist: Array<{ id: number }>;
};

type SeedContext = SeedCatalogs & {
  pool: Pool;
  anchor: number;
};

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

function normalizedPlateFor(index: number): string {
  return plateFor(index).replace(/[^A-Z0-9]/g, "");
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

function checklistAnswersFor(checklist: SeedCatalogs["checklist"]) {
  return checklist.map((item, itemIndex) => {
    const needsRepair = itemIndex % 11 === 0;
    return {
      itemId: item.id,
      answer: needsRepair ? ("NO" as const) : ("SI" as const),
      observation: needsRepair ? "Revisar durante la reparación" : undefined,
    };
  });
}

/**
 * Reparte las fechas en los últimos 365 días, en horario laboral (08:00–18:59).
 * El literal se guarda tal cual y es el que muestra la aplicación. Determinista
 * por índice.
 */
function dateFor(index: number, anchor: number): Date {
  const seed = demoHash(index * 31 + 17);
  const daysAgo = seed % 365;
  const minutes = (seed >>> 8) % 660;
  const seconds = (seed >>> 20) % 60;
  const date = new Date(anchor - daysAgo * DAY_MS);
  date.setUTCHours(8, 0, 0, 0);
  date.setUTCMinutes(minutes);
  date.setUTCSeconds(seconds);
  if (date.getTime() > anchor) date.setTime(date.getTime() - DAY_MS);
  return date;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function stamp(date: Date): string {
  return date.toISOString().slice(0, 23).replace("T", " ");
}

/**
 * Retrodata una orden recién creada para que la demo muestre actividad
 * histórica coherente: orden → recepción → cotización → envío → aprobación.
 */
async function backdateCase(
  pool: Pool,
  caseData: { orderId: number; quoteId: number; index: number; stage: number },
  anchor: number,
): Promise<void> {
  const base = dateFor(caseData.index, anchor);
  const receptionAt = addMinutes(base, 60);
  const quoteAt = addMinutes(base, 180);
  const sentAt = addDays(base, 1);
  const approvedAt = addDays(base, 2);
  const orderNumber = `OS-${base.getUTCFullYear()}-${String(caseData.orderId).padStart(5, "0")}`;

  await pool.query("UPDATE service_orders SET created_at = ?, order_number = ? WHERE id = ?", [
    stamp(base),
    orderNumber,
    caseData.orderId,
  ]);
  await pool.query("UPDATE receptions SET created_at = ? WHERE order_id = ?", [stamp(receptionAt), caseData.orderId]);
  await pool.query("UPDATE quote_versions SET created_at = ?, sent_at = ?, approved_at = ? WHERE id = ?", [
    stamp(quoteAt),
    caseData.stage === 0 ? null : stamp(sentAt),
    caseData.stage === 3 ? stamp(approvedAt) : null,
    caseData.quoteId,
  ]);
  await pool.query("UPDATE attachments SET created_at = ? WHERE order_id = ?", [stamp(receptionAt), caseData.orderId]);
  await pool.query(
    `UPDATE audit_events SET created_at = CASE action
       WHEN 'CREATED' THEN ?
       WHEN 'QUOTE_CREATED' THEN ?
       WHEN 'QUOTE_SENT' THEN ?
       WHEN 'QUOTE_APPROVED' THEN ?
       ELSE ? END
     WHERE entity = 'service_order' AND record_id = ?`,
    [stamp(base), stamp(quoteAt), stamp(sentAt), stamp(approvedAt), stamp(base), String(caseData.orderId)],
  );
}

/**
 * Crea una orden demo con su cotización y, según la etapa, su envío/aprobación.
 * Devuelve el resultado en lugar de lanzar, para que el lote continúe ante un
 * caso defectuoso.
 */
async function seedOneCase(context: SeedContext, index: number): Promise<SeedOutcome> {
  const plate = plateFor(index);
  const normalized = normalizedPlateFor(index);
  const slot = index % BRANDS.length;
  const modality = MODALITIES[index % MODALITIES.length];
  const actorId = context.advisors[index % context.advisors.length].id;
  const persona = personaFor(index);

  try {
    const order = await createOrder({
      client: {
        documentType: "DNI",
        documentNumber: String(70_000_000 + index),
        fullName: persona.fullName,
        phone: persona.phone,
        email: persona.email,
      },
      vehicle: {
        plate,
        brand: BRANDS[slot],
        model: MODELS[slot],
        year: 2015 + (index % 10),
        // El VIN excluye I, O y Q: "DMV" + 8 dígitos + 6 dígitos = 17 caracteres.
        vin: `DMV${String(70_000_000 + index)}${String(index).padStart(6, "0")}`,
        color: COLORS[slot],
        colorType: "CATALOGO",
        bodyTypeId: context.bodyTypes[index % context.bodyTypes.length].id,
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
      checklist: checklistAnswersFor(context.checklist),
      acceptedTerms: true,
    }, actorId, `demo-1000-${normalized}`, "127.0.0.1", "PARAUTOS demo 1000");

    const quote = await createQuote(order.id, { currency: "PEN", ...quoteLines(index) }, actorId, `demo-1000-quote-${normalized}`);

    const stage = index % 4;
    if (stage !== 0)
      await transitionQuote(order.id, quote.id, "SEND", actorId, `demo-1000-send-${normalized}`);
    if (stage === 3)
      await transitionQuote(order.id, quote.id, "APPROVE", actorId, `demo-1000-approve-${normalized}`);

    await backdateCase(context.pool, { orderId: order.id, quoteId: quote.id, index, stage }, context.anchor);

    return "created";
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[seed-1000] Falló índice=${index} placa=${plate}: ${message}`);
    return "failed";
  }
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
  const anchor = Date.now();

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

    const context: SeedContext = { pool, anchor, advisors, bodyTypes, checklist };
    const summary: SeedSummary = { created: 0, skipped: 0, failed: 0 };
    const startedAt = Date.now();
    console.info(`[seed-1000] Iniciando ${count} casos demo desde el índice ${start}...`);

    for (let offset = 0; offset < count; offset += 1) {
      const index = start + offset;
      if (existingPlates.has(normalizedPlateFor(index))) {
        summary.skipped += 1;
        continue;
      }

      // Carga secuencial intencional: cada caso depende de la orden y la
      // cotización anteriores, y así se aísla el error por registro.
      const outcome = await seedOneCase(context, index); // NOSONAR: secuencial intencional (order → quote → transition)
      if (outcome === "failed") {
        summary.failed += 1;
        continue;
      }

      existingPlates.add(normalizedPlateFor(index));
      summary.created += 1;
      if (summary.created % 50 === 0) {
        const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.info(`[seed-1000] ${summary.created}/${count} creadas (${seconds}s, ${summary.failed} fallidas)`);
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
