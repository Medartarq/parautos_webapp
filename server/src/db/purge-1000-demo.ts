import { unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolConnection } from "mariadb";
import { getEnvironment } from "../config/env.js";
import { technicalLogger } from "../logging/technical-logger.js";
import { getLocalUploadRoot } from "../modules/attachments/local-storage.js";
import { closePool, getPool, runWithDatabaseScope } from "./pool.js";
import { releaseConnection } from "./release-connection.js";
import { deleteStoredFile, type StorageProvider } from "../modules/attachments/storage.js";

// Los lanzadores pueden ejecutarse desde la raíz o desde `server`; el mismo
// `object_key` puede haberse guardado bajo cualquiera de las dos raíces.
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Borra SOLO las órdenes ficticias del lote `DM####` de la base demo.
 *
 * Salvaguardas:
 * 1. `DEMO_MODE_ENABLED=true`.
 * 2. `DEMO_DB_NAME` distinto de `DB_NAME`.
 * 3. La conexión activa debe ser exactamente `DEMO_DB_NAME` (`SELECT DATABASE()`).
 * 4. Sin `DEMO_PURGE_CONFIRM=PURGE` solo se simula (dry-run).
 * 5. Selección acotada a placas `^DM[0-9]+$`; nunca un borrado global.
 */

export type PurgeSummary = {
  orders: number;
  clients: number;
  vehicles: number;
  quotes: number;
  receptions: number;
  attachments: number;
  checklistAnswers: number;
  damageMarks: number;
  parts: number;
  auditEvents: number;
};

type AttachmentRow = { storage_provider: string; object_key: string };

type PurgeTargets = {
  orderIds: number[];
  quoteIds: number[];
  receptionIds: number[];
  draftIds: number[];
  cvIds: number[];
  vehicleIds: number[];
  clientIds: number[];
};

function emptySummary(): PurgeSummary {
  return { orders: 0, clients: 0, vehicles: 0, quotes: 0, receptions: 0, attachments: 0, checklistAnswers: 0, damageMarks: 0, parts: 0, auditEvents: 0 };
}

function purgeMode(): "dry-run" | "execute" {
  const confirm = process.env.DEMO_PURGE_CONFIRM;
  if (confirm === undefined || confirm === "") return "dry-run";
  if (confirm === "PURGE") return "execute";
  throw new Error('DEMO_PURGE_CONFIRM inválido: use "PURGE" para borrar o déjelo vacío para simular.');
}

async function queryIds(connection: PoolConnection, sql: string, values: unknown[]): Promise<number[]> {
  const rows = await connection.query<Array<{ id: number }>>(sql, values);
  return rows.map((row) => Number(row.id));
}

async function countBy(connection: PoolConnection, table: string, column: string, ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  const rows = await connection.query<Array<{ total: number }>>(`SELECT COUNT(*) AS total FROM ${table} WHERE ${column} IN (?)`, [ids]);
  return Number(rows[0].total);
}

async function countAuditEvents(connection: PoolConnection, orderIds: number[]): Promise<number> {
  if (!orderIds.length) return 0;
  const rows = await connection.query<Array<{ total: number }>>(
    "SELECT COUNT(*) AS total FROM audit_events WHERE entity = 'service_order' AND record_id IN (?)",
    [orderIds.map(String)],
  );
  return Number(rows[0].total);
}

async function deleteBy(connection: PoolConnection, table: string, column: string, ids: number[]): Promise<void> {
  if (!ids.length) return;
  await connection.query(`DELETE FROM ${table} WHERE ${column} IN (?)`, [ids]);
}

