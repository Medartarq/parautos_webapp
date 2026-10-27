import { releaseConnection } from "../../db/release-connection.js";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";

export type QuoteLine = { type: "MANO_OBRA" | "REPUESTO"; category?: "PLANCHADO" | "PINTURA" | "MECANICA"; description: string; quantity: number; unitPrice: number };
export type QuoteCreationInput = { currency: "PEN" | "USD"; noParts: boolean; adjustmentReason?: string; lines: QuoteLine[] };

export interface QuoteCreationRepository {
  create(orderId: number, input: QuoteCreationInput, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string): Promise<{ id: number; versionNumber: number; totalWithoutIgv: number; igv: number }>;
}

/** MariaDB transaction adapter; getPool keeps the request production/demo scope. */
export const mariaDbQuoteCreationRepository: QuoteCreationRepository = {
  async create(orderId, input, actorUserId, requestId, ipAddress, userAgent) {
    const connection = await getPool().getConnection();
    let failed = true;
    try {
      await connection.beginTransaction();
      const orders = await connection.query<any[]>("SELECT id, internal_status AS internalStatus FROM service_orders WHERE id = ? FOR UPDATE", [orderId]);
      if (!orders[0]) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
      if (["ENTREGADA", "CANCELADA"].includes(orders[0].internalStatus)) throw new AppError(409, "ORDER_TERMINAL", "No puede crear cotizaciones de una orden cerrada.");
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
    } finally { try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); } }
  },
};
