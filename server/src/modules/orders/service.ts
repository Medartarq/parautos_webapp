import { randomInt } from "node:crypto";
import type { PoolConnection } from "mariadb";
import {
  receptionStepOneSchema,
  type CreateOrderInput,
  type OperationalDataInput,
} from "@parautos/shared";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";
import { deleteStoredFile, storeSignature } from "../attachments/storage.js";

type IdRow = { id: number };

export function generatePublicCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function getReceptionCatalog() {
  const bodyTypes = await getPool().query<
    { id: number; code: string; name: string }[]
  >("SELECT id, code, name FROM body_types WHERE active = 1 ORDER BY code");
  const checklist = await getPool().query<
    { id: number; category: string; name: string }[]
  >(
    `SELECT i.id, c.name AS category, i.name FROM checklist_items i JOIN checklist_categories c ON c.id = i.category_id WHERE i.active = 1 AND c.active = 1 ORDER BY c.display_order, i.display_order`,
  );
  return { bodyTypes, checklist };
}

async function idFor(
  connection: PoolConnection,
  query: string,
  parameters: unknown[],
): Promise<number> {
  const rows = await connection.query<IdRow[]>(query, parameters);
  if (!rows[0])
    throw new AppError(
      500,
      "PERSISTENCE_ERROR",
      "No fue posible recuperar el registro creado.",
    );
  return Number(rows[0].id);
}

