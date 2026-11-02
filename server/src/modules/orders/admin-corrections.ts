import { getPool } from "../../db/pool.js";
import { releaseConnection } from "../../db/release-connection.js";
import { AppError } from "../../errors/app-error.js";

type Context = { actorUserId: number; requestId: string; ipAddress?: string; userAgent?: string };

async function audit(connection: any, orderId: number, action: string, previous: unknown, next: unknown, reason: string, context: Context) {
  await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, previous_data, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, ?, ?, ?, ?, ?, ?)", [context.actorUserId, String(orderId), action, JSON.stringify(previous), JSON.stringify({ ...next as object, reason }), context.requestId, context.ipAddress ?? null, context.userAgent ?? null]);
}

export async function cancelOrderAsSuperadmin(orderId: number, reason: string, context: Context) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const order = (await connection.query<any[]>("SELECT internal_status AS internalStatus, public_status AS publicStatus FROM service_orders WHERE id = ? FOR UPDATE", [orderId]))[0];
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
    if (["ENTREGADA", "CANCELADA"].includes(order.internalStatus)) throw new AppError(409, "ORDER_CANNOT_BE_ARCHIVED", "La orden entregada o ya cancelada no puede archivarse.");
    await connection.query("UPDATE service_orders SET internal_status = 'CANCELADA', public_status = 'CANCELADA' WHERE id = ?", [orderId]);
    await audit(connection, orderId, "SUPERADMIN_ORDER_ARCHIVED", order, { internalStatus: "CANCELADA", publicStatus: "CANCELADA" }, reason, context);
    await connection.commit(); failed = false;
  } finally { try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); } }
}

export async function revertOrderToPendingAsSuperadmin(orderId: number, reason: string, context: Context) {
  const connection = await getPool().getConnection(); let failed = true;
  try {
    await connection.beginTransaction();
    const order = (await connection.query<any[]>("SELECT internal_status AS internalStatus, public_status AS publicStatus FROM service_orders WHERE id = ? FOR UPDATE", [orderId]))[0];
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
    if (["ENTREGADA", "CANCELADA", "COTIZACION_PENDIENTE"].includes(order.internalStatus)) throw new AppError(409, "ORDER_CANNOT_BE_REVERTED", "La orden no puede volver a cotización pendiente.");
    const received = await connection.query<any[]>("SELECT id FROM order_parts WHERE order_id = ? AND received_quantity > 0 FOR UPDATE", [orderId]);
    const control = await connection.query<any[]>("SELECT order_id AS orderId FROM order_final_controls WHERE order_id = ? AND (completed_at IS NOT NULL OR delivered_at IS NOT NULL) FOR UPDATE", [orderId]);
    if (received[0] || control[0]) throw new AppError(409, "ORDER_HAS_IRREVERSIBLE_ACTIVITY", "No puede revertir: existen repuestos recibidos o control final.");
    const quotes = await connection.query<any[]>("SELECT id, status FROM quote_versions WHERE order_id = ? AND status IN ('ENVIADA','APROBADA') FOR UPDATE", [orderId]);
    await connection.query("DELETE FROM order_parts WHERE order_id = ?", [orderId]);
    await connection.query("DELETE FROM order_parts_logistics WHERE order_id = ?", [orderId]);
    await connection.query("UPDATE quote_versions SET status = 'PENDIENTE', sent_at = NULL, sent_snapshot = NULL, approved_at = NULL, approved_snapshot = NULL WHERE order_id = ? AND status IN ('ENVIADA','APROBADA')", [orderId]);
    await connection.query("INSERT IGNORE INTO order_status_transitions (from_status, to_status) VALUES ('EN_REPARACION', 'COTIZACION_PENDIENTE'), ('ESPERA_REPUESTOS', 'COTIZACION_PENDIENTE'), ('ESPERA_APROBACION', 'COTIZACION_PENDIENTE'), ('LISTA_PARA_ENTREGA', 'COTIZACION_PENDIENTE')");
    await connection.query("UPDATE service_orders SET internal_status = 'COTIZACION_PENDIENTE', public_status = 'COTIZACION_PENDIENTE' WHERE id = ?", [orderId]);
    await connection.query("DELETE FROM order_status_transitions WHERE to_status = 'COTIZACION_PENDIENTE' AND from_status IN ('EN_REPARACION','ESPERA_REPUESTOS','ESPERA_APROBACION','LISTA_PARA_ENTREGA')");
    await audit(connection, orderId, "SUPERADMIN_QUOTE_REVERTED", { ...order, quotes }, { internalStatus: "COTIZACION_PENDIENTE", publicStatus: "COTIZACION_PENDIENTE" }, reason, context);
    await connection.commit(); failed = false;
  } finally { try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); } }
}
