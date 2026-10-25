import { describe, expect, it, vi } from "vitest";
import { deleteQuote, updateQuote } from "./quote-service.js";
import type { QuoteMutationRepository } from "./quote-mutation-repository.js";

describe("quote mutation repository port", () => {
  it("delegates update and deletion without changing their public results", async () => {
    const repository: QuoteMutationRepository = { update: vi.fn().mockResolvedValue({ id: 2, versionNumber: 1, totalWithoutIgv: 1, igv: 0 }), delete: vi.fn().mockResolvedValue(undefined) };
    const input = { currency: "PEN" as const, noParts: true, lines: [] };
    await expect(updateQuote(1, 2, input, 3, "r", undefined, undefined, repository)).resolves.toMatchObject({ id: 2 });
    await expect(deleteQuote(1, 2, 3, "r", undefined, undefined, repository)).resolves.toBeUndefined();
  });
});
