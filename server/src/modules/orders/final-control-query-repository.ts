import { getPool } from "../../db/pool.js";

export interface FinalControlQueryRepository {
  findOrder(orderId: number): Promise<any | undefined>;
  listLabor(orderId: number): Promise<any[]>;
  listPendingParts(orderId: number): Promise<any[]>;
  findRecord(orderId: number): Promise<any | undefined>;
}

/** Resolves the active production/demo pool when each read runs. */
export const mariaDbFinalControlQueryRepository: FinalControlQueryRepository = {
  async findOrder(orderId) { return (await getPool().query<any[]>("SELECT internal_status AS internalStatus, public_status AS publicStatus FROM service_orders WHERE id = ?", [orderId]))[0]; },
  listLabor: (orderId) => getPool().query<any[]>("SELECT l.id, l.description, l.labor_category AS category, l.quantity, EXISTS(SELECT 1 FROM order_labor_verifications v WHERE v.order_id = q.order_id AND v.quote_line_id = l.id) AS verified FROM quote_versions q JOIN quote_lines l ON l.quote_version_id = q.id WHERE q.order_id = ? AND q.status = 'APROBADA' AND l.line_type = 'MANO_OBRA' ORDER BY l.id", [orderId]),
  listPendingParts: (orderId) => getPool().query<any[]>("SELECT id, description, quantity, received_quantity AS receivedQuantity FROM order_parts WHERE order_id = ? AND received_quantity < quantity", [orderId]),
  async findRecord(orderId) { return (await getPool().query<any[]>("SELECT completed_at AS completedAt, published_at AS publishedAt, publication_channel AS publicationChannel, publication_note AS publicationNote, delivered_at AS deliveredAt, conformity_acknowledged_at AS conformityAcknowledgedAt FROM order_final_controls WHERE order_id = ?", [orderId]))[0]; },
};