async function collectCounts(
  connection: PoolConnection,
  targets: PurgeTargets,
  attachmentCount: number,
): Promise<PurgeSummary> {
  return {
    orders: targets.orderIds.length,
    clients: targets.clientIds.length,
    vehicles: targets.vehicleIds.length,
    quotes: targets.quoteIds.length,
    receptions: targets.receptionIds.length,
    attachments: attachmentCount,
    checklistAnswers: await countBy(connection, "checklist_answers", "reception_id", targets.receptionIds),
    damageMarks: await countBy(connection, "damage_marks", "reception_id", targets.receptionIds),
    parts: await countBy(connection, "order_parts", "order_id", targets.orderIds),
    auditEvents: await countAuditEvents(connection, targets.orderIds),
  };
}

async function deleteBatch(connection: PoolConnection, targets: PurgeTargets): Promise<void> {
  const { orderIds, quoteIds, receptionIds, draftIds, cvIds, vehicleIds, clientIds } = targets;
  await deleteBy(connection, "order_parts_logistics", "order_id", orderIds);
  await deleteBy(connection, "order_labor_verifications", "order_id", orderIds);
  await deleteBy(connection, "order_parts", "order_id", orderIds);
  await deleteBy(connection, "order_final_controls", "order_id", orderIds);
  await deleteBy(connection, "order_operational_data", "order_id", orderIds);
  await deleteBy(connection, "quote_draft_lines", "quote_draft_id", draftIds);
  await deleteBy(connection, "quote_drafts", "id", draftIds);
  await deleteBy(connection, "quote_lines", "quote_version_id", quoteIds);
  await deleteBy(connection, "quote_versions", "id", quoteIds);
  await deleteBy(connection, "reception_snapshots", "order_id", orderIds);
  await deleteBy(connection, "damage_marks", "reception_id", receptionIds);
  await deleteBy(connection, "checklist_answers", "reception_id", receptionIds);
  await deleteBy(connection, "attachments", "order_id", orderIds);
  await deleteBy(connection, "receptions", "order_id", orderIds);
  if (orderIds.length)
    await connection.query("DELETE FROM audit_events WHERE entity = 'service_order' AND record_id IN (?)", [orderIds.map(String)]);
  await deleteBy(connection, "service_orders", "id", orderIds);
  if (cvIds.length)
    await connection.query(
      "DELETE cv FROM client_vehicles cv LEFT JOIN service_orders o ON o.client_vehicle_id = cv.id WHERE cv.id IN (?) AND o.id IS NULL",
      [cvIds],
    );
  if (vehicleIds.length)
    await connection.query(
      "DELETE v FROM vehicles v LEFT JOIN client_vehicles cv ON cv.vehicle_id = v.id WHERE v.id IN (?) AND cv.id IS NULL",
      [vehicleIds],
    );
  if (clientIds.length)
    await connection.query(
      "DELETE c FROM clients c LEFT JOIN client_vehicles cv ON cv.client_id = c.id WHERE c.id IN (?) AND cv.id IS NULL AND c.document_number REGEXP '^70[0-9]{6}$'",
      [clientIds],
    );
}

