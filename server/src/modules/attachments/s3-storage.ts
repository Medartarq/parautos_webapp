import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";
import { getEnvironment } from "../../config/env.js";

function configuration() {
  const env = getEnvironment();
  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)
    throw new Error("S3_BUCKET, S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY son obligatorios cuando STORAGE_PROVIDER=s3.");
  return env as typeof env & {
    S3_BUCKET: string;
    S3_ACCESS_KEY_ID: string;
    S3_SECRET_ACCESS_KEY: string;
  };
}

function objectName(objectKey: string) {
  const rawPrefix = getEnvironment().S3_PREFIX;
  let start = 0;
  let end = rawPrefix.length;
  while (start < end && rawPrefix[start] === "/") start++;
  while (end > start && rawPrefix[end - 1] === "/") end--;
  const prefix = rawPrefix.slice(start, end);
  return prefix ? `${prefix}/${objectKey}` : objectKey;
}

let client: S3Client | undefined;
function getClient() {
  if (client) return client;
  const env = configuration();
  client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  return client;
}

export async function storeS3Buffer(buffer: Buffer, extension: string, contentType: string) {
  const env = configuration();
  const objectKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
  await getClient().send(new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: objectName(objectKey),
    Body: buffer,
    ContentType: contentType,
  }));
  return { provider: "s3" as const, objectKey, sha256: createHash("sha256").update(buffer).digest("hex"), byteSize: buffer.length };
}

export async function storeS3File(file: Express.Multer.File) {
  return storeS3Buffer(file.buffer, extname(file.originalname).toLowerCase() || ".bin", file.mimetype);
}

export async function readS3File(objectKey: string): Promise<Buffer> {
  const env = configuration();
  const response = await getClient().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectName(objectKey) }));
  if (!response.Body) throw new Error("El objeto S3 no contiene contenido.");
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function deleteS3File(objectKey: string): Promise<void> {
  const env = configuration();
  await getClient().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: objectName(objectKey) }));
}
