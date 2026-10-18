import { describe, expect, it, vi } from "vitest";

vi.mock("../../db/pool.js", () => ({ getPool: () => ({ query: vi.fn() }) }));

import { bootstrapEmailPolicy, bootstrapIpPolicy, loginIdentifierPolicy, loginIpPolicy, normalizedIdentifier } from "./security.js";

describe("authentication hardening policies", () => {
  it("normalizes the account key and keeps account limits stricter than IP limits", () => {
    expect(normalizedIdentifier("  Asesor01@ParaAutos.pe ")).toBe("asesor01@paraautos.pe");
    expect(loginIdentifierPolicy.maxAttempts).toBeLessThan(loginIpPolicy.maxAttempts);
    expect(bootstrapEmailPolicy.maxAttempts).toBeLessThanOrEqual(bootstrapIpPolicy.maxAttempts);
  });
});
