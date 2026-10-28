import { z } from "zod";
import { getPool } from "../../db/pool.js";
import { snapshotIdentityColumn as identity } from "./reception-snapshot.js";
import { partSelect } from "./parts-query-repository.js";

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().refine((n) => [10, 20, 30].includes(n), "Use 10, 20 o 30 resultados.").default(10),
  search: z.string().trim().max(200).default(""),
  status: z.string().max(60).default(""), modality: z.string().max(60).default(""),
  age: z.enum(["", "RECENT", "ATTENTION", "OVERDUE", "NEXT_3", "NO_DATE"]).default(""),
  from: z.union([z.iso.date(), z.literal("")]).default(""), to: z.union([z.iso.date(), z.literal("")]).default(""),
  advisor: z.string().max(200).default(""), provider: z.string().max(200).default(""),
  quality: z.string().max(40).default(""), pendingClaim: z.enum(["", "true", "false"]).default(""),
  view: z.enum(["", "quotes"]).default(""),
});
export type ListQuery = z.infer<typeof listQuerySchema>;
const joins = `FROM service_orders o JOIN client_vehicles cv ON cv.id=o.client_vehicle_id JOIN clients c ON c.id=cv.client_id JOIN vehicles v ON v.id=cv.vehicle_id LEFT JOIN users u ON u.id=o.advisor_user_id LEFT JOIN reception_snapshots rs ON rs.order_id=o.id`;
const identities = `${identity("client", "c.full_name")} AS client, ${identity("plate", "v.plate")} AS plate, ${identity("brand", "v.brand")} AS brand, ${identity("model", "v.model")} AS model, ${identity("color", "v.color")} AS color, ${identity("advisorName", "u.names")} AS advisor`;
const orderSelect = `SELECT o.id, o.order_number AS orderNumber, o.internal_status AS status, o.modality, o.claim_pending_reminder AS claimPending, o.created_at AS createdAt, ${identities} ${joins}`;
const quoteSelect = `SELECT q.id, o.order_number AS orderNumber, o.modality, q.status, q.created_at AS createdAt, q.sent_at AS sentAt, ${identities} ${joins} JOIN quote_versions q ON q.order_id=o.id WHERE q.status IN ('PENDIENTE','ENVIADA') AND q.version_number=(SELECT MAX(q2.version_number) FROM quote_versions q2 WHERE q2.order_id=o.id)`;
const reportPartSelect = `SELECT p.id, o.order_number AS orderNumber, p.description, p.quantity, p.received_quantity AS receivedQuantity, p.management_status AS status, p.provider_name AS providerName, p.expected_date AS expectedDate, p.updated_at AS updatedAt, ${identities} ${joins} JOIN order_parts p ON p.order_id=o.id WHERE p.received_quantity<p.quantity`;
export type ListKind = "orders" | "parts" | "reportQuotes" | "reportParts";
const selects: Record<ListKind, string> = { orders: orderSelect, parts: partSelect, reportQuotes: quoteSelect, reportParts: reportPartSelect };
const listOrder = (kind: ListKind) => kind === "parts" || kind === "reportParts" ? "expectedDate IS NULL, expectedDate, updatedAt DESC, id DESC" : "createdAt DESC, id DESC";

