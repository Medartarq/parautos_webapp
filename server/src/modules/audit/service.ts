import { mariaDbAuditRepository, type AuditRepository } from "./audit-repository.js";

export type AuditFilters = { text?: string; userId?: number; action?: string; from?: string; to?: string };

export function createAuditService(repository: AuditRepository = mariaDbAuditRepository) {
  return async (filters: AuditFilters) => {
    const clauses = ["1 = 1"];
    const values: unknown[] = [];
    if (filters.text) { clauses.push("(ae.action LIKE ? OR ae.entity LIKE ? OR ae.record_id LIKE ? OR u.names LIKE ?)"); const text = `%${filters.text}%`; values.push(text, text, text, text); }
    if (filters.userId) { clauses.push("ae.actor_user_id = ?"); values.push(filters.userId); }
    if (filters.action) { clauses.push("ae.action = ?"); values.push(filters.action); }
    if (filters.from) { clauses.push("ae.created_at >= ?"); values.push(`${filters.from} 00:00:00`); }
    if (filters.to) { clauses.push("ae.created_at < DATE_ADD(?, INTERVAL 1 DAY)"); values.push(filters.to); }
    const [events, actions, users] = await Promise.all([
      repository.listEvents(clauses.join(" AND "), values), repository.listActions(), repository.listUsers(),
    ]);
    return { events, actions: actions.map((row) => row.action), users };
  };
}

export const listAuditEvents = createAuditService();
