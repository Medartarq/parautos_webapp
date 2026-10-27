import { releaseConnection } from "../../db/release-connection.js";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";
import type { AuditWriter } from "../audit/audit-writer.js";
import type { FinalControlContext } from "./labor-verification-repository.js";

export interface FinalControlReopenRepository { reopen(orderId: number, reason: string, context: FinalControlContext, audit: AuditWriter): Promise<void>; }
export const mariaDbFinalControlReopenRepository: FinalControlReopenRepository = {
  async reopen(orderId, reason, context, audit) {
    const connection = await getPool().getConnection(); let failed = true;
    try {
      await connection.beginTransaction();
      const record = (await connection.query<any[]>("SELECT delivered_at AS deliveredAt FROM order_final_controls WHERE order_id = ? FOR UPDATE", [orderId]))[0];
      if (!record) throw new AppError(409, "FINAL_CONTROL_NOT_COMPLETED", "El control final no está registrado.");
      if (record.deliveredAt) throw new AppError(409, "ORDER_ALREADY_DELIVERED", "No puede reabrir una orden entregada.");
      await connection.query("UPDATE order_final_controls SET completed_at = NULL, completed_by_user_id = NULL, published_at = NULL, published_by_user_id = NULL, publication_channel = NULL, publication_note = NULL WHERE order_id = ?", [orderId]);
      await connection.query("UPDATE service_orders SET internal_status = 'EN_REPARACION', public_status = 'EN_REPARACION' WHERE id = ?", [orderId]);
      await audit.append(connection, { actorUserId: context.actorUserId, entity: "service_order", recordId: String(orderId), action: "FINAL_CONTROL_REOPENED", requestId: context.requestId, ipAddress: context.ipAddress, userAgent: context.userAgent, newData: JSON.stringify({ reason }) });
      await connection.commit(); failed = false;
    } finally { try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); } }
  },
};
