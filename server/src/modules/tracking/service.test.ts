import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ pool: { query: vi.fn() } }));
vi.mock("../../db/pool.js", () => ({ getPool: () => database.pool }));

import { getPublicTracking } from "./service.js";

describe("public tracking lookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks up the normalized plate with the plaintext six-digit public code and returns only the public projection", async () => {
    database.pool.query.mockResolvedValueOnce([{ orderNumber: "OS-2026-00001", plate: "ABC123", brand: "TOYOTA", model: "COROLLA", publicStatus: "EN_REPARACION" }]);

    await expect(getPublicTracking({ plate: "ABC123", code: "123456" })).resolves.toEqual({ orderNumber: "OS-2026-00001", plate: "ABC123", brand: "TOYOTA", model: "COROLLA", publicStatus: "EN_REPARACION" });
    expect(database.pool.query).toHaveBeenCalledWith(
      expect.stringContaining("o.public_status AS publicStatus"),
      ["123456", "ABC123"],
    );
    expect(database.pool.query.mock.calls[0][0]).not.toContain("claim_number");
    expect(database.pool.query.mock.calls[0][0]).not.toContain("clients");
    expect(database.pool.query.mock.calls[0][0]).not.toContain("advisor");
  });

  it("does not disclose a result when the plate and code do not match", async () => {
    database.pool.query.mockResolvedValueOnce([]);
    await expect(getPublicTracking({ plate: "ABC123", code: "123456" })).resolves.toBeNull();
  });
});
