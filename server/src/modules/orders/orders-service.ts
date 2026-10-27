import { releaseConnection } from "../../db/release-connection.js";
import { randomInt } from "node:crypto";
import { captureReceptionSnapshot } from "./reception-snapshot.js";
import {
  receptionStepOneSchema,
  type CreateOrderInput,
  type OperationalDataInput,
} from "@parautos/shared";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";
import { deleteStoredFile, storeSignature } from "../attachments/storage.js";
import { mariaDbOrdersListRepository, type OrdersListRepository } from "./orders-list-repository.js";
import { mariaDbOrderDetailRepository, type OrderDetailRepository } from "./order-detail-repository.js";
import { mariaDbOrdersNavigationRepository, type OrdersNavigationRepository } from "./orders-navigation-repository.js";
import { mariaDbReceptionDraftRepository, type ReceptionDraftInput, type ReceptionDraftRepository } from "./reception-draft-repository.js";
import { mariaDbPendingClaimRepository, type PendingClaimRepository } from "./pending-claim-repository.js";

export function generatePublicCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function getReceptionCatalog(repository: OrdersListRepository = mariaDbOrdersListRepository) {
  const bodyTypes = await repository.listBodyTypes();
  const checklist = await repository.listChecklist();
  return { bodyTypes, checklist };
}

