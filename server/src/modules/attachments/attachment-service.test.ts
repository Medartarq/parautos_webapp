import { describe, expect, it, vi } from "vitest";
import { createAttachmentService } from "./attachment-service.js";
import type { AttachmentRepository } from "./attachment-repository.js";

vi.mock("./storage.js", () => ({ readStoredFile: vi.fn().mockResolvedValue(Buffer.from("file")), storeFile: vi.fn(), deleteStoredFile: vi.fn() }));
describe("attachment service", () => {
  it("reads metadata through its repository before the storage port", async () => {
    const repository: AttachmentRepository = { listByOrder: vi.fn(), findContent: vi.fn().mockResolvedValue({ storageProvider: "local", objectKey: "a.png", mimeType: "image/png", originalName: "a.png" }), orderExists: vi.fn(), create: vi.fn() };
    await expect(createAttachmentService(repository).content(1)).resolves.toMatchObject({ attachment: { objectKey: "a.png" }, file: Buffer.from("file") });
  });
});
