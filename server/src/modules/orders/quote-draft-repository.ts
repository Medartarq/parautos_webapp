import { releaseConnection } from "../../db/release-connection.js";
import { getPool } from "../../db/pool.js";

export type QuoteDraftLine = { type: "MANO_OBRA" | "REPUESTO"; category?: "PLANCHADO" | "PINTURA" | "MECANICA"; description: string; quantity: number; unitPrice: number };
export type QuoteDraftInput = { currency: "PEN" | "USD"; noParts: boolean; lines: QuoteDraftLine[] };

export interface QuoteDraftRepository {
  findDraft(orderId: number): Promise<any | undefined>;
  findLines(draftId: number): Promise<any[]>;
  save(orderId: number, input: QuoteDraftInput, actorUserId: number, requestId: string, ipAddress?: string, userAgent?: string): Promise<boolean>;
}

/** MariaDB adapter; getPool resolves the request's production/demo scope. */
export const mariaDbQuoteDraftRepository: QuoteDraftRepository = {
  async findDraft(orderId) {
    return (await getPool().query<any[]>("SELECT id, currency, no_parts AS noParts, updated_at AS updatedAt FROM quote_drafts WHERE order_id = ?", [orderId]))[0];
  },
  findLines(draftId) {
    return getPool().query<any[]>("SELECT line_type AS type, labor_category AS category, description, quantity, unit_price AS unitPrice FROM quote_draft_lines WHERE quote_draft_id = ? ORDER BY id", [draftId]);
  },
  async save(orderId, input, actorUserId, requestId, ipAddress, userAgent) {
    const connection = await getPool().getConnection(); let failed = true;
    try {
      await connection.beginTransaction();
      const order = (await connection.query<any[]>("SELECT id FROM service_orders WHERE id = ? FOR UPDATE", [orderId]))[0];
      if (!order) return false;
      let draft = (await connection.query<any[]>("SELECT id FROM quote_drafts WHERE order_id = ? FOR UPDATE", [orderId]))[0];
      if (!draft) { const result = await connection.query<any>("INSERT INTO quote_drafts (order_id, currency, no_parts, updated_by_user_id) VALUES (?, ?, ?, ?)", [orderId, input.currency, input.noParts ? 1 : 0, actorUserId]); draft = { id: Number(result.insertId) }; }
      else await connection.query("UPDATE quote_drafts SET currency = ?, no_parts = ?, updated_by_user_id = ? WHERE id = ?", [input.currency, input.noParts ? 1 : 0, actorUserId, draft.id]);
      await connection.query("DELETE FROM quote_draft_lines WHERE quote_draft_id = ?", [draft.id]);
      for (const line of input.lines) await connection.query("INSERT INTO quote_draft_lines (quote_draft_id, line_type, labor_category, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)", [draft.id, line.type, line.category || null, line.description, line.quantity, line.unitPrice]);
      await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'QUOTE_DRAFT_SAVED', JSON_OBJECT('lineCount', ?, 'currency', ?), ?, ?, ?)", [actorUserId, String(orderId), input.lines.length, input.currency, requestId, ipAddress ?? null, userAgent ?? null]);
      await connection.commit(); failed = false; return true;
    } finally { try { if (failed) await connection.rollback(); } finally { await releaseConnection(connection); } }
  },
};