function insertedId(
  result: { insertId?: number | bigint },
  entity: "cliente" | "vehículo" | "vínculo cliente-vehículo",
): number {
  const id = Number(result.insertId);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new AppError(
      500,
      "PERSISTENCE_ERROR",
      `No fue posible recuperar el ${entity} creado.`,
    );
  return id;
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
  const activeChecklist = await pool.query<{ id: number }[]>(
    "SELECT id FROM checklist_items WHERE active = 1 ORDER BY id",
  );
  const expected = new Set(activeChecklist.map((item) => Number(item.id)));
  const received = new Set(input.checklist.map((item) => item.itemId));
  if (
    input.checklist.length !== expected.size ||
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
    const client = await connection.query<{ insertId: number }>(
      `INSERT INTO clients (document_type, document_number, full_name, phone, email) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), full_name = VALUES(full_name), phone = VALUES(phone), email = VALUES(email)`,
      [
        input.client.documentType,
        input.client.documentNumber,
        input.client.fullName,
        input.client.phone || null,
        input.client.email || null,
      ],
    );
    const clientId = insertedId(client, "cliente");
    const plate = normalizePlate(input.vehicle.plate);
    const vehicle = await connection.query<{ insertId: number }>(
      `INSERT INTO vehicles (plate, brand, model, manufacture_year, vin, color, color_type, body_type_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), brand = VALUES(brand), model = VALUES(model), manufacture_year = VALUES(manufacture_year), vin = VALUES(vin), color = VALUES(color), color_type = VALUES(color_type), body_type_id = VALUES(body_type_id)`,
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
    const vehicleId = insertedId(vehicle, "vehículo");
    const clientVehicle = await connection.query<{ insertId: number }>(
      "INSERT INTO client_vehicles (client_id, vehicle_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)",
      [clientId, vehicleId],
    );
    const clientVehicleId = insertedId(clientVehicle, "vínculo cliente-vehículo");
    // The vehicle upsert holds its row lock. Include closed orders too because
    // public tracking still accepts their plate/code pair after delivery.
    let publicCode = "";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = generatePublicCode();
      const matchingOrders = await connection.query<{ id: number }[]>(
        `SELECT o.id FROM service_orders o
         JOIN client_vehicles cv ON cv.id = o.client_vehicle_id
         WHERE cv.vehicle_id = ? AND o.public_code = ?
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
    await captureReceptionSnapshot(connection, receptionId, orderId);
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
    try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); }
    if (failed && storedSignature) await deleteStoredFile(storedSignature.provider, storedSignature.objectKey);
  }
}

export async function listOrders(repository: OrdersListRepository = mariaDbOrdersListRepository) {
  return repository.listOrders();
}

export async function getOperationalPendingNotifications(repository: OrdersNavigationRepository = mariaDbOrdersNavigationRepository) {
  const [diagnosisPending, quotePending] = await repository.pendingNotifications();
  return { total: diagnosisPending.length + quotePending.length, diagnosisPending, quotePending };
}

export async function getOrderDetail(orderId: number, repository: OrderDetailRepository = mariaDbOrderDetailRepository) {

  const order = await repository.findOrder(orderId);
  if (!order) return null;
  order.claimPending = Boolean(order.claimPending);
  order.diagnosisPending = Boolean(order.diagnosisPending);

  const reception = await repository.findReception(orderId);
  if (!reception) return { ...order, reception: null, checklist: [], damages: [], attachments: [] };

  const [[checklist, damages, attachments, history], snapshot] = await Promise.all([
    repository.findDetails(reception.id, orderId), repository.findSnapshot(reception.id),
  ]);
  const receptionSnapshot = snapshot ? { ...snapshot, payload: typeof snapshot.payload === "string" ? JSON.parse(snapshot.payload) : snapshot.payload } : null;
  return { ...order, year: order.year == null ? undefined : Number(order.year), reception, checklist, damages, attachments, history, receptionSnapshot };
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
      modality: order.modality,
      phoneOverride: order.phoneOverride || undefined,
      emailOverride: order.emailOverride || undefined,
      claimNumber: order.claimNumber || undefined,
      claimPendingReminder: Boolean(order.claimPending),
    };
    const newData = {
      modality: input.modality ?? order.modality,
      phoneOverride: input.phoneOverride,
      emailOverride: input.emailOverride,
      claimNumber: input.claimNumber,
      claimPendingReminder: input.claimPendingReminder,
    };
    if (newData.modality === "PARTICULAR" && order.modality !== "PARTICULAR" && (newData.claimNumber || newData.claimPendingReminder))
      throw new AppError(400, "CLAIM_NOT_ALLOWED", "Las órdenes particulares no pueden registrar siniestro.");
    if (newData.modality !== "PARTICULAR" && Boolean(newData.claimNumber) === newData.claimPendingReminder)
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
      "UPDATE service_orders SET modality = ?, claim_number = ?, claim_pending_reminder = ? WHERE id = ?",
      [newData.modality, newData.claimNumber || null, newData.claimPendingReminder ? 1 : 0, orderId],
    );
    await connection.query(
      `INSERT INTO audit_events (actor_user_id, entity, record_id, action, previous_data, new_data, request_id, ip_address, user_agent)
       VALUES (?, 'service_order', ?, 'OPERATIONAL_DATA_CORRECTED', ?, ?, ?, ?, ?)`,
      [actorUserId, String(orderId), JSON.stringify(oldData), JSON.stringify({ ...newData, reason: input.reason }), requestId, ipAddress ?? null, userAgent ?? null],
    );
    await connection.commit();
    failed = false;
  } finally {
    try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); }
  }
}

export async function completePendingClaim(
  orderId: number,
  claimNumber: string,
  actorUserId: number,
  requestId: string,
  ipAddress?: string,
  userAgent?: string, repository: PendingClaimRepository = mariaDbPendingClaimRepository,
) {
  return repository.complete(orderId,claimNumber,actorUserId,requestId,ipAddress,userAgent);
}

export async function getReceptionDraft(userId: number, repository: ReceptionDraftRepository = mariaDbReceptionDraftRepository) {
  const row = await repository.find(userId);
  if (!row) return undefined;
  return { ...row, payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload };
}

export async function saveReceptionDraft(userId: number, input: ReceptionDraftInput, repository: ReceptionDraftRepository = mariaDbReceptionDraftRepository) {
  await repository.save(userId,input); return getReceptionDraft(userId,repository);
}

export async function deleteReceptionDraft(userId: number, repository: ReceptionDraftRepository = mariaDbReceptionDraftRepository) {
  await repository.delete(userId);
}

export async function getNavigationSummary(repository: OrdersNavigationRepository = mariaDbOrdersNavigationRepository) {
  const rows = await repository.pendingClaims();
  return { pendingClaims: Number(rows[0]?.pendingClaims || 0) };
}
