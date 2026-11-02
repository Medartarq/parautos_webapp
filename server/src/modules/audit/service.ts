import { mariaDbAuditRepository, type AuditRepository } from "./audit-repository.js";

export type AuditFilters = { text?: string; userId?: number; action?: string; from?: string; to?: string; page: number; pageSize: number };

export function createAuditService(repository: AuditRepository = mariaDbAuditRepository) {
  return async (filters: AuditFilters) => {
    const clauses = ["1 = 1"];
    const values: unknown[] = [];
    if (filters.text) { clauses.push("(ae.action LIKE ? OR ae.entity LIKE ? OR ae.record_id LIKE ? OR u.names LIKE ?)"); const text = `%${filters.text}%`; values.push(text, text, text, text); }
    if (filters.userId) { clauses.push("ae.actor_user_id = ?"); values.push(filters.userId); }
    if (filters.action) { clauses.push("ae.action = ?"); values.push(filters.action); }
    if (filters.from) { clauses.push("ae.created_at >= ?"); values.push(`${filters.from} 00:00:00`); }
    if (filters.to) { clauses.push("ae.created_at < DATE_ADD(?, INTERVAL 1 DAY)"); values.push(filters.to); }
    const where = clauses.join(" AND ");
    const [counts, actions, users] = await Promise.all([
      repository.countEvents(where, values), repository.listActions(), repository.listUsers(),
    ]);
    const total = Number(counts[0]?.total || 0); const pages = Math.max(1, Math.ceil(total / filters.pageSize)); const page = Math.min(filters.page, pages);
    const events = await repository.listEvents(where, values, filters.pageSize, (page - 1) * filters.pageSize);
    return { events, actions: actions.map((row) => row.action), users, pagination: { page, pageSize: filters.pageSize, total, pages } };
  };
}

export const listAuditEvents = createAuditService();
