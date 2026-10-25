import { Router } from "express";
import multer from "multer";
import { AppError } from "../../errors/app-error.js";
import { requireAuthentication, requireRoles } from "../../middleware/auth.js";
import { hasDeclaredImageContent } from "./image-validation.js";
import { attachmentService } from "./attachment-service.js";

const categories = new Set(["RECEPCION", "DANIO", "EVALUACION_MANUSCRITA", "OTRO"]);
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 }, fileFilter: (_request, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) });
export const attachmentsRouter = Router();
attachmentsRouter.use(requireAuthentication, requireRoles("SUPERADMINISTRADOR", "ADMINISTRADOR", "ASESOR"));
attachmentsRouter.get("/orders/:orderId", async (request, response) => {
  const orderId = Number(request.params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId < 1) throw new AppError(400, "INVALID_ORDER", "La orden no es valida.");
  const attachments = await attachmentService.list(orderId);
  response.json({ attachments });
});
attachmentsRouter.get("/:attachmentId/content", async (request, response) => {
  const attachmentId = Number(request.params.attachmentId);
  if (!Number.isSafeInteger(attachmentId) || attachmentId < 1) throw new AppError(400, "INVALID_ATTACHMENT", "El adjunto no es válido.");
  const { attachment, file } = await attachmentService.content(attachmentId);
  response.attachment(attachment.originalName);
  response.setHeader("Content-Disposition", response.getHeader("Content-Disposition")!.toString().replace(/^attachment/, "inline"));
  response.type(attachment.mimeType).send(file);
});
attachmentsRouter.post("/orders/:orderId", upload.single("file"), async (request, response) => {
  const orderId = Number(request.params.orderId); const category = request.body.category;
  if (!Number.isSafeInteger(orderId) || orderId < 1) throw new AppError(400, "INVALID_ORDER", "La orden no es valida.");
  if (!request.file) throw new AppError(400, "INVALID_FILE", "Adjunte una imagen JPEG, PNG o WEBP de hasta 5 MB.");
  if (!hasDeclaredImageContent(request.file))
    throw new AppError(400, "INVALID_IMAGE_CONTENT", "El contenido del archivo no coincide con una imagen JPEG, PNG o WEBP válida.");
  if (!categories.has(category)) throw new AppError(400, "INVALID_ATTACHMENT_CATEGORY", "La categoria de evidencia no es valida.");
  const attachment = await attachmentService.upload({ orderId, userId: request.currentUser!.id, category, file: request.file, requestId: request.requestId, ipAddress: request.ip, userAgent: request.get("user-agent") ?? undefined });
  response.status(201).json({ attachment });
});
