import { describe, expect, it, vi } from "vitest";
import { createAuditService } from "./service.js";
import type { AuditRepository } from "./audit-repository.js";

describe("audit service", () => {
  it("builds filter criteria independently from MariaDB", async () => {
    const repository: AuditRepository = { listEvents: vi.fn().mockResolvedValue([]), countEvents: vi.fn().mockResolvedValue([{ total: 0 }]), listActions: vi.fn().mockResolvedValue([{ action: "CREATED" }]), listUsers: vi.fn().mockResolvedValue([]) };
    await expect(createAuditService(repository)({ text: "orden", userId: 3, from: "2026-01-01", to: "2026-01-31", page: 1, pageSize: 10 })).resolves.toEqual({ events: [], actions: ["CREATED"], users: [], pagination: { page: 1, pageSize: 10, total: 0, pages: 1 } });
    expect(repository.listEvents).toHaveBeenCalledWith(expect.stringContaining("ae.actor_user_id = ?"), ["%orden%", "%orden%", "%orden%", "%orden%", 3, "2026-01-01 00:00:00", "2026-01-31"], 10, 0);
  });
});
