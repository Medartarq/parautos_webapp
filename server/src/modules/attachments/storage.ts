import { getEnvironment } from "../../config/env.js";
import { deleteLocalFile, storeLocalFile, storeLocalSignature } from "./local-storage.js";
import { deleteS3File, readS3File, storeS3Buffer, storeS3File } from "./s3-storage.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type StorageProvider = "local" | "s3";
export type StoredFile = { provider: StorageProvider; objectKey: string; sha256: string; byteSize: number };

export async function storeFile(file: Express.Multer.File): Promise<StoredFile> {
  return getEnvironment().STORAGE_PROVIDER === "s3" ? storeS3File(file) : storeLocalFile(file);
}

export async function storeSignature(buffer: Buffer): Promise<StoredFile> {
  return getEnvironment().STORAGE_PROVIDER === "s3"
    ? storeS3Buffer(buffer, ".png", "image/png")
    : storeLocalSignature(buffer);
}

export async function readStoredFile(provider: StorageProvider, objectKey: string): Promise<Buffer> {
  if (provider === "s3") return readS3File(objectKey);
  return readFile(join(process.cwd(), getEnvironment().LOCAL_UPLOAD_DIR, objectKey));
}

export async function deleteStoredFile(provider: StorageProvider, objectKey: string): Promise<void> {
  if (provider === "s3") return deleteS3File(objectKey);
  return deleteLocalFile(objectKey);
}
