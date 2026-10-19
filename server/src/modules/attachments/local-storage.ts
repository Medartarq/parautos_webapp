import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, isAbsolute, join } from "node:path";
import { getEnvironment } from "../../config/env.js";
import { isDemoScope } from "../../db/pool.js";

export function getLocalUploadRoot(): string {
  const env = getEnvironment();
  const demo = isDemoScope();
  const relativeDirectory = (demo ? env.DEMO_LOCAL_UPLOAD_DIR : env.LOCAL_UPLOAD_DIR)!.replace(/\\/g, "/");
  if (isAbsolute(relativeDirectory) || relativeDirectory.split("/").includes(".."))
    throw new Error("LOCAL_UPLOAD_DIR debe ser una ruta relativa sin segmentos '..'.");
  const baseDirectory = (demo ? env.DEMO_LOCAL_UPLOAD_BASE : env.LOCAL_UPLOAD_BASE) === "home" ? process.env.HOME : process.cwd();
  if (!baseDirectory)
    throw new Error("HOME es obligatorio cuando LOCAL_UPLOAD_BASE=home.");
  return join(baseDirectory, relativeDirectory);
}

async function storeBuffer(buffer: Buffer, extension: string) {
  const objectKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
  const root = getLocalUploadRoot();
  await mkdir(join(root, objectKey.split("/")[0]), { recursive: true, mode: 0o700 });
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
  const root = getLocalUploadRoot();
  try {
    await unlink(join(root, objectKey));
  } catch (error: unknown) {
    if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
