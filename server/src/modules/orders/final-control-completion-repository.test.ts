import { describe, expect, it, vi } from "vitest";
import { completeFinalControl } from "./final-control-service.js";
import type { FinalControlCompletionRepository } from "./final-control-completion-repository.js";
describe("final control completion repository port", () => { it("delegates the completion context", async () => { const repository: FinalControlCompletionRepository = { complete: vi.fn() }; await completeFinalControl(1, { actorUserId: 2, requestId: "r" }, repository); expect(repository.complete).toHaveBeenCalledWith(1, { actorUserId: 2, requestId: "r" }, expect.anything()); }); });
