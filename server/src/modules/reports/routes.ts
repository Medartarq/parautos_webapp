import { Router } from "express";
import { requireAuthentication, requireRoles } from "../../middleware/auth.js";
import { getPool } from "../../db/pool.js";
import { exportReportRows, listPage, listQuerySchema, reportOptions } from "../orders/paginated-lists.js";

type AdvisorActivityRow = { names: string; created: number | string; diagnosis: number | string; quotes: number | string; sent: number | string; delivered: number | string };
type WeeklyRow = { week: string; created: number | string; sent: number | string; delivered: number | string };
type AdvisorWorkloadRow = { names: string; quotePending: number | string; approvalPending: number | string; partsPending: number | string; repair: number | string; ready: number | string };
type AgingRow = { source: string; recent: number | string; attention: number | string; overdue: number | string; withoutDate: number | string };
type QuoteFunnelRow = { created: number | string; sent: number | string; approved: number | string };

export const reportsRouter = Router();
reportsRouter.use(requireAuthentication, requireRoles("SUPERADMINISTRADOR", "ADMINISTRADOR"));
reportsRouter.get("/export/:kind", async (request, response) => {
  if (!["quotes", "parts"].includes(request.params.kind)) { response.status(404).end(); return; }
  const kind = request.params.kind === "quotes" ? "reportQuotes" : "reportParts";
  response.json({ rows: await exportReportRows(kind, listQuerySchema.parse(request.query)) });
});
reportsRouter.get("/list/:kind", async (request, response) => {
  if (!["quotes", "parts"].includes(request.params.kind)) { response.status(404).end(); return; }
  const kind = request.params.kind === "quotes" ? "reportQuotes" : "reportParts";
  const result = await listPage(kind, listQuerySchema.parse(request.query));
  response.json({ ...result, options: await reportOptions(kind) });
});
reportsRouter.get("/operational", async (_request, response) => {
  const pool = getPool();
  const [orders, quotes, parts, advisorActivity, weekly, advisorWorkload, aging, quoteFunnel] = await Promise.all([
    pool.query<any[]>("SELECT internal_status AS status, modality, COUNT(*) AS total FROM service_orders GROUP BY internal_status, modality"),
    pool.query<any[]>("SELECT COUNT(*) AS total FROM quote_versions q WHERE q.status IN ('PENDIENTE','ENVIADA') AND q.version_number=(SELECT MAX(q2.version_number) FROM quote_versions q2 WHERE q2.order_id=q.order_id)"),
    pool.query<any[]>("SELECT COUNT(*) AS total FROM order_parts WHERE received_quantity<quantity"),
    pool.query<AdvisorActivityRow[]>("SELECT u.names, SUM(ae.action='CREATED') AS created, SUM(ae.action='DIAGNOSIS_UPLOADED') AS diagnosis, SUM(ae.action IN ('QUOTE_CREATED','QUOTE_UPDATED')) AS quotes, SUM(ae.action='QUOTE_SENT') AS sent, SUM(ae.action='ORDER_DELIVERED') AS delivered FROM users u JOIN roles r ON r.id=u.role_id LEFT JOIN audit_events ae ON ae.actor_user_id=u.id AND ae.created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) WHERE r.code='ASESOR' AND u.active=1 GROUP BY u.id, u.names ORDER BY u.names"),
    pool.query<WeeklyRow[]>("SELECT DATE_FORMAT(created_at, '%Y-%u') AS week, SUM(action='CREATED') AS created, SUM(action='QUOTE_SENT') AS sent, SUM(action='ORDER_DELIVERED') AS delivered FROM audit_events WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK) GROUP BY DATE_FORMAT(created_at, '%Y-%u') ORDER BY week"),
    pool.query<AdvisorWorkloadRow[]>("SELECT u.names, SUM(o.internal_status='COTIZACION_PENDIENTE') AS quotePending, SUM(o.internal_status='ESPERA_APROBACION') AS approvalPending, SUM(o.internal_status='ESPERA_REPUESTOS') AS partsPending, SUM(o.internal_status='EN_REPARACION') AS repair, SUM(o.internal_status='LISTA_PARA_ENTREGA') AS ready FROM users u JOIN roles r ON r.id=u.role_id LEFT JOIN service_orders o ON o.advisor_user_id=u.id AND o.internal_status NOT IN ('ENTREGADA','CANCELADA') WHERE r.code='ASESOR' AND u.active=1 GROUP BY u.id, u.names ORDER BY u.names"),
    pool.query<AgingRow[]>("SELECT source, SUM(days_old BETWEEN 0 AND 2) AS recent, SUM(days_old BETWEEN 3 AND 5) AS attention, SUM(days_old > 5) AS overdue, SUM(days_old IS NULL) AS withoutDate FROM (SELECT 'COTIZACIONES' AS source, TIMESTAMPDIFF(DAY, q.created_at, NOW()) AS days_old FROM quote_versions q WHERE q.status IN ('PENDIENTE','ENVIADA') AND q.version_number=(SELECT MAX(q2.version_number) FROM quote_versions q2 WHERE q2.order_id=q.order_id) UNION ALL SELECT 'REPUESTOS', CASE WHEN p.expected_date IS NULL THEN NULL ELSE TIMESTAMPDIFF(DAY, p.expected_date, CURDATE()) END FROM order_parts p WHERE p.received_quantity<p.quantity) pending GROUP BY source"),
    pool.query<QuoteFunnelRow[]>("SELECT COUNT(*) AS created, SUM(status IN ('ENVIADA','APROBADA')) AS sent, SUM(status='APROBADA') AS approved FROM quote_versions q WHERE q.version_number=(SELECT MAX(q2.version_number) FROM quote_versions q2 WHERE q2.order_id=q.order_id)"),
  ]);
  response.json({ orders, quoteCount: Number(quotes[0].total), partCount: Number(parts[0].total), advisorActivity, weekly, advisorWorkload, aging, quoteFunnel: quoteFunnel[0] ?? { created: 0, sent: 0, approved: 0 } });
});
