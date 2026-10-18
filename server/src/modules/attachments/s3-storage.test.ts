import { beforeEach, describe, expect, it, vi } from "vitest";

const aws = vi.hoisted(() => {
  const send = vi.fn();
  class Command { constructor(readonly input: Record<string, unknown>) {} }
  return { send, S3Client: class { send = send; }, PutObjectCommand: Command, GetObjectCommand: Command, DeleteObjectCommand: Command };
});

vi.mock("@aws-sdk/client-s3", () => aws);
vi.mock("../../config/env.js", () => ({
  getEnvironment: () => ({
    STORAGE_PROVIDER: "s3", S3_BUCKET: "parautos-files", S3_ACCESS_KEY_ID: "key", S3_SECRET_ACCESS_KEY: "secret",
    S3_REGION: "auto", S3_ENDPOINT: "https://account.r2.cloudflarestorage.com", S3_PREFIX: "production/parautos", S3_FORCE_PATH_STYLE: false,
  }),
}));

import { deleteS3File, readS3File, storeS3Buffer } from "./s3-storage.js";

describe("S3-compatible attachment storage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes to the configured bucket and prefix with a checksum", async () => {
    aws.send.mockResolvedValue({});
    const stored = await storeS3Buffer(Buffer.from("firma"), ".png", "image/png");

    expect(stored).toMatchObject({ provider: "s3", byteSize: 5, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(aws.send).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        Bucket: "parautos-files",
        Key: expect.stringMatching(/^production\/parautos\/\d{4}-\d{2}-\d{2}\//),
        ContentType: "image/png",
      }),
    }));
  });

  it("reads and deletes the provider object using the stored logical key", async () => {
    aws.send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } }).mockResolvedValueOnce({});

    await expect(readS3File("2026-10-17/file.png")).resolves.toEqual(Buffer.from([1, 2, 3]));
    await deleteS3File("2026-10-17/file.png");

    expect(aws.send).toHaveBeenNthCalledWith(1, expect.objectContaining({ input: { Bucket: "parautos-files", Key: "production/parautos/2026-10-17/file.png" } }));
    expect(aws.send).toHaveBeenNthCalledWith(2, expect.objectContaining({ input: { Bucket: "parautos-files", Key: "production/parautos/2026-10-17/file.png" } }));
  });
});
