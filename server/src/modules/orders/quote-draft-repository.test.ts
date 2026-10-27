import { describe, expect, it, vi } from "vitest";
import { getQuoteDraft } from "./quote-service.js";
import type { QuoteDraftRepository } from "./quote-draft-repository.js";

describe("quote draft repository port", () => {
  it("lets the use case map MariaDB decimal fields without a pool", async () => {
    const repository: QuoteDraftRepository = { findDraft: vi.fn().mockResolvedValue({ id: 4, noParts: 0 }), findLines: vi.fn().mockResolvedValue([{ quantity: "2.5", unitPrice: "10.00" }]), save: vi.fn() };
    await expect(getQuoteDraft(7, repository)).resolves.toEqual({ id: 4, noParts: false, lines: [{ quantity: 2.5, unitPrice: 10 }] });
    expect(repository.findLines).toHaveBeenCalledWith(4);
  });
});