async function removeLocalFile(objectKey: string): Promise<void> {
  const env = getEnvironment();
  const roots = new Set<string>([getLocalUploadRoot()]);
  const demoDirectory = env.DEMO_LOCAL_UPLOAD_DIR ?? "data/demo-uploads";
  if (env.DEMO_LOCAL_UPLOAD_BASE !== "home" && demoDirectory !== env.LOCAL_UPLOAD_DIR)
    roots.add(join(PROJECT_ROOT, demoDirectory.replaceAll("\\", "/")));
  for (const root of roots) {
    try {
      await unlink(join(root, objectKey));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

async function removeFiles(attachments: AttachmentRow[]): Promise<void> {
  for (const attachment of attachments) {
    try {
      if (attachment.storage_provider === "local") await removeLocalFile(attachment.object_key); // NOSONAR: borrado secuencial de archivos demo
      else await deleteStoredFile(attachment.storage_provider as StorageProvider, attachment.object_key);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[purge-1000] No se pudo borrar el archivo ${attachment.object_key}: ${message}`);
    }
  }
}

export async function purge1000Demo(execute: boolean): Promise<PurgeSummary> {
  const env = getEnvironment();
  if (!env.DEMO_MODE_ENABLED)
    throw new Error("DEMO_MODE_ENABLED debe ser true para purgar datos demo.");
  if (env.DEMO_DB_NAME === env.DB_NAME)
    throw new Error("DEMO_DB_NAME y DB_NAME son iguales; se cancela la purga para no afectar producción.");

  return runWithDatabaseScope("demo", async () => {
    const pool = getPool();
    const databases = await pool.query<Array<{ db: string }>>("SELECT DATABASE() AS db");
    const activeDatabase = databases[0]?.db;
    if (activeDatabase !== env.DEMO_DB_NAME)
      throw new Error(`La conexión activa es "${activeDatabase}" y no la base demo "${env.DEMO_DB_NAME}". Purga cancelada.`);

    const connection = await pool.getConnection();
    let failed = true;
    try {
      await connection.beginTransaction();

      const orders = await connection.query<Array<{ id: number; client_vehicle_id: number }>>(
        `SELECT o.id, o.client_vehicle_id FROM service_orders o
         JOIN client_vehicles cv ON cv.id = o.client_vehicle_id
         JOIN vehicles v ON v.id = cv.vehicle_id
         WHERE v.plate REGEXP '^DM[0-9]+$'`,
      );
      const orderIds = orders.map((row) => Number(row.id));
      if (!orderIds.length) {
        await connection.rollback();
        failed = false;
        console.info("[purge-1000] No hay órdenes con placa DM#### que borrar.");
        return emptySummary();
      }

      const cvIds = [...new Set(orders.map((row) => Number(row.client_vehicle_id)))];
      const quoteIds = await queryIds(connection, "SELECT id FROM quote_versions WHERE order_id IN (?)", [orderIds]);
      const receptionIds = await queryIds(connection, "SELECT id FROM receptions WHERE order_id IN (?)", [orderIds]);
      const draftIds = await queryIds(connection, "SELECT id FROM quote_drafts WHERE order_id IN (?)", [orderIds]);
      const links = await connection.query<Array<{ client_id: number; vehicle_id: number }>>(
        "SELECT client_id, vehicle_id FROM client_vehicles WHERE id IN (?)",
        [cvIds],
      );
      const clientIds = [...new Set(links.map((row) => Number(row.client_id)))];
      const vehicleIds = [...new Set(links.map((row) => Number(row.vehicle_id)))];
      const attachments = await connection.query<AttachmentRow[]>(
        "SELECT storage_provider, object_key FROM attachments WHERE order_id IN (?)",
        [orderIds],
      );
      const targets: PurgeTargets = { orderIds, quoteIds, receptionIds, draftIds, cvIds, vehicleIds, clientIds };

      const summary = await collectCounts(connection, targets, attachments.length);

      if (!execute) {
        await connection.rollback();
        failed = false;
        return summary;
      }

      await deleteBatch(connection, targets);
      await connection.commit();
      failed = false;

      await removeFiles(attachments);
      return summary;
    } finally {
      if (failed) {
        try { await connection.rollback(); } catch { /* la transacción ya no está activa */ }
      }
      await releaseConnection(connection);
    }
  });
}

async function main(): Promise<void> {
  const execute = purgeMode() === "execute";
  console.info(execute
    ? "[purge-1000] EJECUCIÓN REAL: se borrarán solo las órdenes con placa DM#### de la base demo."
    : "[purge-1000] DRY RUN: no se borrará nada. Defina DEMO_PURGE_CONFIRM=PURGE para ejecutar.");

  const summary = await purge1000Demo(execute);
  for (const [key, value] of Object.entries(summary)) console.info(`  ${key}: ${value}`);
  console.info(execute ? "[purge-1000] Purga completada." : "[purge-1000] Simulación completada.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main()
    .then(() => closePool())
    .catch(async (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      technicalLogger.failure("database_task_failed", error);
      await closePool();
      process.exitCode = 1;
    });
