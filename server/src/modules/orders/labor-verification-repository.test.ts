import { describe, expect, it, vi } from "vitest";
import { setLaborVerification } from "./final-control-service.js";
import type { LaborVerificationRepository } from "./labor-verification-repository.js";
describe("labor verification repository port", () => { it("delegates the verification context", async () => { const repository: LaborVerificationRepository = { setOne: vi.fn(), setAll: vi.fn() }; await setLaborVerification(1, 2, true, { actorUserId: 3, requestId: "r" }, repository); expect(repository.setOne).toHaveBeenCalledWith(1, 2, true, { actorUserId: 3, requestId: "r" }, expect.anything()); }); });
