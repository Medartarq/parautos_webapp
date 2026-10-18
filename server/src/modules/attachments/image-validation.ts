const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type SupportedImageMime = "image/jpeg" | "image/png" | "image/webp";

export function detectImageMime(buffer: Buffer): SupportedImageMime | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return "image/jpeg";
  if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE))
    return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  return undefined;
}

export function hasDeclaredImageContent(file: Pick<Express.Multer.File, "buffer" | "mimetype">): boolean {
  return detectImageMime(file.buffer) === file.mimetype;
}
