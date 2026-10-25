export type StorageProvider = "local" | "s3";

export type StoredFile = {
  provider: StorageProvider;
  objectKey: string;
  sha256: string;
  byteSize: number;
};

/** Contract used by attachment use cases, independent from the backing provider. */
export interface AttachmentStorage {
  storeFile(file: Express.Multer.File): Promise<StoredFile>;
  storeSignature(buffer: Buffer): Promise<StoredFile>;
  readFile(objectKey: string): Promise<Buffer>;
  deleteFile(objectKey: string): Promise<void>;
}
