import { describe, expect, it, vi } from "vitest";
import { deliverOrder, publishReadyForPickup } from "./final-control-service.js";
import type { FinalControlDeliveryRepository } from "./final-control-delivery-repository.js";
describe("final control delivery repository port", () => { it("delegates final transitions", async () => { const repository: FinalControlDeliveryRepository = { publish: vi.fn(), deliver: vi.fn() }; const context = { actorUserId: 2, requestId: "r" }; await publishReadyForPickup(1, { channel: "sms" }, context, repository); await deliverOrder(1, context, repository); expect(repository.publish).toHaveBeenCalledWith(1, { channel: "sms" }, context, expect.anything()); expect(repository.deliver).toHaveBeenCalledWith(1, context, expect.anything()); }); });
