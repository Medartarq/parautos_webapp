import type { PoolConnection } from "mariadb";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";

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
