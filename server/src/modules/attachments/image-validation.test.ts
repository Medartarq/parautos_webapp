import { describe, expect, it } from "vitest";
import { detectImageMime, hasDeclaredImageContent } from "./image-validation.js";

describe("attachment binary image validation", () => {
  it.each([
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
    [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"],
    [Buffer.from("RIFF\x24\x00\x00\x00WEBPVP8 ", "binary"), "image/webp"],
  ] as const)("detects the %s binary signature", (buffer, mimeType) => {
    expect(detectImageMime(buffer)).toBe(mimeType);
  });

  it("rejects arbitrary bytes and declared MIME mismatches", () => {
    expect(detectImageMime(Buffer.from("not an image"))).toBeUndefined();
    expect(hasDeclaredImageContent({ buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), mimetype: "image/jpeg" } as Express.Multer.File)).toBe(false);
  });
});
