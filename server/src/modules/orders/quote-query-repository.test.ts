import { describe, expect, it, vi } from "vitest";
import { listQuotes } from "./quote-service.js";
import type { QuoteQueryRepository } from "./quote-query-repository.js";
describe("quote query repository port", () => { it("maps versions with a fake repository", async () => { const repository: QuoteQueryRepository = { listVersions: vi.fn().mockResolvedValue([{ id: 1, noParts: 1 }]), listLines: vi.fn().mockResolvedValue([{ quantity: "2", unitPrice: "3" }]) }; await expect(listQuotes(1, repository)).resolves.toMatchObject([{ noParts: true, totalWithoutIgv: 6 }]); }); });
