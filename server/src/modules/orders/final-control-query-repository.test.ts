import { describe, expect, it, vi } from "vitest";
import { getFinalControl } from "./final-control-service.js";
import type { FinalControlQueryRepository } from "./final-control-query-repository.js";

describe("final control query repository port", () => {
  it("maps read data without a MariaDB pool", async () => {
    const repository: FinalControlQueryRepository = { findOrder: vi.fn().mockResolvedValue({ internalStatus: "EN_REPARACION" }), listLabor: vi.fn().mockResolvedValue([{ verified: 1 }]), listPendingParts: vi.fn().mockResolvedValue([]), findRecord: vi.fn().mockResolvedValue(undefined) };
    await expect(getFinalControl(1, repository)).resolves.toEqual({ internalStatus: "EN_REPARACION", labor: [{ verified: true }], pendingParts: [], record: null });
  });
});
