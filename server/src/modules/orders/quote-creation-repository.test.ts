import { describe, expect, it, vi } from "vitest";
import { createQuote } from "./quote-service.js";
import type { QuoteCreationRepository } from "./quote-creation-repository.js";

describe("quote creation repository port", () => {
  it("delegates the unchanged use-case input to its repository", async () => {
    const repository: QuoteCreationRepository = { create: vi.fn().mockResolvedValue({ id: 5, versionNumber: 1, totalWithoutIgv: 10, igv: 0 }) };
    const input = { currency: "PEN" as const, noParts: true, lines: [{ type: "MANO_OBRA" as const, category: "PINTURA" as const, description: "Pintura", quantity: 1, unitPrice: 10 }] };
    await expect(createQuote(2, input, 3, "request", undefined, undefined, repository)).resolves.toMatchObject({ id: 5 });
    expect(repository.create).toHaveBeenCalledWith(2, input, 3, "request", undefined, undefined);
  });
});
