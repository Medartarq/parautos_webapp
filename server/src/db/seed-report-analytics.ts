import { technicalLogger } from "../logging/technical-logger.js";
import { closePool, getPool } from "./pool.js";

const demoDocuments = ["70123451", "70123452", "70123453", "70123454"];
const dates = ["2026-09-12 09:15:00", "2026-09-19 10:20:00", "2026-10-01 11:30:00", "2026-10-10 14:10:00"];

async function seedReportAnalytics() {
  const pool = getPool();
  const advisors = await pool.query<Array<{ id: number; username: string }>>("SELECT id, username FROM users WHERE username IN ('asesor01', 'asesor02') AND active = 1 ORDER BY username");
  if (advisors.length !== 2) throw new Error("Se requieren las cuentas demo asesor01 y asesor02.");
  const orders = await pool.query<Array<{ id: number; document: string }>>("SELECT o.id, c.document_number AS document FROM service_orders o JOIN client_vehicles cv ON cv.id=o.client_vehicle_id JOIN clients c ON c.id=cv.client_id WHERE c.document_number IN (?) ORDER BY c.document_number", [demoDocuments]);
  if (!orders.length) throw new Error("Ejecute primero npm run seed:demo para crear las órdenes demo.");
  for (const [index, order] of orders.entries()) {
    const advisor = advisors[index % advisors.length]; const createdAt = dates[index % dates.length];
    await pool.query("UPDATE service_orders SET advisor_user_id=?, created_at=? WHERE id=?", [advisor.id, createdAt, order.id]);
    await pool.query("UPDATE receptions SET advisor_user_id=?, created_at=? WHERE order_id=?", [advisor.id, createdAt, order.id]);
    await pool.query("UPDATE quote_versions SET created_at=DATE_ADD(?, INTERVAL 2 DAY), sent_at=IF(status IN ('ENVIADA','APROBADA'), DATE_ADD(?, INTERVAL 3 DAY), NULL), approved_at=IF(status='APROBADA', DATE_ADD(?, INTERVAL 5 DAY), NULL) WHERE order_id=?", [createdAt, createdAt, createdAt, order.id]);
    const events = [["CREATED", 0], ["DIAGNOSIS_UPLOADED", 1], ["QUOTE_CREATED", 2], ["QUOTE_SENT", 3]] as const;
    for (const [action, days] of events) await pool.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, request_id, created_at) SELECT ?, 'service_order', ?, ?, ?, DATE_ADD(?, INTERVAL ? DAY) WHERE NOT EXISTS (SELECT 1 FROM audit_events WHERE request_id=?)", [advisor.id, String(order.id), action, `report-demo-${order.id}-${action}`, createdAt, days, `report-demo-${order.id}-${action}`]);
  }
  console.info(`Escenario de analítica actualizado para ${orders.length} órdenes demo y ${advisors.length} asesores.`);
}
seedReportAnalytics().then(() => closePool()).catch(async (error: unknown) => { technicalLogger.failure("database_task_failed", error); await closePool(); process.exitCode = 1; });
