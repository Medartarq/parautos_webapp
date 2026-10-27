import type { PoolConnection } from "mariadb";

export type AuditWrite = { actorUserId: number; entity: string; recordId: string; action: string; requestId: string; ipAddress?: string; userAgent?: string; previousData?: string; newData?: string };

export interface AuditWriter { append(connection: PoolConnection, event: AuditWrite): Promise<void>; }

export const mariaDbAuditWriter: AuditWriter = {
  async append(connection, event) {
    await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, previous_data, new_data, request_id, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [event.actorUserId, event.entity, event.recordId, event.action, event.previousData || null, event.newData || null, event.requestId, event.ipAddress ?? null, event.userAgent ?? null]);
  },
};
