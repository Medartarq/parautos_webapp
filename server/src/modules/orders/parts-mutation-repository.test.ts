import { describe, expect, it, vi } from "vitest";
import { startRepair } from "./parts-service.js";
import type { PartsMutationRepository } from "./parts-mutation-repository.js";

describe("parts mutation repository port", () => {
  it("delegates repair start without a database", async () => {
    const repository: PartsMutationRepository = { updatePart: vi.fn(), updateLogistics: vi.fn(), startRepair: vi.fn() };
    await startRepair(1, 2, "request", undefined, undefined, repository);
    expect(repository.startRepair).toHaveBeenCalledWith(1, 2, "request", undefined, undefined);
  });
});
