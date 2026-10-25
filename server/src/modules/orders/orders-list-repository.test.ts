import { describe, expect, it, vi } from "vitest";
import { getReceptionCatalog, listOrders } from "./orders-service.js";
import type { OrdersListRepository } from "./orders-list-repository.js";
describe("orders list repository port", () => { it("delegates catalog and list reads", async () => { const repository: OrdersListRepository = { listBodyTypes: vi.fn().mockResolvedValue([]), listChecklist: vi.fn().mockResolvedValue([]), listOrders: vi.fn().mockResolvedValue([{ id: 1 }]) }; await expect(getReceptionCatalog(repository)).resolves.toEqual({ bodyTypes: [], checklist: [] }); await expect(listOrders(repository)).resolves.toEqual([{ id: 1 }]); }); });