export async function createOrder(
  input: CreateOrderInput,
  advisorId: number,
  requestId: string,
  ipAddress?: string,
  userAgent?: string,
) {
  const normalized = receptionStepOneSchema.parse({
    documentType: input.client.documentType,
    documentNumber: input.client.documentNumber,
    fullName: input.client.fullName,
    phone: input.client.phone,
    email: input.client.email,
    plate: input.vehicle.plate,
    modality: input.modality,
    claimNumber: input.claimNumber,
    claimPendingReminder: input.claimPendingReminder,
    brand: input.vehicle.brand,
    model: input.vehicle.model,
    color: input.vehicle.color,
    colorType: input.vehicle.colorType,
    year: input.vehicle.year,
    vin: input.vehicle.vin,
    mileage: input.mileage,
    bodyTypeId: input.vehicle.bodyTypeId,
  });
  input.client.documentNumber = normalized.documentNumber;
  input.client.fullName = normalized.fullName;
  input.client.phone = normalized.phone;
  input.client.email = normalized.email;
  input.vehicle.plate = normalized.plate;
  input.vehicle.brand = normalized.brand;
  input.vehicle.model = normalized.model;
  input.vehicle.color = normalized.color;
  input.vehicle.vin = normalized.vin;
  input.claimNumber = normalized.claimNumber;
  input.mileage = normalized.mileage;
  const pool = getPool();
  const activeChecklist = await pool.query<IdRow[]>(
    "SELECT id FROM checklist_items WHERE active = 1 ORDER BY id",
  );
  const expected = new Set(activeChecklist.map((item) => Number(item.id)));
  const received = new Set(input.checklist.map((item) => item.itemId));
  if (
    expected.size !== received.size ||
    [...expected].some((id) => !received.has(id))
  ) {
    throw new AppError(
      400,
      "CHECKLIST_INCOMPLETE",
      "Debe responder los 44 items del checklist.",
    );
  }
  if (input.claimPendingReminder && input.claimNumber)
    throw new AppError(
      400,
      "CLAIM_CONFLICT",
      "No puede registrar un siniestro y marcarlo como pendiente a la vez.",
    );
  if (
    input.modality !== "PARTICULAR" &&
    !input.claimNumber &&
    !input.claimPendingReminder
  )
    throw new AppError(
      400,
      "CLAIM_REQUIRED",
      "El numero de siniestro es obligatorio para aseguradoras.",
    );
  if (!input.checklistReviewed || !input.signature)
    throw new AppError(
      400,
      "RECEPTION_CONFIRMATION_REQUIRED",
      "Debe revisar el checklist y registrar la firma.",
    );

  const connection = await pool.getConnection();
  let failed = true;
  let storedSignature: Awaited<ReturnType<typeof storeSignature>> | undefined;
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO clients (document_type, document_number, full_name, phone, email) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), phone = VALUES(phone), email = VALUES(email)`,
      [
        input.client.documentType,
        input.client.documentNumber,
        input.client.fullName,
        input.client.phone || null,
        input.client.email || null,
      ],
    );
    const clientId = await idFor(
      connection,
      "SELECT id FROM clients WHERE document_type = ? AND document_number = ?",
      [input.client.documentType, input.client.documentNumber],
    );
    const plate = normalizePlate(input.vehicle.plate);
    await connection.query(
      `INSERT INTO vehicles (plate, brand, model, manufacture_year, vin, color, color_type, body_type_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE brand = VALUES(brand), model = VALUES(model), manufacture_year = VALUES(manufacture_year), vin = VALUES(vin), color = VALUES(color), color_type = VALUES(color_type), body_type_id = VALUES(body_type_id)`,
      [
        plate,
        input.vehicle.brand.toUpperCase(),
        input.vehicle.model.toUpperCase(),
        input.vehicle.year || null,
        input.vehicle.vin?.toUpperCase() || null,
        input.vehicle.color,
        input.vehicle.colorType,
        input.vehicle.bodyTypeId,
      ],
    );
    const vehicleId = await idFor(
      connection,
      "SELECT id FROM vehicles WHERE plate = ?",
      [plate],
    );
    await connection.query(
      "INSERT IGNORE INTO client_vehicles (client_id, vehicle_id) VALUES (?, ?)",
      [clientId, vehicleId],
    );
    const clientVehicleId = await idFor(
      connection,
      "SELECT id FROM client_vehicles WHERE client_id = ? AND vehicle_id = ?",
      [clientId, vehicleId],
    );
    // The vehicle upsert holds its row lock, serializing active-code checks for this plate.
    let publicCode = "";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = generatePublicCode();
      const matchingOrders = await connection.query<IdRow[]>(
        `SELECT o.id FROM service_orders o
         JOIN client_vehicles cv ON cv.id = o.client_vehicle_id
         WHERE cv.vehicle_id = ? AND o.public_code = ?
           AND o.internal_status NOT IN ('ENTREGADA', 'CANCELADA')
         LIMIT 1`,
        [vehicleId, candidate],
      );
      if (!matchingOrders[0]) {
        publicCode = candidate;
        break;
      }
    }
    if (!publicCode)
      throw new AppError(500, "PUBLIC_CODE_GENERATION_FAILED", "No fue posible generar el código público.");
    const insert = await connection.query<{ insertId: number }>(
      "INSERT INTO service_orders (public_code, client_vehicle_id, advisor_user_id, modality, claim_number, claim_pending_reminder, diagnosis_pending_reminder) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        publicCode,
        clientVehicleId,
        advisorId,
        input.modality,
        input.claimNumber || null,
        input.claimPendingReminder ? 1 : 0,
        input.diagnosisPendingReminder ? 1 : 0,
      ],
    );
    const orderId = Number(insert.insertId);
    const orderNumber = `OS-${new Date().getUTCFullYear()}-${String(orderId).padStart(5, "0")}`;
    await connection.query(
      "UPDATE service_orders SET order_number = ? WHERE id = ?",
      [orderNumber, orderId],
    );
    const reception = await connection.query<{ insertId: number }>(
      "INSERT INTO receptions (order_id, advisor_user_id, mileage, fuel_level, considerations, diagnosis, diagnosis_legibility, diagnosis_review_state, checklist_reviewed_at, accepted_terms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(6), 1)",
      [
        orderId,
        advisorId,
        input.mileage ?? null,
        input.fuelLevel ?? null,
        JSON.stringify(input.considerations),
        input.diagnosis || null,
        input.diagnosisLegibility,
        input.diagnosisReviewState,
      ],
    );
    const receptionId = Number(reception.insertId);
    const signatureBytes = Buffer.from(input.signature.slice("data:image/png;base64,".length), "base64");
    storedSignature = await storeSignature(signatureBytes);
    await connection.query(
      `INSERT INTO attachments (order_id, reception_id, uploaded_by_user_id, category, storage_provider, object_key, original_name, mime_type, byte_size, sha256)
       VALUES (?, ?, ?, 'OTRO', ?, ?, 'firma-cliente.png', 'image/png', ?, ?)`,
      [orderId, receptionId, advisorId, storedSignature.provider, storedSignature.objectKey, storedSignature.byteSize, storedSignature.sha256],
    );
    for (const item of input.checklist)
      await connection.query(
        "INSERT INTO checklist_answers (reception_id, item_id, answer, observation) VALUES (?, ?, ?, ?)",
        [receptionId, item.itemId, item.answer, item.observation || null],
      );
    for (const damage of input.damages)
      await connection.query(
        "INSERT INTO damage_marks (reception_id, body_code, body_view, path_data, description) VALUES (?, ?, ?, ?, ?)",
        [
          receptionId,
          damage.body,
          damage.view,
          JSON.stringify(damage.path),
          damage.description || null,
        ],
      );
    await connection.query(
      "INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'CREATED', JSON_OBJECT('orderNumber', ?, 'plate', ?), ?, ?, ?)",
      [
        advisorId,
        String(orderId),
        orderNumber,
        plate,
        requestId,
        ipAddress ?? null,
        userAgent ?? null,
      ],
    );
    await connection.commit();
    failed = false;
    return { id: orderId, orderNumber, publicCode };
  } finally {
    if (failed) await connection.rollback();
    connection.release();
    if (failed && storedSignature) await deleteStoredFile(storedSignature.provider, storedSignature.objectKey);
  }
}

export async function listOrders() {
  return getPool().query(
    `SELECT o.id, o.order_number AS orderNumber, o.internal_status AS status, o.modality, o.claim_pending_reminder AS claimPending, o.created_at AS createdAt, c.full_name AS client, v.plate, v.brand, v.model, v.color FROM service_orders o JOIN client_vehicles cv ON cv.id = o.client_vehicle_id JOIN clients c ON c.id = cv.client_id JOIN vehicles v ON v.id = cv.vehicle_id ORDER BY o.created_at DESC`,
  );
}

export async function getOperationalPendingNotifications() {
  const pool = getPool();
  const baseColumns = "o.id, o.order_number AS orderNumber, o.created_at AS createdAt, c.full_name AS client, v.plate, v.brand, v.model";
  const joins = "FROM service_orders o JOIN client_vehicles cv ON cv.id = o.client_vehicle_id JOIN clients c ON c.id = cv.client_id JOIN vehicles v ON v.id = cv.vehicle_id";
  const [diagnosisPending, quotePending] = await Promise.all([
    pool.query<any[]>(`SELECT ${baseColumns} ${joins} WHERE o.diagnosis_pending_reminder = 1 AND o.internal_status NOT IN ('ENTREGADA', 'CANCELADA') ORDER BY o.created_at ASC`),
    pool.query<any[]>(`SELECT ${baseColumns} ${joins} WHERE o.diagnosis_pending_reminder = 0 AND o.internal_status = 'COTIZACION_PENDIENTE' AND NOT EXISTS (SELECT 1 FROM quote_versions q WHERE q.order_id = o.id) ORDER BY o.created_at ASC`),
  ]);
  return { total: diagnosisPending.length + quotePending.length, diagnosisPending, quotePending };
}

export async function getOrderDetail(orderId: number) {
  const pool = getPool();
  const rows = await pool.query<any[]>(
    `SELECT o.id, o.order_number AS orderNumber, o.public_code AS publicCode, o.internal_status AS internalStatus, o.public_status AS publicStatus, o.modality, o.claim_number AS claimNumber, o.claim_pending_reminder AS claimPending, o.diagnosis_pending_reminder AS diagnosisPending, o.created_at AS createdAt, c.document_type AS documentType, c.document_number AS documentNumber, c.full_name AS client, c.phone, c.email, od.phone_override AS operationalPhone, od.email_override AS operationalEmail, od.updated_at AS operationalDataUpdatedAt, v.plate, v.brand, v.model, v.manufacture_year AS year, v.vin, v.color, v.color_type AS colorType, bt.code AS bodyCode, bt.name AS bodyName
     FROM service_orders o
     JOIN client_vehicles cv ON cv.id = o.client_vehicle_id
     JOIN clients c ON c.id = cv.client_id
     JOIN vehicles v ON v.id = cv.vehicle_id
     JOIN body_types bt ON bt.id = v.body_type_id
     LEFT JOIN order_operational_data od ON od.order_id = o.id
     WHERE o.id = ?`,
    [orderId],
  );
  const order = rows[0];
  if (!order) return null;
  order.claimPending = Boolean(order.claimPending);
  order.diagnosisPending = Boolean(order.diagnosisPending);
  const receptions = await pool.query<any[]>(
    `SELECT id, mileage, fuel_level AS fuelLevel, considerations, diagnosis, diagnosis_legibility AS diagnosisLegibility, diagnosis_review_state AS diagnosisReviewState, accepted_terms AS acceptedTerms, checklist_reviewed_at AS checklistReviewedAt, created_at AS createdAt
     FROM receptions WHERE order_id = ?`,
    [orderId],
  );
  const reception = receptions[0];
  if (!reception) return { ...order, reception: null, checklist: [], damages: [], attachments: [] };
  const [checklist, damages, attachments, history] = await Promise.all([
    pool.query<any[]>(
      `SELECT cc.name AS category, ci.name, ca.answer, ca.observation
       FROM checklist_answers ca JOIN checklist_items ci ON ci.id = ca.item_id
       JOIN checklist_categories cc ON cc.id = ci.category_id
       WHERE ca.reception_id = ? ORDER BY cc.display_order, ci.display_order`,
      [reception.id],
    ),
    pool.query<any[]>(
      `SELECT body_code AS body, body_view AS view, path_data AS path, description
       FROM damage_marks WHERE reception_id = ? ORDER BY id`,
      [reception.id],
    ),
    pool.query<any[]>(
      `SELECT id, category, original_name AS originalName, mime_type AS mimeType, byte_size AS byteSize, created_at AS createdAt
       FROM attachments WHERE order_id = ? ORDER BY created_at DESC`,
      [orderId],
    ),
    pool.query<any[]>(
      `SELECT ae.action, ae.previous_data AS previousData, ae.new_data AS newData, ae.created_at AS createdAt, u.names AS actor
       FROM audit_events ae LEFT JOIN users u ON u.id = ae.actor_user_id
       WHERE ae.entity = 'service_order' AND ae.record_id = ? ORDER BY ae.created_at DESC`,
      [String(orderId)],
    ),
  ]);
  return { ...order, reception, checklist, damages, attachments, history };
}

export async function correctOperationalData(
  orderId: number,
  input: OperationalDataInput,
  actorUserId: number,
  requestId: string,
  ipAddress?: string,
  userAgent?: string,
) {
  const connection = await getPool().getConnection();
  let failed = true;
  try {
    await connection.beginTransaction();
    const orders = await connection.query<any[]>(
      `SELECT o.modality, o.internal_status AS internalStatus, o.claim_number AS claimNumber,
              o.claim_pending_reminder AS claimPending, od.phone_override AS phoneOverride,
              od.email_override AS emailOverride
       FROM service_orders o LEFT JOIN order_operational_data od ON od.order_id = o.id
       WHERE o.id = ? FOR UPDATE`,
      [orderId],
    );
    const order = orders[0];
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
    if (["ENTREGADA", "CANCELADA"].includes(order.internalStatus))
      throw new AppError(409, "ORDER_TERMINAL", "No puede corregir datos operativos de una orden cerrada.");

    const oldData = {
      phoneOverride: order.phoneOverride || undefined,
      emailOverride: order.emailOverride || undefined,
      claimNumber: order.claimNumber || undefined,
      claimPendingReminder: Boolean(order.claimPending),
    };
    const newData = {
      phoneOverride: input.phoneOverride,
      emailOverride: input.emailOverride,
      claimNumber: input.claimNumber,
      claimPendingReminder: input.claimPendingReminder,
    };
    if (order.modality === "PARTICULAR" && (newData.claimNumber || newData.claimPendingReminder))
      throw new AppError(400, "CLAIM_NOT_ALLOWED", "Las órdenes particulares no pueden registrar siniestro.");
    if (order.modality !== "PARTICULAR" && Boolean(newData.claimNumber) === newData.claimPendingReminder)
      throw new AppError(400, "CLAIM_INVARIANT", "La aseguradora debe tener número de siniestro o recordatorio pendiente, pero no ambos.");
    if (Object.keys(newData).every((key) => newData[key as keyof typeof newData] === oldData[key as keyof typeof oldData]))
      throw new AppError(400, "NO_MEANINGFUL_CHANGE", "Debe realizar al menos un cambio operativo.");

    await connection.query(
      `INSERT INTO order_operational_data (order_id, phone_override, email_override)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE phone_override = VALUES(phone_override), email_override = VALUES(email_override)`,
      [orderId, newData.phoneOverride || null, newData.emailOverride || null],
    );
    await connection.query(
      "UPDATE service_orders SET claim_number = ?, claim_pending_reminder = ? WHERE id = ?",
      [newData.claimNumber || null, newData.claimPendingReminder ? 1 : 0, orderId],
    );
    await connection.query(
      `INSERT INTO audit_events (actor_user_id, entity, record_id, action, previous_data, new_data, request_id, ip_address, user_agent)
       VALUES (?, 'service_order', ?, 'OPERATIONAL_DATA_CORRECTED', ?, ?, ?, ?, ?)`,
      [actorUserId, String(orderId), JSON.stringify(oldData), JSON.stringify({ ...newData, reason: input.reason }), requestId, ipAddress ?? null, userAgent ?? null],
    );
    await connection.commit();
    failed = false;
  } finally {
    if (failed) await connection.rollback();
    connection.release();
  }
}

export async function completePendingClaim(
  orderId: number,
  claimNumber: string,
  actorUserId: number,
  requestId: string,
  ipAddress?: string,
  userAgent?: string,
) {
  const pool = getPool();
  const connection = await pool.getConnection();
  let failed = true;
  try {
    await connection.beginTransaction();
    const rows = await connection.query<any[]>(
      "SELECT claim_number AS claimNumber, claim_pending_reminder AS claimPending FROM service_orders WHERE id = ? FOR UPDATE",
      [orderId],
    );
    const order = rows[0];
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
    if (!order.claimPending)
      throw new AppError(409, "CLAIM_NOT_PENDING", "La orden no tiene un siniestro pendiente.");
    await connection.query(
      "UPDATE service_orders SET claim_number = ?, claim_pending_reminder = 0 WHERE id = ?",
      [claimNumber, orderId],
    );
    await connection.query(
      "INSERT INTO audit_events (actor_user_id, entity, record_id, action, previous_data, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'CLAIM_COMPLETED', JSON_OBJECT('claimPending', true), JSON_OBJECT('claimNumber', ?, 'claimPending', false), ?, ?, ?)",
      [actorUserId, String(orderId), claimNumber, requestId, ipAddress ?? null, userAgent ?? null],
    );
    await connection.commit();
    failed = false;
  } finally {
    if (failed) await connection.rollback();
    connection.release();
  }
}

type QuoteLineInput = { type: "MANO_OBRA" | "REPUESTO"; category?: "PLANCHADO" | "PINTURA" | "MECANICA"; description: string; quantity: number; unitPrice: number };

export async function getReceptionDraft(userId: number) {
  const row = (await getPool().query<any[]>("SELECT revision, current_step AS currentStep, payload, updated_at AS updatedAt FROM reception_drafts WHERE user_id = ?", [userId]))[0];
  if (!row) return undefined;
  return { ...row, payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload };
}

export async function saveReceptionDraft(userId: number, input: { revision?: number; currentStep: number; payload: unknown }) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const current = (await connection.query<any[]>("SELECT revision FROM reception_drafts WHERE user_id = ? FOR UPDATE", [userId]))[0];
    if (!current) {
      if (input.revision !== undefined) throw new AppError(409, "RECEPTION_DRAFT_CONFLICT", "El borrador de recepción ya no está disponible. Recárguelo antes de guardar.");
      await connection.query("INSERT INTO reception_drafts (user_id, revision, current_step, payload) VALUES (?, 1, ?, ?)", [userId, input.currentStep, JSON.stringify(input.payload)]);
    } else {
      if (input.revision !== Number(current.revision)) throw new AppError(409, "RECEPTION_DRAFT_CONFLICT", "El borrador fue actualizado desde otro dispositivo. Recárguelo antes de guardar.");
      await connection.query("UPDATE reception_drafts SET revision = revision + 1, current_step = ?, payload = ? WHERE user_id = ?", [input.currentStep, JSON.stringify(input.payload), userId]);
    }
    await connection.commit(); failed = false;
    return getReceptionDraft(userId);
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function deleteReceptionDraft(userId: number) {
  await getPool().query("DELETE FROM reception_drafts WHERE user_id = ?", [userId]);
}

export async function listQuotes(orderId: number) {
  const pool = getPool();
  const versions = await pool.query<any[]>("SELECT id, version_number AS versionNumber, status, currency, no_parts AS noParts, adjustment_reason AS adjustmentReason, created_at AS createdAt, sent_at AS sentAt, approved_at AS approvedAt FROM quote_versions WHERE order_id = ? ORDER BY version_number DESC", [orderId]);
  return Promise.all(versions.map(async (version) => {
    const rows = await pool.query<any[]>("SELECT line_type AS type, labor_category AS category, description, quantity, unit_price AS unitPrice FROM quote_lines WHERE quote_version_id = ? ORDER BY id", [version.id]);
    // MariaDB entrega DECIMAL como texto. El contrato HTTP de cotizaciones usa
    // números para que un borrador recargado pueda volver a validarse y guardarse.
    const lines = rows.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) }));
    const total = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0);
    return { ...version, noParts: Boolean(version.noParts), lines, totalWithoutIgv: total, igv: 0 };
  }));
}

export async function getQuoteDraft(orderId: number) {
  const pool = getPool();
  const draft = (await pool.query<any[]>("SELECT id, currency, no_parts AS noParts, updated_at AS updatedAt FROM quote_drafts WHERE order_id = ?", [orderId]))[0];
  if (!draft) return undefined;
  const rows = await pool.query<any[]>("SELECT line_type AS type, labor_category AS category, description, quantity, unit_price AS unitPrice FROM quote_draft_lines WHERE quote_draft_id = ? ORDER BY id", [draft.id]);
  return { ...draft, noParts: Boolean(draft.noParts), lines: rows.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })) };
}

export async function saveQuoteDraft(orderId: number, input: { currency: "PEN" | "USD"; noParts: boolean; lines: QuoteLineInput[] }, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const order = (await connection.query<any[]>("SELECT id FROM service_orders WHERE id = ? FOR UPDATE", [orderId]))[0];
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
    let draft = (await connection.query<any[]>("SELECT id FROM quote_drafts WHERE order_id = ? FOR UPDATE", [orderId]))[0];
    if (!draft) { const result = await connection.query<any>("INSERT INTO quote_drafts (order_id, currency, no_parts, updated_by_user_id) VALUES (?, ?, ?, ?)", [orderId, input.currency, input.noParts ? 1 : 0, actorUserId]); draft = { id: Number(result.insertId) }; }
    else await connection.query("UPDATE quote_drafts SET currency = ?, no_parts = ?, updated_by_user_id = ? WHERE id = ?", [input.currency, input.noParts ? 1 : 0, actorUserId, draft.id]);
    await connection.query("DELETE FROM quote_draft_lines WHERE quote_draft_id = ?", [draft.id]);
    for (const line of input.lines) await connection.query("INSERT INTO quote_draft_lines (quote_draft_id, line_type, labor_category, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)", [draft.id, line.type, line.category || null, line.description, line.quantity, line.unitPrice]);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'QUOTE_DRAFT_SAVED', JSON_OBJECT('lineCount', ?, 'currency', ?), ?, ?, ?)", [actorUserId, String(orderId), input.lines.length, input.currency, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false;
    return getQuoteDraft(orderId);
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function createQuoteVersionFromDraft(orderId: number, adjustmentReason: string | undefined, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const draft = await getQuoteDraft(orderId);
  if (!draft || !draft.lines.length) throw new AppError(409, "QUOTE_DRAFT_REQUIRED", "Guarde un borrador con al menos una partida antes de crear una versión.");
  return createQuote(orderId, { currency: draft.currency, noParts: draft.noParts, adjustmentReason, lines: draft.lines }, actorUserId, requestId, ipAddress, userAgent);
}

export async function createQuote(orderId: number, input: { currency: "PEN" | "USD"; noParts: boolean; adjustmentReason?: string; lines: QuoteLineInput[] }, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection();
  let failed = true;
  try {
    await connection.beginTransaction();
    const orders = await connection.query<any[]>("SELECT id FROM service_orders WHERE id = ? FOR UPDATE", [orderId]);
    if (!orders[0]) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
    const current = await connection.query<any[]>("SELECT id, status, version_number AS versionNumber FROM quote_versions WHERE order_id = ? ORDER BY version_number DESC LIMIT 1 FOR UPDATE", [orderId]);
    const previous = current[0];
    const versionNumber = Number(previous?.versionNumber || 0) + 1;
    if (versionNumber > 1 && !input.adjustmentReason) throw new AppError(400, "ADJUSTMENT_REASON_REQUIRED", "Indique el motivo del ajuste.");
    if (previous?.status === "APROBADA") throw new AppError(409, "QUOTE_ALREADY_APPROVED", "No se puede ajustar una cotización aprobada.");
    if (previous) await connection.query("UPDATE quote_versions SET status = 'REEMPLAZADA' WHERE id = ?", [previous.id]);
    const result = await connection.query<any>("INSERT INTO quote_versions (order_id, version_number, currency, no_parts, adjustment_reason, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)", [orderId, versionNumber, input.currency, input.noParts ? 1 : 0, input.adjustmentReason || null, actorUserId]);
    const quoteId = Number(result.insertId);
    for (const line of input.lines) await connection.query("INSERT INTO quote_lines (quote_version_id, line_type, labor_category, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)", [quoteId, line.type, line.category || null, line.description, line.quantity, line.unitPrice]);
    const total = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'QUOTE_CREATED', JSON_OBJECT('quoteVersion', ?, 'currency', ?, 'totalWithoutIgv', ?), ?, ?, ?)", [actorUserId, String(orderId), versionNumber, input.currency, total, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false;
    return { id: quoteId, versionNumber, totalWithoutIgv: total, igv: 0 };
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function updateQuote(orderId: number, quoteId: number, input: { currency: "PEN" | "USD"; noParts: boolean; lines: QuoteLineInput[] }, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const quotes = await connection.query<any[]>("SELECT id, version_number AS versionNumber, status FROM quote_versions WHERE id = ? AND order_id = ? FOR UPDATE", [quoteId, orderId]);
    const quote = quotes[0];
    if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "La cotización no existe.");
    if (quote.status !== "PENDIENTE") throw new AppError(409, "QUOTE_NOT_EDITABLE", "Solo puede editar una cotización pendiente.");
    await connection.query("UPDATE quote_versions SET currency = ?, no_parts = ? WHERE id = ?", [input.currency, input.noParts ? 1 : 0, quoteId]);
    await connection.query("DELETE FROM quote_lines WHERE quote_version_id = ?", [quoteId]);
    for (const line of input.lines) await connection.query("INSERT INTO quote_lines (quote_version_id, line_type, labor_category, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)", [quoteId, line.type, line.category || null, line.description, line.quantity, line.unitPrice]);
    const total = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'QUOTE_UPDATED', JSON_OBJECT('quoteId', ?, 'quoteVersion', ?, 'totalWithoutIgv', ?), ?, ?, ?)", [actorUserId, String(orderId), quoteId, quote.versionNumber, total, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false;
    return { id: quoteId, versionNumber: quote.versionNumber, totalWithoutIgv: total, igv: 0 };
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function deleteQuote(orderId: number, quoteId: number, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const quotes = await connection.query<any[]>("SELECT id, version_number AS versionNumber, status, currency FROM quote_versions WHERE id = ? AND order_id = ? FOR UPDATE", [quoteId, orderId]);
    const quote = quotes[0];
    if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "La cotización no existe.");
    if (quote.status !== "PENDIENTE") throw new AppError(409, "QUOTE_CANNOT_BE_DELETED", "Solo puede eliminar una cotización pendiente.");
    const lines = await connection.query<any[]>("SELECT id, line_type AS type, labor_category AS category, description, quantity, unit_price AS unitPrice FROM quote_lines WHERE quote_version_id = ?", [quoteId]);
    const previous = await connection.query<any[]>("SELECT id, sent_at AS sentAt FROM quote_versions WHERE order_id = ? AND version_number < ? ORDER BY version_number DESC LIMIT 1 FOR UPDATE", [orderId, quote.versionNumber]);
    await connection.query("DELETE FROM quote_lines WHERE quote_version_id = ?", [quoteId]);
    await connection.query("DELETE FROM quote_versions WHERE id = ?", [quoteId]);
    if (previous[0]) {
      const restoredStatus = previous[0].sentAt ? "ENVIADA" : "PENDIENTE";
      const restoredOrderStatus = previous[0].sentAt ? "ESPERA_APROBACION" : "COTIZACION_PENDIENTE";
      await connection.query("UPDATE quote_versions SET status = ? WHERE id = ?", [restoredStatus, previous[0].id]);
      await connection.query("UPDATE service_orders SET internal_status = ?, public_status = ? WHERE id = ?", [restoredOrderStatus, restoredOrderStatus, orderId]);
    } else await connection.query("UPDATE service_orders SET internal_status = 'COTIZACION_PENDIENTE', public_status = 'COTIZACION_PENDIENTE' WHERE id = ?", [orderId]);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, previous_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'QUOTE_DELETED', JSON_OBJECT('quoteId', ?, 'quoteVersion', ?, 'currency', ?, 'lines', ?), ?, ?, ?)", [actorUserId, String(orderId), quoteId, quote.versionNumber, quote.currency, JSON.stringify(lines), requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false;
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function transitionQuote(orderId: number, quoteId: number, action: "SEND" | "APPROVE", actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const quotes = await connection.query<any[]>("SELECT id, status, currency, no_parts AS noParts, version_number AS versionNumber FROM quote_versions WHERE id = ? AND order_id = ? FOR UPDATE", [quoteId, orderId]);
    const quote = quotes[0];
    if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "La cotización no existe.");
    if ((action === "SEND" && quote.status !== "PENDIENTE") || (action === "APPROVE" && quote.status !== "ENVIADA")) throw new AppError(409, "INVALID_QUOTE_TRANSITION", "La cotización no está en el estado requerido.");
    const lines = await connection.query<any[]>("SELECT id, line_type AS type, labor_category AS category, description, quantity, unit_price AS unitPrice FROM quote_lines WHERE quote_version_id = ?", [quoteId]);
    if (!lines.length) throw new AppError(400, "QUOTE_EMPTY", "La cotización debe tener al menos una línea.");
    const totalWithoutIgv = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0);
    const snapshot = JSON.stringify({ versionNumber: quote.versionNumber, currency: quote.currency, noParts: Boolean(quote.noParts), lines, totalWithoutIgv, igv: 0 });
    const hasParts = lines.some((line) => line.type === "REPUESTO");
    const nextStatus = action === "SEND" ? "ESPERA_APROBACION" : hasParts ? "ESPERA_REPUESTOS" : "EN_REPARACION";
    await connection.query(action === "SEND" ? "UPDATE quote_versions SET status = 'ENVIADA', sent_at = CURRENT_TIMESTAMP(6), sent_snapshot = ? WHERE id = ?" : "UPDATE quote_versions SET status = 'APROBADA', approved_at = CURRENT_TIMESTAMP(6), approved_snapshot = ? WHERE id = ?", [snapshot, quoteId]);
    if (action === "APPROVE") {
      for (const line of lines.filter((line) => line.type === "REPUESTO"))
        await connection.query("INSERT INTO order_parts (order_id, quote_line_id, description, quantity) VALUES (?, ?, ?, ?)", [orderId, line.id, line.description, line.quantity]);
    }
    await connection.query("UPDATE service_orders SET internal_status = ?, public_status = ? WHERE id = ?", [nextStatus, nextStatus, orderId]);
    const event = action === "SEND" ? "QUOTE_SENT" : "QUOTE_APPROVED";
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, ?, JSON_OBJECT('quoteId', ?, 'nextStatus', ?), ?, ?, ?)", [actorUserId, String(orderId), event, quoteId, nextStatus, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false; return { status: nextStatus, totalWithoutIgv };
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function getNavigationSummary() {
  const rows = await getPool().query<{ pendingClaims: number }[]>(
    "SELECT COUNT(*) AS pendingClaims FROM service_orders WHERE claim_pending_reminder = 1 AND internal_status NOT IN ('ENTREGADA', 'CANCELADA')",
  );
  return { pendingClaims: Number(rows[0]?.pendingClaims || 0) };
}

type PartUpdateInput = {
  receivedQuantity: number;
  partialReceived?: boolean;
  managementStatus: "POR_GESTIONAR" | "PEDIDO" | "EN_TALLER";
  quality: "ORIGINAL" | "ALTERNATIVO";
  partCode?: string;
  expectedDate?: string;
  providerId?: number | null;
  notes?: string;
};

const partSelect = `SELECT p.id, p.order_id AS orderId, p.description, p.quantity, p.received_quantity AS receivedQuantity, p.partial_received AS partialReceived,
  p.management_status AS managementStatus, p.quality, p.part_code AS partCode, p.expected_date AS expectedDate,
  p.provider_id AS providerId, p.provider_name AS providerName, p.provider_contact AS providerContact,
  p.provider_email AS providerEmail, p.provider_phone AS providerPhone, p.notes, p.updated_at AS updatedAt,
  o.order_number AS orderNumber, v.plate, v.brand, v.model, v.color, o.claim_number AS claimNumber,
  l.freight_requested AS freightRequested
  FROM order_parts p JOIN service_orders o ON o.id = p.order_id JOIN client_vehicles cv ON cv.id = o.client_vehicle_id JOIN vehicles v ON v.id = cv.vehicle_id LEFT JOIN order_parts_logistics l ON l.order_id = p.order_id`;

function mapPart(row: any) {
  const quantity = Number(row.quantity); const receivedQuantity = Number(row.receivedQuantity);
  // Cada fila representa ahora un repuesto operativo individual. Se conserva la
  // columna heredada para compatibilidad, pero la recepción parcial no participa
  // del flujo ni vuelve a exponerse a los clientes.
  return { ...row, quantity, receivedQuantity, partialReceived: false, freightRequested: Boolean(row.freightRequested), fullyReceived: receivedQuantity >= quantity, partiallyReceived: false };
}

export async function listParts(orderId?: number) {
  const rows = await getPool().query<any[]>(`${partSelect}${orderId ? " WHERE p.order_id = ?" : ""} ORDER BY p.expected_date IS NULL, p.expected_date, p.updated_at DESC`, orderId ? [orderId] : []);
  return rows.map(mapPart);
}

export async function listPartProviders(brand?: string, quality?: string) {
  const rows = await getPool().query<any[]>("SELECT id, name, contact_name AS contactName, email, phone, brands, qualities, lead_time_days AS leadTimeDays, freight_available AS freightAvailable, coverage FROM parts_providers WHERE active = 1 ORDER BY name");
  return rows.filter((provider) => {
    const brands = typeof provider.brands === "string" ? JSON.parse(provider.brands) : provider.brands;
    const qualities = typeof provider.qualities === "string" ? JSON.parse(provider.qualities) : provider.qualities;
    return (!brand || brands.includes(brand.toUpperCase())) && (!quality || qualities.includes(quality));
  }).map((provider) => ({ ...provider, brands: typeof provider.brands === "string" ? JSON.parse(provider.brands) : provider.brands, qualities: typeof provider.qualities === "string" ? JSON.parse(provider.qualities) : provider.qualities, freightAvailable: Boolean(provider.freightAvailable) }));
}

export async function updatePart(partId: number, input: PartUpdateInput, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const parts = await connection.query<any[]>(`${partSelect} WHERE p.id = ? FOR UPDATE`, [partId]); const part = parts[0];
    if (!part) throw new AppError(404, "PART_NOT_FOUND", "El repuesto no existe.");
    if (input.receivedQuantity > Number(part.quantity)) throw new AppError(400, "INVALID_RECEIVED_QUANTITY", "La cantidad recibida no puede superar la solicitada.");
    let provider: any;
    if (input.providerId) { provider = (await connection.query<any[]>("SELECT id, name, contact_name AS contactName, email, phone FROM parts_providers WHERE id = ? AND active = 1", [input.providerId]))[0]; if (!provider) throw new AppError(400, "PROVIDER_NOT_FOUND", "El proveedor no existe."); }
    const managementStatus = input.receivedQuantity >= Number(part.quantity) ? "EN_TALLER" : input.managementStatus;
    await connection.query("UPDATE order_parts SET received_quantity = ?, partial_received = ?, management_status = ?, quality = ?, part_code = ?, expected_date = ?, provider_id = ?, provider_name = ?, provider_contact = ?, provider_email = ?, provider_phone = ?, notes = ? WHERE id = ?", [input.receivedQuantity, 0, managementStatus, input.quality, input.partCode || null, input.expectedDate || null, provider?.id || null, provider?.name || null, provider?.contactName || null, provider?.email || null, provider?.phone || null, input.notes || null, partId]);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'order_part', ?, 'PART_UPDATED', JSON_OBJECT('receivedQuantity', ?, 'managementStatus', ?, 'providerId', ?), ?, ?, ?)", [actorUserId, String(partId), input.receivedQuantity, input.managementStatus, provider?.id || null, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false;
    return mapPart((await connection.query<any[]>(`${partSelect} WHERE p.id = ?`, [partId]))[0]);
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function getPartsLogistics(orderId: number) {
  const row = (await getPool().query<any[]>("SELECT freight_requested AS freightRequested, freight_amount AS freightAmount, freight_payment AS freightPayment, expansion_required AS expansionRequired, owner, notes FROM order_parts_logistics WHERE order_id = ?", [orderId]))[0];
  return row ? { ...row, freightRequested: Boolean(row.freightRequested), expansionRequired: Boolean(row.expansionRequired) } : { freightRequested: false, freightAmount: null, freightPayment: "PENDIENTE", expansionRequired: false, owner: "", notes: "" };
}

export async function updatePartsLogistics(orderId: number, input: { freightRequested: boolean; freightAmount?: number | null; freightPayment: "PENDIENTE" | "PARCIAL" | "PAGADO"; expansionRequired: boolean; owner?: string; notes?: string }, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const order = (await connection.query<any[]>("SELECT id FROM service_orders WHERE id = ? FOR UPDATE", [orderId]))[0]; if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
    await connection.query("INSERT INTO order_parts_logistics (order_id, freight_requested, freight_amount, freight_payment, expansion_required, owner, notes) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE freight_requested = VALUES(freight_requested), freight_amount = VALUES(freight_amount), freight_payment = VALUES(freight_payment), expansion_required = VALUES(expansion_required), owner = VALUES(owner), notes = VALUES(notes)", [orderId, input.freightRequested ? 1 : 0, input.freightAmount ?? null, input.freightPayment, input.expansionRequired ? 1 : 0, input.owner || null, input.notes || null]);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'PARTS_LOGISTICS_UPDATED', JSON_OBJECT('freightRequested', ?, 'expansionRequired', ?), ?, ?, ?)", [actorUserId, String(orderId), input.freightRequested, input.expansionRequired, requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false; return getPartsLogistics(orderId);
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function startRepair(orderId: number, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const quotes = await connection.query<any[]>("SELECT id FROM quote_versions WHERE order_id = ? AND status = 'APROBADA' FOR UPDATE", [orderId]);
    if (!quotes[0]) throw new AppError(409, "QUOTE_NOT_APPROVED", "Requiere una cotización aprobada.");
    const pending = await connection.query<any[]>("SELECT id FROM order_parts WHERE order_id = ? AND received_quantity < quantity FOR UPDATE", [orderId]);
    if (pending.length) throw new AppError(409, "PARTS_PENDING", "Aún existen repuestos por recibir.");
    await connection.query("UPDATE service_orders SET internal_status = 'EN_REPARACION', public_status = 'EN_REPARACION' WHERE id = ?", [orderId]);
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'REPAIR_STARTED', ?, ?, ?)", [actorUserId, String(orderId), requestId, ipAddress ?? null, userAgent ?? null]);
    await connection.commit(); failed = false;
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

type FinalControlActionContext = { actorUserId: number; requestId: string; ipAddress?: string; userAgent?: string };

async function auditFinalControl(connection: PoolConnection, orderId: number, action: string, context: FinalControlActionContext, previousData?: string, newData?: string) {
  await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, previous_data, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, ?, ?, ?, ?, ?, ?)", [context.actorUserId, String(orderId), action, previousData || null, newData || null, context.requestId, context.ipAddress ?? null, context.userAgent ?? null]);
}

export async function getFinalControl(orderId: number) {
  const pool = getPool();
  const orders = await pool.query<any[]>("SELECT internal_status AS internalStatus, public_status AS publicStatus FROM service_orders WHERE id = ?", [orderId]);
  if (!orders[0]) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
  const [labor, parts, record] = await Promise.all([
    pool.query<any[]>("SELECT l.id, l.description, l.labor_category AS category, l.quantity, EXISTS(SELECT 1 FROM order_labor_verifications v WHERE v.order_id = q.order_id AND v.quote_line_id = l.id) AS verified FROM quote_versions q JOIN quote_lines l ON l.quote_version_id = q.id WHERE q.order_id = ? AND q.status = 'APROBADA' AND l.line_type = 'MANO_OBRA' ORDER BY l.id", [orderId]),
    pool.query<any[]>("SELECT id, description, quantity, received_quantity AS receivedQuantity FROM order_parts WHERE order_id = ? AND received_quantity < quantity", [orderId]),
    pool.query<any[]>("SELECT completed_at AS completedAt, published_at AS publishedAt, publication_channel AS publicationChannel, publication_note AS publicationNote, delivered_at AS deliveredAt, conformity_acknowledged_at AS conformityAcknowledgedAt FROM order_final_controls WHERE order_id = ?", [orderId]),
  ]);
  return { ...orders[0], labor: labor.map((line) => ({ ...line, verified: Boolean(line.verified) })), pendingParts: parts, record: record[0] || null };
}

export async function setLaborVerification(orderId: number, quoteLineId: number, verified: boolean, context: FinalControlActionContext) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const lines = await connection.query<any[]>("SELECT l.id FROM quote_versions q JOIN quote_lines l ON l.quote_version_id = q.id WHERE q.order_id = ? AND q.status = 'APROBADA' AND l.id = ? AND l.line_type = 'MANO_OBRA' FOR UPDATE", [orderId, quoteLineId]);
    if (!lines[0]) throw new AppError(400, "LABOR_LINE_NOT_APPROVED", "La partida de mano de obra no pertenece a la cotización aprobada.");
    const control = await connection.query<any[]>("SELECT completed_at AS completedAt, delivered_at AS deliveredAt FROM order_final_controls WHERE order_id = ? FOR UPDATE", [orderId]);
    if (control[0]?.deliveredAt) throw new AppError(409, "ORDER_ALREADY_DELIVERED", "No puede modificar el control de una orden entregada.");
    if (control[0]?.completedAt) throw new AppError(409, "FINAL_CONTROL_REOPEN_REQUIRED", "Reabra el control final con un motivo antes de modificar verificaciones.");
    if (verified) await connection.query("INSERT INTO order_labor_verifications (order_id, quote_line_id, verified_by_user_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE verified_at = CURRENT_TIMESTAMP(6), verified_by_user_id = VALUES(verified_by_user_id)", [orderId, quoteLineId, context.actorUserId]);
    else await connection.query("DELETE FROM order_labor_verifications WHERE order_id = ? AND quote_line_id = ?", [orderId, quoteLineId]);
    await auditFinalControl(connection, orderId, verified ? "LABOR_VERIFIED" : "LABOR_VERIFICATION_REMOVED", context, undefined, JSON.stringify({ quoteLineId }));
    await connection.commit(); failed = false;
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function setAllLaborVerifications(orderId: number, verified: boolean, context: FinalControlActionContext) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const labor = await connection.query<any[]>("SELECT l.id FROM quote_versions q JOIN quote_lines l ON l.quote_version_id = q.id WHERE q.order_id = ? AND q.status = 'APROBADA' AND l.line_type = 'MANO_OBRA' FOR UPDATE", [orderId]);
    if (!labor.length) throw new AppError(400, "LABOR_REQUIRED", "La cotización aprobada no tiene mano de obra para verificar.");
    const control = await connection.query<any[]>("SELECT completed_at AS completedAt, delivered_at AS deliveredAt FROM order_final_controls WHERE order_id = ? FOR UPDATE", [orderId]);
    if (control[0]?.deliveredAt) throw new AppError(409, "ORDER_ALREADY_DELIVERED", "No puede modificar el control de una orden entregada.");
    if (control[0]?.completedAt) throw new AppError(409, "FINAL_CONTROL_REOPEN_REQUIRED", "Reabra el control final con un motivo antes de modificar verificaciones.");
    const lineIds = labor.map((line) => Number(line.id));
    if (verified) await connection.query("INSERT INTO order_labor_verifications (order_id, quote_line_id, verified_by_user_id) SELECT ?, l.id, ? FROM quote_lines l WHERE l.id IN (?) ON DUPLICATE KEY UPDATE verified_at = CURRENT_TIMESTAMP(6), verified_by_user_id = VALUES(verified_by_user_id)", [orderId, context.actorUserId, lineIds]);
    else await connection.query("DELETE FROM order_labor_verifications WHERE order_id = ? AND quote_line_id IN (?)", [orderId, lineIds]);
    await auditFinalControl(connection, orderId, verified ? "ALL_LABOR_VERIFIED" : "ALL_LABOR_VERIFICATIONS_REMOVED", context, undefined, JSON.stringify({ quoteLineIds: lineIds }));
    await connection.commit(); failed = false;
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function completeFinalControl(orderId: number, context: FinalControlActionContext) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const order = (await connection.query<any[]>("SELECT internal_status AS internalStatus, public_status AS publicStatus FROM service_orders WHERE id = ? FOR UPDATE", [orderId]))[0];
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
    const quote = (await connection.query<any[]>("SELECT id FROM quote_versions WHERE order_id = ? AND status = 'APROBADA' FOR UPDATE", [orderId]))[0];
    if (!quote) throw new AppError(409, "QUOTE_NOT_APPROVED", "Requiere una cotización aprobada.");
    const pendingParts = await connection.query<any[]>("SELECT id FROM order_parts WHERE order_id = ? AND received_quantity < quantity FOR UPDATE", [orderId]);
    if (pendingParts.length) throw new AppError(409, "PARTS_PENDING", "Aún existen repuestos por recibir.");
    const labor = await connection.query<any[]>("SELECT l.id FROM quote_lines l WHERE l.quote_version_id = ? AND l.line_type = 'MANO_OBRA'", [quote.id]);
    if (!labor.length) throw new AppError(409, "LABOR_REQUIRED", "La cotización aprobada no tiene mano de obra para verificar.");
    const verified = await connection.query<any[]>("SELECT quote_line_id AS quoteLineId FROM order_labor_verifications WHERE order_id = ? FOR UPDATE", [orderId]);
    if (labor.some((line) => !verified.some((item) => Number(item.quoteLineId) === Number(line.id)))) throw new AppError(409, "LABOR_NOT_VERIFIED", "Debe verificar todas las partidas de mano de obra.");
    await connection.query("INSERT INTO order_final_controls (order_id, completed_at, completed_by_user_id) VALUES (?, CURRENT_TIMESTAMP(6), ?) ON DUPLICATE KEY UPDATE completed_at = VALUES(completed_at), completed_by_user_id = VALUES(completed_by_user_id), published_at = NULL, published_by_user_id = NULL, publication_channel = NULL, publication_note = NULL", [orderId, context.actorUserId]);
    await connection.query("UPDATE service_orders SET internal_status = 'LISTA_PARA_ENTREGA', public_status = 'EN_REPARACION' WHERE id = ?", [orderId]);
    await auditFinalControl(connection, orderId, "FINAL_CONTROL_COMPLETED", context, JSON.stringify(order), JSON.stringify({ internalStatus: "LISTA_PARA_ENTREGA", publicStatus: "EN_REPARACION", verifiedLabor: labor.length }));
    await connection.commit(); failed = false;
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function reopenFinalControl(orderId: number, reason: string, context: FinalControlActionContext) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const record = (await connection.query<any[]>("SELECT delivered_at AS deliveredAt FROM order_final_controls WHERE order_id = ? FOR UPDATE", [orderId]))[0];
    if (!record) throw new AppError(409, "FINAL_CONTROL_NOT_COMPLETED", "El control final no está registrado.");
    if (record.deliveredAt) throw new AppError(409, "ORDER_ALREADY_DELIVERED", "No puede reabrir una orden entregada.");
    await connection.query("UPDATE order_final_controls SET completed_at = NULL, completed_by_user_id = NULL, published_at = NULL, published_by_user_id = NULL, publication_channel = NULL, publication_note = NULL WHERE order_id = ?", [orderId]);
    await connection.query("UPDATE service_orders SET internal_status = 'EN_REPARACION', public_status = 'EN_REPARACION' WHERE id = ?", [orderId]);
    await auditFinalControl(connection, orderId, "FINAL_CONTROL_REOPENED", context, undefined, JSON.stringify({ reason }));
    await connection.commit(); failed = false;
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function publishReadyForPickup(orderId: number, input: { channel?: string; note?: string }, context: FinalControlActionContext) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const order = (await connection.query<any[]>("SELECT internal_status AS internalStatus, public_status AS publicStatus FROM service_orders WHERE id = ? FOR UPDATE", [orderId]))[0];
    const control = (await connection.query<any[]>("SELECT completed_at AS completedAt, delivered_at AS deliveredAt FROM order_final_controls WHERE order_id = ? FOR UPDATE", [orderId]))[0];
    if (!order || !control?.completedAt || order.internalStatus !== "LISTA_PARA_ENTREGA") throw new AppError(409, "ORDER_NOT_READY", "La orden debe completar el control final antes de publicarse.");
    if (control.deliveredAt) throw new AppError(409, "ORDER_ALREADY_DELIVERED", "La orden ya fue entregada.");
    await connection.query("UPDATE order_final_controls SET published_at = CURRENT_TIMESTAMP(6), published_by_user_id = ?, publication_channel = ?, publication_note = ? WHERE order_id = ?", [context.actorUserId, input.channel || null, input.note || null, orderId]);
    await connection.query("UPDATE service_orders SET public_status = 'LISTA_PARA_ENTREGA' WHERE id = ?", [orderId]);
    await auditFinalControl(connection, orderId, "READY_FOR_PICKUP_PUBLISHED", context, JSON.stringify({ publicStatus: order.publicStatus }), JSON.stringify({ publicStatus: "LISTA_PARA_ENTREGA", ...input }));
    await connection.commit(); failed = false;
  } finally { if (failed) await connection.rollback(); connection.release(); }
}

export async function deliverOrder(orderId: number, context: FinalControlActionContext) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const order = (await connection.query<any[]>("SELECT internal_status AS internalStatus, public_status AS publicStatus FROM service_orders WHERE id = ? FOR UPDATE", [orderId]))[0];
    const control = (await connection.query<any[]>("SELECT delivered_at AS deliveredAt FROM order_final_controls WHERE order_id = ? FOR UPDATE", [orderId]))[0];
    if (!order || order.internalStatus !== "LISTA_PARA_ENTREGA" || order.publicStatus !== "LISTA_PARA_ENTREGA") throw new AppError(409, "ORDER_NOT_PUBLISHED", "La orden debe estar lista para entrega y publicada.");
    if (control?.deliveredAt) throw new AppError(409, "ORDER_ALREADY_DELIVERED", "La orden ya fue entregada.");
    await connection.query("UPDATE order_final_controls SET delivered_at = CURRENT_TIMESTAMP(6), delivered_by_user_id = ?, conformity_acknowledged_at = CURRENT_TIMESTAMP(6) WHERE order_id = ?", [context.actorUserId, orderId]);
    await connection.query("UPDATE service_orders SET internal_status = 'ENTREGADA', public_status = 'ENTREGADA' WHERE id = ?", [orderId]);
    await auditFinalControl(connection, orderId, "ORDER_DELIVERED", context, JSON.stringify(order), JSON.stringify({ internalStatus: "ENTREGADA", publicStatus: "ENTREGADA", conformityAcknowledged: true }));
    await connection.commit(); failed = false;
  } finally { if (failed) await connection.rollback(); connection.release(); }
}
