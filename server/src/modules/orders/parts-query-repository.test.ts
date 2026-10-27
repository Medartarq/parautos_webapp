import { describe, expect, it, vi } from "vitest";
import { getPartsLogistics, listParts } from "./parts-service.js";
import type { PartsQueryRepository } from "./parts-query-repository.js";
describe("parts query repository port", () => { it("maps reads without MariaDB", async () => { const repository: PartsQueryRepository = { listParts: vi.fn().mockResolvedValue([{ quantity: "2", receivedQuantity: "1", freightRequested: 1 }]), listProviders: vi.fn(), findLogistics: vi.fn().mockResolvedValue(undefined) }; await expect(listParts(undefined, repository)).resolves.toMatchObject([{ quantity: 2, receivedQuantity: 1, partiallyReceived: false }]); await expect(getPartsLogistics(1, repository)).resolves.toMatchObject({ freightRequested: false }); }); });
