import { closePool, getPool } from "./pool.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOrder, createQuote, transitionQuote } from "../modules/orders/service.js";

type Demo = {
  document: string;
  client: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  modality: "PARTICULAR" | "MAPFRE" | "RIMAC";
  claim?: string;
  diagnosis: string;
  quote: { noParts: boolean; lines: Array<{ type: "MANO_OBRA" | "REPUESTO"; category?: "PLANCHADO" | "PINTURA" | "MECANICA"; description: string; quantity: number; unitPrice: number }> };
  stage: "PENDING" | "SENT" | "APPROVED" | "TWO_QUOTES";
};

function largeQuoteLines(version: 1 | 2): Demo["quote"]["lines"] {
  const priceFactor = version === 2 ? 1.08 : 1;
  return [
    ...Array.from({ length: 12 }, (_, index) => ({ type: "MANO_OBRA" as const, category: "PLANCHADO" as const, description: `Planchado de panel ${index + 1}`, quantity: 1, unitPrice: Math.round((145 + index * 12) * priceFactor) })),
    ...Array.from({ length: 10 }, (_, index) => ({ type: "MANO_OBRA" as const, category: "PINTURA" as const, description: `Pintura y acabado de panel ${index + 1}`, quantity: 1, unitPrice: Math.round((130 + index * 14) * priceFactor) })),
    ...Array.from({ length: 6 }, (_, index) => ({ type: "MANO_OBRA" as const, category: "MECANICA" as const, description: `Inspección mecánica de componente ${index + 1}`, quantity: 1, unitPrice: Math.round((95 + index * 16) * priceFactor) })),
    ...Array.from({ length: 6 }, (_, index) => ({ type: "REPUESTO" as const, description: `Repuesto demostrativo ${index + 1}`, quantity: 1, unitPrice: Math.round((72 + index * 28) * priceFactor) })),
  ];
}

const demos: Demo[] = [
  {
    document: "70123451", client: "Lucía Medina Ramos", plate: "DEM-101", brand: "TOYOTA", model: "COROLLA", color: "Plata", modality: "PARTICULAR",
    diagnosis: "Rayones y abolladura leve en puerta delantera izquierda. Se recomienda planchado y pintura localizada.",
    quote: { noParts: true, lines: [{ type: "MANO_OBRA", category: "PLANCHADO", description: "Planchado de puerta delantera izquierda", quantity: 1, unitPrice: 220 }, { type: "MANO_OBRA", category: "PINTURA", description: "Pintura localizada de puerta", quantity: 1, unitPrice: 280 }] }, stage: "PENDING",
  },
  {
    document: "70123452", client: "Carlos Paredes Vega", plate: "DEM-202", brand: "HYUNDAI", model: "TUCSON", color: "Blanco", modality: "MAPFRE", claim: "MAP-DEMO-2026-02",
    diagnosis: "Daño en parachoques posterior y tapa de maletera. Cotización enviada para aprobación de aseguradora.",
    quote: { noParts: false, lines: [{ type: "MANO_OBRA", category: "PLANCHADO", description: "Reparación de parachoques posterior", quantity: 1, unitPrice: 320 }, { type: "MANO_OBRA", category: "PINTURA", description: "Pintura de parachoques posterior", quantity: 1, unitPrice: 360 }, { type: "REPUESTO", description: "Moldura posterior", quantity: 1, unitPrice: 185 }] }, stage: "SENT",
  },
  {
    document: "70123453", client: "Andrea Salazar Núñez", plate: "DEM-303", brand: "KIA", model: "SPORTAGE", color: "Negro", modality: "RIMAC", claim: "RIM-DEMO-2026-03",
    diagnosis: "Impacto frontal leve. Requiere cambio de faro derecho y reparación de parachoques delantero.",
    quote: { noParts: false, lines: [{ type: "MANO_OBRA", category: "PLANCHADO", description: "Reparación de parachoques delantero", quantity: 1, unitPrice: 340 }, { type: "MANO_OBRA", category: "PINTURA", description: "Pintura de parachoques delantero", quantity: 1, unitPrice: 380 }, { type: "REPUESTO", description: "Faro delantero derecho", quantity: 1, unitPrice: 740 }] }, stage: "APPROVED",
  },
  {
    document: "70123454", client: "Marcos Villanueva Ortiz", plate: "DEM-404", brand: "MAZDA", model: "CX-5", color: "Azul", modality: "MAPFRE", claim: "MAP-DEMO-2026-04",
    diagnosis: "Caso demostrativo de reparación extensa con dos cotizaciones versionadas y múltiples partidas para validar documentos PDF de varias páginas.",
    quote: { noParts: false, lines: largeQuoteLines(1) }, stage: "TWO_QUOTES",
  },
];

