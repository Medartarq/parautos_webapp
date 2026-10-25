import { releaseConnection } from "../../db/release-connection.js";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";

export interface QuoteTransitionRepository { transition(orderId: number, quoteId: number, action: "SEND" | "APPROVE", actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string): Promise<{ status: string; totalWithoutIgv: number }>; }
export const mariaDbQuoteTransitionRepository: QuoteTransitionRepository = {
  async transition(orderId, quoteId, action, actorUserId, requestId, ipAddress, userAgent) {
    const connection = await getPool().getConnection(); let failed = true;
    try {
      await connection.beginTransaction();
      const quotes = await connection.query<any[]>("SELECT q.id, q.status, q.currency, q.no_parts AS noParts, q.version_number AS versionNumber, o.internal_status AS internalStatus FROM quote_versions q JOIN service_orders o ON o.id = q.order_id WHERE q.id = ? AND q.order_id = ? FOR UPDATE", [quoteId, orderId]); const quote = quotes[0];
      if (!quote) throw new AppError(404, "QUOTE_NOT_FOUND", "La cotización no existe.");
      if (["ENTREGADA", "CANCELADA"].includes(quote.internalStatus)) throw new AppError(409, "ORDER_TERMINAL", "No puede modificar cotizaciones de una orden cerrada.");
      if ((action === "SEND" && quote.status !== "PENDIENTE") || (action === "APPROVE" && quote.status !== "ENVIADA")) throw new AppError(409, "INVALID_QUOTE_TRANSITION", "La cotización no está en el estado requerido.");
      const lines = await connection.query<any[]>("SELECT id, line_type AS type, labor_category AS category, description, quantity, unit_price AS unitPrice FROM quote_lines WHERE quote_version_id = ?", [quoteId]);
      if (!lines.length) throw new AppError(400, "QUOTE_EMPTY", "La cotización debe tener al menos una línea.");
      const totalWithoutIgv = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0);
      const snapshot = JSON.stringify({ versionNumber: quote.versionNumber, currency: quote.currency, noParts: Boolean(quote.noParts), lines, totalWithoutIgv, igv: 0 }); const hasParts = lines.some((line) => line.type === "REPUESTO"); const nextStatus = action === "SEND" ? "ESPERA_APROBACION" : hasParts ? "ESPERA_REPUESTOS" : "EN_REPARACION";
      await connection.query(action === "SEND" ? "UPDATE quote_versions SET status = 'ENVIADA', sent_at = CURRENT_TIMESTAMP(6), sent_snapshot = ? WHERE id = ?" : "UPDATE quote_versions SET status = 'APROBADA', approved_at = CURRENT_TIMESTAMP(6), approved_snapshot = ? WHERE id = ?", [snapshot, quoteId]);
      if (action === "APPROVE") for (const line of lines.filter((line) => line.type === "REPUESTO")) await connection.query("INSERT INTO order_parts (order_id, quote_line_id, description, quantity) VALUES (?, ?, ?, ?)", [orderId, line.id, line.description, line.quantity]);
      await connection.query("UPDATE service_orders SET internal_status = ?, public_status = ? WHERE id = ?", [nextStatus, nextStatus, orderId]);
      const event = action === "SEND" ? "QUOTE_SENT" : "QUOTE_APPROVED";
      await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, ?, JSON_OBJECT('quoteId', ?, 'nextStatus', ?), ?, ?, ?)", [actorUserId, String(orderId), event, quoteId, nextStatus, requestId, ipAddress ?? null, userAgent ?? null]);
      await connection.commit(); failed = false; return { status: nextStatus, totalWithoutIgv };
    } finally { try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); } }
  },
};
