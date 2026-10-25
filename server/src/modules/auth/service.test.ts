import { describe, expect, it, vi } from "vitest";
import { createSessionService } from "./service.js";
import type { SessionRepository } from "./session-repository.js";

describe("session service", () => {
  it("uses its repository port to revoke a hashed session token", async () => {
    const repository: SessionRepository = {
      findActiveUser: vi.fn(), createSession: vi.fn(), findCurrentUser: vi.fn(), touchSession: vi.fn(), revokeSession: vi.fn(),
    };
    await createSessionService(repository).logout("session-token");
    expect(repository.revokeSession).toHaveBeenCalledWith("c101e911469c969171040b50d70543313cf968fdef5bacc780776f8fb399ab36");
  });

  it("does not touch a missing session", async () => {
    const repository: SessionRepository = {
      findActiveUser: vi.fn(), createSession: vi.fn(), findCurrentUser: vi.fn().mockResolvedValue(undefined), touchSession: vi.fn(), revokeSession: vi.fn(),
    };
    await expect(createSessionService(repository).getCurrentUser("missing")).resolves.toBeUndefined();
    expect(repository.touchSession).not.toHaveBeenCalled();
  });
});
