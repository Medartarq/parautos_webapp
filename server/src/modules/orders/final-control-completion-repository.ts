import { releaseConnection } from "../../db/release-connection.js";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";
import type { AuditWriter } from "../audit/audit-writer.js";
import type { FinalControlContext } from "./labor-verification-repository.js";

export interface FinalControlCompletionRepository { complete(orderId: number, context: FinalControlContext, audit: AuditWriter): Promise<void>; }
export const mariaDbFinalControlCompletionRepository: FinalControlCompletionRepository = {
  async complete(orderId, context, audit) {
    const connection = await getPool().getConnection(); let failed = true;
    try {
      await connection.beginTransaction();
      const order = (await connection.query<any[]>("SELECT internal_status AS internalStatus, public_status AS publicStatus FROM service_orders WHERE id = ? FOR UPDATE", [orderId]))[0];
      if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
      if (["ENTREGADA", "CANCELADA"].includes(order.internalStatus))
        throw new AppError(409, "ORDER_TERMINAL", "No puede completar el control de una orden cerrada.");
      if (order.internalStatus === "LISTA_PARA_ENTREGA")
        throw new AppError(409, "FINAL_CONTROL_REOPEN_REQUIRED", "Reabra el control final con un motivo antes de completarlo de nuevo.");
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
      await audit.append(connection, { actorUserId: context.actorUserId, entity: "service_order", recordId: String(orderId), action: "FINAL_CONTROL_COMPLETED", requestId: context.requestId, ipAddress: context.ipAddress, userAgent: context.userAgent, previousData: JSON.stringify(order), newData: JSON.stringify({ internalStatus: "LISTA_PARA_ENTREGA", publicStatus: "EN_REPARACION", verifiedLabor: labor.length }) });
      await connection.commit(); failed = false;
    } finally { try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); } }
  },
};
