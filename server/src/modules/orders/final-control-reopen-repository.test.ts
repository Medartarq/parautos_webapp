import { describe, expect, it, vi } from "vitest";
import { reopenFinalControl } from "./final-control-service.js";
import type { FinalControlReopenRepository } from "./final-control-reopen-repository.js";
describe("final control reopen repository port", () => { it("delegates the reason and context", async () => { const repository: FinalControlReopenRepository = { reopen: vi.fn() }; await reopenFinalControl(1, "motivo", { actorUserId: 2, requestId: "r" }, repository); expect(repository.reopen).toHaveBeenCalledWith(1, "motivo", { actorUserId: 2, requestId: "r" }, expect.anything()); }); });
