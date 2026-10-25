import { Router } from "express";
import multer from "multer";
import { getPool } from "../../db/pool.js";
import { AppError } from "../../errors/app-error.js";
import { requireAuthentication, requireRoles } from "../../middleware/auth.js";
import { deleteStoredFile, readStoredFile, storeFile, type StorageProvider } from "./storage.js";
import { hasDeclaredImageContent } from "./image-validation.js";

const categories = new Set(["RECEPCION", "DANIO", "EVALUACION_MANUSCRITA", "OTRO"]);
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 }, fileFilter: (_request, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) });
export const attachmentsRouter = Router();
attachmentsRouter.use(requireAuthentication, requireRoles("SUPERADMINISTRADOR", "ADMINISTRADOR", "ASESOR"));
attachmentsRouter.get("/orders/:orderId", async (request, response) => {
  const orderId = Number(request.params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId < 1) throw new AppError(400, "INVALID_ORDER", "La orden no es valida.");
  const attachments = await getPool().query(`SELECT id, category, original_name AS originalName, mime_type AS mimeType, byte_size AS byteSize, created_at AS createdAt FROM attachments WHERE order_id = ? ORDER BY created_at DESC`, [orderId]);
  response.json({ attachments });
});
attachmentsRouter.get("/:attachmentId/content", async (request, response) => {
  const attachmentId = Number(request.params.attachmentId);
  if (!Number.isSafeInteger(attachmentId) || attachmentId < 1) throw new AppError(400, "INVALID_ATTACHMENT", "El adjunto no es válido.");
  const rows = await getPool().query<{ objectKey: string; storageProvider: StorageProvider; mimeType: string; originalName: string }[]>("SELECT object_key AS objectKey, storage_provider AS storageProvider, mime_type AS mimeType, original_name AS originalName FROM attachments WHERE id = ?", [attachmentId]);
  const attachment = rows[0];
  if (!attachment) throw new AppError(404, "ATTACHMENT_NOT_FOUND", "El adjunto no existe.");
  const file = await readStoredFile(attachment.storageProvider, attachment.objectKey);
  response.type(attachment.mimeType).setHeader("Content-Disposition", `inline; filename=\"${attachment.originalName.replace(/[\"\\]/g, "")}\"`).send(file);
});
attachmentsRouter.post("/orders/:orderId", upload.single("file"), async (request, response) => {
  const orderId = Number(request.params.orderId); const category = request.body.category;
  if (!Number.isSafeInteger(orderId) || orderId < 1) throw new AppError(400, "INVALID_ORDER", "La orden no es valida.");
  if (!request.file) throw new AppError(400, "INVALID_FILE", "Adjunte una imagen JPEG, PNG o WEBP de hasta 5 MB.");
  if (!hasDeclaredImageContent(request.file))
    throw new AppError(400, "INVALID_IMAGE_CONTENT", "El contenido del archivo no coincide con una imagen JPEG, PNG o WEBP válida.");
  if (!categories.has(category)) throw new AppError(400, "INVALID_ATTACHMENT_CATEGORY", "La categoria de evidencia no es valida.");
  const order = await getPool().query<{ id: number }[]>("SELECT id FROM service_orders WHERE id = ?", [orderId]);
  if (!order[0]) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
  const stored = await storeFile(request.file);
  const connection = await getPool().getConnection();
  let committed = false;
  try {
    await connection.beginTransaction();
    const result = await connection.query<{ insertId: number }>("INSERT INTO attachments (order_id, uploaded_by_user_id, category, storage_provider, object_key, original_name, mime_type, byte_size, sha256) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [orderId, request.currentUser!.id, category, stored.provider, stored.objectKey, request.file.originalname, request.file.mimetype, stored.byteSize, stored.sha256]);
    if (category === "EVALUACION_MANUSCRITA") {
      await connection.query("UPDATE service_orders SET diagnosis_pending_reminder = 0 WHERE id = ?", [orderId]);
      await connection.query("INSERT INTO audit_events (actor_user_id, entity, record_id, action, new_data, request_id, ip_address, user_agent) VALUES (?, 'service_order', ?, 'DIAGNOSIS_UPLOADED', JSON_OBJECT('attachmentId', ?, 'originalName', ?), ?, ?, ?)", [request.currentUser!.id, String(orderId), Number(result.insertId), request.file.originalname, request.requestId, request.ip, request.get("user-agent") ?? null]);
    }
    await connection.commit();
    committed = true;
    response.status(201).json({ attachment: { id: Number(result.insertId), category, originalName: request.file.originalname } });
  } catch (error) {
    if (!committed) await connection.rollback();
    if (!committed) await deleteStoredFile(stored.provider, stored.objectKey);
    throw error;
  } finally {
    connection.release();
  }
});
