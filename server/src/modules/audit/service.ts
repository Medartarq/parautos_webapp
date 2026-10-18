import { getPool } from "../../db/pool.js";

export type AuditFilters = { text?: string; userId?: number; action?: string; from?: string; to?: string };
type AuditEventRow = { id: number; entity: string; recordId: string; action: string; previousData: string | null; newData: string | null; requestId: string | null; ipAddress: string | null; userAgent: string | null; createdAt: Date; actorUserId: number | null; actorName: string | null; orderNumber: string | null };
type AuditActionRow = { action: string };
type AuditUserRow = { id: number; names: string };

export async function listAuditEvents(filters: AuditFilters) {
  const clauses = ["1 = 1"];
  const values: unknown[] = [];
  if (filters.text) { clauses.push("(ae.action LIKE ? OR ae.entity LIKE ? OR ae.record_id LIKE ? OR u.names LIKE ?)"); const text = `%${filters.text}%`; values.push(text, text, text, text); }
  if (filters.userId) { clauses.push("ae.actor_user_id = ?"); values.push(filters.userId); }
  if (filters.action) { clauses.push("ae.action = ?"); values.push(filters.action); }
  if (filters.from) { clauses.push("ae.created_at >= ?"); values.push(`${filters.from} 00:00:00`); }
  if (filters.to) { clauses.push("ae.created_at < DATE_ADD(?, INTERVAL 1 DAY)"); values.push(filters.to); }
  const pool = getPool();
  const [events, actions, users] = await Promise.all([
    pool.query<AuditEventRow[]>(`SELECT ae.id, ae.entity, ae.record_id AS recordId, ae.action, ae.previous_data AS previousData, ae.new_data AS newData, ae.request_id AS requestId, ae.ip_address AS ipAddress, ae.user_agent AS userAgent, ae.created_at AS createdAt, u.id AS actorUserId, u.names AS actorName, o.order_number AS orderNumber FROM audit_events ae LEFT JOIN users u ON u.id = ae.actor_user_id LEFT JOIN service_orders o ON ae.entity = 'service_order' AND ae.record_id = CAST(o.id AS CHAR) WHERE ${clauses.join(" AND ")} ORDER BY ae.created_at DESC, ae.id DESC LIMIT 200`, values),
    pool.query<AuditActionRow[]>("SELECT DISTINCT action FROM audit_events ORDER BY action"),
    pool.query<AuditUserRow[]>("SELECT id, names FROM users ORDER BY names"),
  ]);
  return { events, actions: actions.map((row) => row.action), users };
}
