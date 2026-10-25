import { getPool } from "../../db/pool.js";

export type AuditEventRow = { id: number; entity: string; recordId: string; action: string; previousData: string | null; newData: string | null; requestId: string | null; ipAddress: string | null; userAgent: string | null; createdAt: Date; actorUserId: number | null; actorName: string | null; orderNumber: string | null };
export type AuditActionRow = { action: string };
export type AuditUserRow = { id: number; names: string };

export interface AuditRepository {
  listEvents(where: string, values: unknown[]): Promise<AuditEventRow[]>;
  listActions(): Promise<AuditActionRow[]>;
  listUsers(): Promise<AuditUserRow[]>;
}

/** Resolves the current production/demo MariaDB pool at operation time. */
export const mariaDbAuditRepository: AuditRepository = {
  listEvents: (where, values) => getPool().query<AuditEventRow[]>(
    `SELECT ae.id, ae.entity, ae.record_id AS recordId, ae.action, ae.previous_data AS previousData, ae.new_data AS newData, ae.request_id AS requestId, ae.ip_address AS ipAddress, ae.user_agent AS userAgent, ae.created_at AS createdAt, u.id AS actorUserId, u.names AS actorName, o.order_number AS orderNumber FROM audit_events ae LEFT JOIN users u ON u.id = ae.actor_user_id LEFT JOIN service_orders o ON ae.entity = 'service_order' AND ae.record_id = CAST(o.id AS CHAR) WHERE ${where} ORDER BY ae.created_at DESC, ae.id DESC LIMIT 200`,
    values,
  ),
  listActions: () => getPool().query<AuditActionRow[]>("SELECT DISTINCT action FROM audit_events ORDER BY action"),
  listUsers: () => getPool().query<AuditUserRow[]>("SELECT id, names FROM users ORDER BY names"),
};
