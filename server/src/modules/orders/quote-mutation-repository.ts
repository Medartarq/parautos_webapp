import { releaseConnection } from "../../db/release-connection.js";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";
import type { QuoteCreationInput } from "./quote-creation-repository.js";

export interface QuoteMutationRepository {
  update(orderId: number, quoteId: number, input: Pick<QuoteCreationInput, "currency" | "noParts" | "lines">, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string): Promise<{ id: number; versionNumber: number; totalWithoutIgv: number; igv: number }>;
  delete(orderId: number, quoteId: number, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string): Promise<void>;
}

export const mariaDbQuoteMutationRepository: QuoteMutationRepository = {
  async update(orderId, quoteId, input, actorUserId, requestId, ipAddress, userAgent) {
    const connection = await getPool().getConnection(); let failed = true;
    try {
      await connection.beginTransaction();
      const quotes = await connection.query<any[]>("SELECT q.id, q.version_number AS versionNumber, q.status, o.internal_status AS internalStatus FROM quote_versions q JOIN service_orders o ON o.id = q.order_id WHERE q.id = ? AND q.order_id = ? FOR UPDATE", [quoteId, orderId]); const quote = quotes[0];
      if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "La cotización no existe.");
      if (["ENTREGADA", "CANCELADA"].includes(quote.internalStatus)) throw new AppError(409, "ORDER_TERMINAL", "No puede modificar cotizaciones de una orden cerrada.");
      if (quote.status !== "PENDIENTE") throw new AppError(409, "QUOTE_NOT_EDITABLE", "Solo puede editar una cotización pendiente.");
      await connection.query("UPDATE quote_versions SET currency = ?, no_parts = ? WHERE id = ?", [input.currency, input.noParts ? 1 : 0, quoteId]);
      await connection.query("DELETE FROM quote_lines WHERE quote_version_id = ?", [quoteId]);
      for (const line of input.lines) await connection.query("INSERT INTO quote_lines (quote_version_id, line_type, labor_category, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)", [quoteId, line.type, line.category || null, line.description, line.quantity, line.unitPrice]);
      const total = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
      await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'QUOTE_UPDATED', JSON_OBJECT('quoteId', ?, 'quoteVersion', ?, 'totalWithoutIgv', ?), ?, ?, ?)", [actorUserId, String(orderId), quoteId, quote.versionNumber, total, requestId, ipAddress ?? null, userAgent ?? null]);
      await connection.commit(); failed = false; return { id: quoteId, versionNumber: quote.versionNumber, totalWithoutIgv: total, igv: 0 };
    } finally { try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); } }
  },
  async delete(orderId, quoteId, actorUserId, requestId, ipAddress, userAgent) {
    const connection = await getPool().getConnection(); let failed = true;
    try {
      await connection.beginTransaction();
      const quotes = await connection.query<any[]>("SELECT q.id, q.version_number AS versionNumber, q.status, q.currency, o.internal_status AS internalStatus FROM quote_versions q JOIN service_orders o ON o.id = q.order_id WHERE q.id = ? AND q.order_id = ? FOR UPDATE", [quoteId, orderId]); const quote = quotes[0];
      if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "La cotización no existe.");
      if (["ENTREGADA", "CANCELADA"].includes(quote.internalStatus)) throw new AppError(409, "ORDER_TERMINAL", "No puede modificar cotizaciones de una orden cerrada.");
      if (quote.status !== "PENDIENTE") throw new AppError(409, "QUOTE_CANNOT_BE_DELETED", "Solo puede eliminar una cotización pendiente.");
      const lines = await connection.query<any[]>("SELECT id, line_type AS type, labor_category AS category, description, quantity, unit_price AS unitPrice FROM quote_lines WHERE quote_version_id = ?", [quoteId]);
      const previous = await connection.query<any[]>("SELECT id, sent_at AS sentAt FROM quote_versions WHERE order_id = ? AND version_number < ? ORDER BY version_number DESC LIMIT 1 FOR UPDATE", [orderId, quote.versionNumber]);
      await connection.query("DELETE FROM quote_lines WHERE quote_version_id = ?", [quoteId]); await connection.query("DELETE FROM quote_versions WHERE id = ?", [quoteId]);
      if (previous[0]) { const restoredStatus = previous[0].sentAt ? "ENVIADA" : "PENDIENTE"; const restoredOrderStatus = previous[0].sentAt ? "ESPERA_APROBACION" : "COTIZACION_PENDIENTE"; await connection.query("UPDATE quote_versions SET status = ? WHERE id = ?", [restoredStatus, previous[0].id]); await connection.query("UPDATE service_orders SET internal_status = ?, public_status = ? WHERE id = ?", [restoredOrderStatus, restoredOrderStatus, orderId]); }
      else await connection.query("UPDATE service_orders SET internal_status = 'COTIZACION_PENDIENTE', public_status = 'COTIZACION_PENDIENTE' WHERE id = ?", [orderId]);
      await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, previous_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'QUOTE_DELETED', JSON_OBJECT('quoteId', ?, 'quoteVersion', ?, 'currency', ?, 'lines', ?), ?, ?, ?)", [actorUserId, String(orderId), quoteId, quote.versionNumber, quote.currency, JSON.stringify(lines), requestId, ipAddress ?? null, userAgent ?? null]);
      await connection.commit(); failed = false;
    } finally { try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); } }
  },
};
