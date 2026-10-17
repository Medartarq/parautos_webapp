import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { getEnvironment } from "../../config/env.js";

async function storeBuffer(buffer: Buffer, extension: string) {
  const env = getEnvironment();
  const objectKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
  const root = join(process.cwd(), env.LOCAL_UPLOAD_DIR);
  await mkdir(join(root, objectKey.split("/")[0]), { recursive: true });
  await writeFile(join(root, objectKey), buffer, { flag: "wx" });
  return { provider: "local" as const, objectKey, sha256: createHash("sha256").update(buffer).digest("hex"), byteSize: buffer.length };
}

export async function storeLocalFile(file: Express.Multer.File) {
  return storeBuffer(file.buffer, extname(file.originalname).toLowerCase() || ".bin");
}

export async function storeLocalSignature(buffer: Buffer) {
  return storeBuffer(buffer, ".png");
}

export async function deleteLocalFile(objectKey: string): Promise<void> {
  const root = join(process.cwd(), getEnvironment().LOCAL_UPLOAD_DIR);
  try {
    await unlink(join(root, objectKey));
  } catch (error: unknown) {
    if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
