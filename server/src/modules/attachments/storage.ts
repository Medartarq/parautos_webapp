import { getEnvironment } from "../../config/env.js";
import { deleteLocalFile, getLocalUploadRoot, storeLocalFile, storeLocalSignature } from "./local-storage.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AttachmentStorage, StorageProvider, StoredFile } from "./storage-port.js";

export type { AttachmentStorage, StorageProvider, StoredFile } from "./storage-port.js";

const localStorage: AttachmentStorage = {
  storeFile: storeLocalFile,
  storeSignature: storeLocalSignature,
  readFile: (objectKey) => readFile(join(getLocalUploadRoot(), objectKey)),
  deleteFile: deleteLocalFile,
};

let s3Storage: Promise<AttachmentStorage> | undefined;

async function storageFor(provider: StorageProvider): Promise<AttachmentStorage> {
  if (provider === "local") return localStorage;
  s3Storage ??= import("./s3-storage.js").then(({ deleteS3File, readS3File, storeS3Buffer, storeS3File }) => ({
    storeFile: storeS3File,
    storeSignature: (buffer) => storeS3Buffer(buffer, ".png", "image/png"),
    readFile: readS3File,
    deleteFile: deleteS3File,
  }));
  return s3Storage;
}

function configuredStorage(): Promise<AttachmentStorage> {
  return storageFor(getEnvironment().STORAGE_PROVIDER);
}

export async function storeFile(file: Express.Multer.File): Promise<StoredFile> {
  return (await configuredStorage()).storeFile(file);
}

export async function storeSignature(buffer: Buffer): Promise<StoredFile> {
  return (await configuredStorage()).storeSignature(buffer);
}

export async function readStoredFile(provider: StorageProvider, objectKey: string): Promise<Buffer> {
  return (await storageFor(provider)).readFile(objectKey);
}

export async function deleteStoredFile(provider: StorageProvider, objectKey: string): Promise<void> {
  return (await storageFor(provider)).deleteFile(objectKey);
}
