import { AppError } from "../../errors/app-error.js";
import { deleteStoredFile, readStoredFile, storeFile } from "./storage.js";
import { mariaDbAttachmentRepository, type AttachmentRepository } from "./attachment-repository.js";

export function createAttachmentService(repository: AttachmentRepository = mariaDbAttachmentRepository) {
  return {
    list: (orderId: number) => repository.listByOrder(orderId),
    async content(attachmentId: number) {
      const attachment = await repository.findContent(attachmentId);
      if (!attachment) throw new AppError(404, "ATTACHMENT_NOT_FOUND", "El adjunto no existe.");
      return { attachment, file: await readStoredFile(attachment.storageProvider, attachment.objectKey) };
    },
    async upload(input: { orderId: number; userId: number; category: string; file: Express.Multer.File; requestId: string; ipAddress?: string; userAgent?: string }) {
      if (!await repository.orderExists(input.orderId)) throw new AppError(404, "ORDER_NOT_FOUND", "La orden no existe.");
      const stored = await storeFile(input.file);
      try {
        const id = await repository.create({ ...input, originalName: input.file.originalname, mimeType: input.file.mimetype, stored });
        return { id, category: input.category, originalName: input.file.originalname };
      } catch (error) { await deleteStoredFile(stored.provider, stored.objectKey); throw error; }
    },
  };
}

export const attachmentService = createAttachmentService();
