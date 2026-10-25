import { afterEach, describe, expect, it, vi } from "vitest";

describe("attachment storage port", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../../config/env.js");
    vi.doUnmock("./local-storage.js");
    vi.doUnmock("./s3-storage.js");
  });

  it("uses local storage without loading or validating S3", async () => {
    const storeLocalFile = vi.fn().mockResolvedValue({ provider: "local", objectKey: "2026-10-25/file.png", sha256: "a".repeat(64), byteSize: 1 });
    vi.doMock("../../config/env.js", () => ({ getEnvironment: () => ({ STORAGE_PROVIDER: "local" }) }));
    vi.doMock("./local-storage.js", () => ({ storeLocalFile, storeLocalSignature: vi.fn(), deleteLocalFile: vi.fn(), getLocalUploadRoot: vi.fn() }));
    vi.doMock("./s3-storage.js", () => { throw new Error("S3 must not load for local storage"); });

    const { storeFile } = await import("./storage.js");
    await expect(storeFile({} as Express.Multer.File)).resolves.toMatchObject({ provider: "local" });
    expect(storeLocalFile).toHaveBeenCalledOnce();
  });
});
