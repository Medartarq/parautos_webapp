import { releaseConnection } from "../../db/release-connection.js";
import { getPool } from "../../db/pool.js";
import type { StorageProvider, StoredFile } from "./storage-port.js";

export type AttachmentContent = { objectKey: string; storageProvider: StorageProvider; mimeType: string; originalName: string };
export type AttachmentUpload = { orderId: number; userId: number; category: string; originalName: string; mimeType: string; stored: StoredFile; requestId: string; ipAddress?: string; userAgent?: string };

export interface AttachmentRepository {
  listByOrder(orderId: number): Promise<unknown[]>;
  findContent(id: number): Promise<AttachmentContent | undefined>;
  orderExists(orderId: number): Promise<boolean>;
  create(upload: AttachmentUpload): Promise<number>;
}

export const mariaDbAttachmentRepository: AttachmentRepository = {
  listByOrder: (orderId) => getPool().query("SELECT id, category, original_name AS originalName, mime_type AS mimeType, byte_size AS byteSize, created_at AS createdAt FROM attachments WHERE order_id = ? ORDER BY created_at DESC", [orderId]),
  async findContent(id) { return (await getPool().query<AttachmentContent[]>("SELECT object_key AS objectKey, storage_provider AS storageProvider, mime_type AS mimeType, original_name AS originalName FROM attachments WHERE id = ?", [id]))[0]; },
  async orderExists(orderId) { return Boolean((await getPool().query<{ id: number }[]>("SELECT id FROM service_orders WHERE id = ?", [orderId]))[0]); },
  async create(upload) {
    const connection = await getPool().getConnection(); let committed = false;
    try {
      await connection.beginTransaction();
      const result = await connection.query<{ insertId: number }>("INSERT INTO attachments (order_id, uploaded_by_user_id, category, storage_provider, object_key, original_name, mime_type, byte_size, sha256) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [upload.orderId, upload.userId, upload.category, upload.stored.provider, upload.stored.objectKey, upload.originalName, upload.mimeType, upload.stored.byteSize, upload.stored.sha256]);
      const attachmentId = Number(result.insertId);
      if (upload.category === "EVALUACION_MANUSCRITA") {
        await connection.query("UPDATE service_orders SET diagnosis_pending_reminder = 0 WHERE id = ?", [upload.orderId]);
        await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'DIAGNOSIS_UPLOADED', JSON_OBJECT('attachmentId', ?, 'originalName', ?), ?, ?, ?)", [upload.userId, String(upload.orderId), attachmentId, upload.originalName, upload.requestId, upload.ipAddress ?? null, upload.userAgent ?? null]);
      }
      await connection.commit(); committed = true; return attachmentId;
    } catch (error) { if (!committed) await connection.rollback(); throw error; } finally { await releaseConnection(connection); }
  },
};
