import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { technicalLogger } from "../logging/technical-logger.js";
import { closePool, getDemoPool } from "./pool.js";

/** Reporte de solo lectura del volumen cargado en la base demo. */
export async function verify1000Demo(): Promise<void> {
  const pool = getDemoPool();
  const q = <T>(sql: string, args: unknown[] = []) => pool.query<T>(sql, args as never[]);

  const [orders] = await q<Array<{ total: number }>>("SELECT COUNT(*) AS total FROM service_orders");
  console.info(`Órdenes en base demo: ${Number(orders.total)}`);

  const seeded = await q<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total FROM service_orders o
     JOIN client_vehicles cv ON cv.id = o.client_vehicle_id
     JOIN vehicles v ON v.id = cv.vehicle_id
     WHERE v.plate LIKE 'DM%'`,
  );
  console.info(`Órdenes generadas por la carga masiva (placa DM%): ${Number(seeded[0].total)}`);

  const statuses = await q<Array<{ status: string; total: number }>>(
    "SELECT internal_status AS status, COUNT(*) AS total FROM service_orders GROUP BY internal_status ORDER BY total DESC",
  );
  console.info("Distribución por estado:");
  for (const row of statuses) console.info(`  ${row.status}: ${Number(row.total)}`);

  const modalities = await q<Array<{ modality: string; total: number }>>(
    "SELECT modality, COUNT(*) AS total FROM service_orders GROUP BY modality ORDER BY total DESC",
  );
  console.info("Distribución por modalidad:");
  for (const row of modalities) console.info(`  ${row.modality}: ${Number(row.total)}`);

  const [quotes] = await q<Array<{ total: number }>>("SELECT COUNT(*) AS total FROM quote_versions");
  const [parts] = await q<Array<{ total: number }>>("SELECT COUNT(*) AS total FROM order_parts");
  console.info(`Cotizaciones: ${Number(quotes.total)} · Repuestos en orden: ${Number(parts.total)}`);

  const recent = await q<Array<{ orderNumber: string; status: string; createdAt: Date }>>(
    "SELECT order_number AS orderNumber, internal_status AS status, created_at AS createdAt FROM service_orders ORDER BY created_at DESC, id DESC LIMIT 5",
  );
  console.info("Últimas 5 órdenes:");
  for (const row of recent) console.info(`  ${row.orderNumber} · ${row.status} · ${String(row.createdAt)}`);

  const total = Number(seeded[0].total);
  if (total >= 950) console.info(`Verificación correcta: ${total} órdenes masivas presentes (se esperaban ~1000).`);
  else console.info(`Atención: solo ${total} órdenes masivas (se esperaban ~1000).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  verify1000Demo()
    .then(() => closePool())
    .catch(async (error: unknown) => {
      technicalLogger.failure("database_task_failed", error);
      await closePool();
      process.exitCode = 1;
    });