export async function seedDemo(): Promise<void> {
  const pool = getPool();
  const users = await pool.query<Array<{ id: number }>>("SELECT id FROM users WHERE username = 'demo.system' AND active = 1 LIMIT 1");
  const bodyTypes = await pool.query<Array<{ id: number }>>("SELECT id FROM body_types ORDER BY id LIMIT 1");
  const checklist = await pool.query<Array<{ id: number }>>("SELECT id FROM checklist_items ORDER BY id");
  if (!users[0] || !bodyTypes[0] || !checklist.length) throw new Error("Se requiere el actor técnico y catálogos de recepción para cargar datos demo.");
  const actorId = users[0].id;

  for (const demo of demos) {
    const existing = await pool.query<Array<{ id: number }>>("SELECT id FROM clients WHERE document_number = ?", [demo.document]);
    if (existing[0]) { console.info(`Demo existente: ${demo.plate}`); continue; }
    const order = await createOrder({
      client: { documentType: "DNI", documentNumber: demo.document, fullName: demo.client, phone: "999888777", email: `${demo.plate.toLowerCase()}@demo.parautos.pe` },
      vehicle: { plate: demo.plate, brand: demo.brand, model: demo.model, year: 2024, vin: `DEM${demo.document}PARAUT`, color: demo.color, colorType: "CATALOGO", bodyTypeId: bodyTypes[0].id },
      modality: demo.modality, claimNumber: demo.claim, claimPendingReminder: false, diagnosisPendingReminder: false,
      mileage: 18500, fuelLevel: 50, considerations: ["Orden generada para recorrido demostrativo"], damages: [], diagnosis: demo.diagnosis, diagnosisLegibility: "LEGIBLE", diagnosisReviewState: "REVISADA", checklistReviewed: true,
      signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5wQAAAABJRU5ErkJggg==",
      checklist: checklist.map((item, index) => ({ itemId: item.id, answer: index % 9 === 0 ? "NO" as const : "SI" as const, observation: index % 9 === 0 ? "Revisar durante la reparación" : undefined })), acceptedTerms: true,
    }, actorId, `demo-${demo.plate}`, "127.0.0.1", "PARAUTOS demo seed");
    const quote = await createQuote(order.id, { currency: "PEN", noParts: demo.quote.noParts, lines: demo.quote.lines }, actorId, `demo-quote-${demo.plate}`);
    if (demo.stage === "TWO_QUOTES") {
      await transitionQuote(order.id, quote.id, "SEND", actorId, `demo-send-v1-${demo.plate}`);
      const revised = await createQuote(order.id, { currency: "PEN", noParts: false, adjustmentReason: "Ajuste demostrativo de precios y partidas para validación PDF", lines: largeQuoteLines(2) }, actorId, `demo-quote-v2-${demo.plate}`);
      await transitionQuote(order.id, revised.id, "SEND", actorId, `demo-send-v2-${demo.plate}`);
    } else {
      if (demo.stage !== "PENDING") await transitionQuote(order.id, quote.id, "SEND", actorId, `demo-send-${demo.plate}`);
      if (demo.stage === "APPROVED") await transitionQuote(order.id, quote.id, "APPROVE", actorId, `demo-approve-${demo.plate}`);
    }
    console.info(`Demo creada: ${order.orderNumber} · ${demo.plate}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  seedDemo().then(() => closePool()).catch(async (error: unknown) => { console.error(error); await closePool(); process.exitCode = 1; });