export function buildListFilter(kind: ListKind, query: ListQuery) {
  const clauses: string[] = []; const values: unknown[] = [];
  const add = (sql: string, value?: unknown) => { clauses.push(sql); if (value !== undefined) values.push(value); };
  const isPart = kind === "parts" || kind === "reportParts";
  const date = isPart ? "expectedDate" : "createdAt";
  if (query.search) {
    const columns = kind === "parts" ? "orderNumber, plate, description, partCode, claimNumber, providerName" : kind === "reportParts" ? "orderNumber, plate, client, brand, model, description, providerName" : "orderNumber, plate, client, brand, model";
    add(`LOCATE(LOWER(?), LOWER(CONCAT_WS(' ', ${columns}))) > 0`, query.search);
  }
  if (query.status && query.status !== "ALL") {
    add(kind === "parts" ? "(CASE WHEN receivedQuantity>=quantity THEN 'RECIBIDO' ELSE managementStatus END)=?" : "status=?", query.status);
  }
  if (query.modality && query.modality !== "ALL" && !isPart) add("modality=?", query.modality);
  if (query.view === "quotes" && kind === "orders") add("status IN ('COTIZACION_PENDIENTE','ESPERA_APROBACION')");
  if (query.pendingClaim === "true" && kind === "orders") add("claimPending=1");
  if (query.advisor && kind.startsWith("report")) add("advisor=?", query.advisor);
  if (query.provider && isPart) {
    const column = kind === "parts" ? "providerId" : "providerName";
    if (query.provider === "NO_PROVIDER") add(`${column} IS NULL`); else add(`${column}=?`, query.provider);
  }
  if (query.quality && kind === "parts") add("quality=?", query.quality);
  if (query.from) add(`${date}>=?`, query.from);
  if (query.to) add(`${date}<DATE_ADD(?, INTERVAL 1 DAY)`, query.to);
  if (isPart) {
    if (query.age === "OVERDUE") add("expectedDate<CURDATE() AND receivedQuantity<quantity");
    if (query.age === "NEXT_3") add("expectedDate>=CURDATE() AND expectedDate<DATE_ADD(CURDATE(), INTERVAL 4 DAY)");
    if (query.age === "NO_DATE") add("expectedDate IS NULL");
  } else {
    if (query.age === "RECENT") add("TIMESTAMPDIFF(DAY, createdAt, NOW())<=2");
    if (query.age === "ATTENTION") add("TIMESTAMPDIFF(DAY, createdAt, NOW()) BETWEEN 3 AND 5");
    if (query.age === "OVERDUE") add("TIMESTAMPDIFF(DAY, createdAt, NOW())>5");
  }
  return { where: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", values };
}

export async function listPage(kind: ListKind, query: ListQuery) {
  const pool = getPool(); const { where, values } = buildListFilter(kind, query);
  const source = `FROM (${selects[kind]}) records`;
  const counts = await pool.query<any[]>(`SELECT COUNT(*) AS total ${source}${where}`, values);
  const total = Number(counts[0].total); const pages = Math.max(1, Math.ceil(total / query.pageSize)); const page = Math.min(query.page, pages);
  const rows = await pool.query<any[]>(`SELECT * ${source}${where} ORDER BY ${listOrder(kind)} LIMIT ? OFFSET ?`, [...values, query.pageSize, (page - 1) * query.pageSize]);
  return { rows, pagination: { page, pageSize: query.pageSize, total, pages } };
}

// A deliberate export uses one consistent SELECT, rather than collecting changing pages.
export async function exportReportRows(kind: "reportQuotes" | "reportParts", query: ListQuery) {
  const { where, values } = buildListFilter(kind, query);
  return getPool().query<any[]>(`SELECT * FROM (${selects[kind]}) records${where} ORDER BY ${listOrder(kind)}`, values);
}

export async function orderListSummary() {
  const rows = await getPool().query<any[]>("SELECT internal_status AS status, COUNT(*) AS total FROM service_orders GROUP BY internal_status");
  const overdue = await getPool().query<any[]>("SELECT COUNT(*) AS total FROM service_orders WHERE internal_status IN ('COTIZACION_PENDIENTE','ESPERA_APROBACION') AND TIMESTAMPDIFF(DAY, created_at, NOW())>5");
  return { counts: Object.fromEntries(rows.map((r) => [r.status, Number(r.total)])), total: rows.reduce((sum, r) => sum + Number(r.total), 0), overdue: Number(overdue[0].total) };
}

export async function recentOrders() {
  return { orders: await getPool().query<any[]>(`${orderSelect} ORDER BY o.created_at DESC, o.id DESC LIMIT 5`), ...await orderListSummary() };
}

export async function partsPage(query: ListQuery) {
  const result = await listPage("parts", query);
  const [metrics, providers] = await Promise.all([
    getPool().query<any[]>("SELECT SUM(received_quantity<quantity AND expected_date<CURDATE()) AS overdue, SUM(received_quantity<quantity AND management_status='PEDIDO') AS ordered, SUM(received_quantity<quantity AND provider_id IS NULL) AS unassigned, SUM(received_quantity>=quantity) AS received FROM order_parts"),
    getPool().query<any[]>("SELECT DISTINCT provider_id AS id, provider_name AS name FROM order_parts WHERE provider_id IS NOT NULL AND provider_name IS NOT NULL ORDER BY provider_name"),
  ]);
  return { parts: result.rows.map((r) => ({ ...r, quantity: Number(r.quantity), receivedQuantity: Number(r.receivedQuantity), fullyReceived: Number(r.receivedQuantity) >= Number(r.quantity), partiallyReceived: false, partialReceived: false, freightRequested: Boolean(r.freightRequested) })), pagination: result.pagination, metrics: metrics[0], providerOptions: providers };
}

export async function reportOptions(kind: "reportQuotes" | "reportParts") {
  return getPool().query<any[]>(`SELECT DISTINCT advisor, ${kind === "reportQuotes" ? "modality, status" : "providerName, status"} FROM (${selects[kind]}) records`);
}
