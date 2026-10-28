import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ pool: { query: vi.fn() } }));
vi.mock("../../db/pool.js", () => ({ getPool: () => database.pool }));

import { getOperationalPendingNotifications } from "./service.js";

describe("operational pending notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps full counts while returning only the eight visible priorities", async () => {
    database.pool.query.mockResolvedValueOnce(Array.from({ length: 8 }, (_, id) => ({ id, groupTotal: 100 }))).mockResolvedValueOnce([{ id: 20, groupTotal: 50 }]);
    const result = await getOperationalPendingNotifications();
    expect(result).toMatchObject({ total: 150, diagnosisCount: 100, quoteCount: 50 });
    expect(result.diagnosisPending).toHaveLength(8);
    expect(result.quotePending).toHaveLength(0);
    expect(result.diagnosisPending[0]).not.toHaveProperty("groupTotal");
    expect(database.pool.query.mock.calls.every(([sql]) => String(sql).includes("LIMIT 8"))).toBe(true);
  });

  it("returns diagnosis and quote pending groups with their combined total", async () => {
    database.pool.query
      .mockResolvedValueOnce([{ id: 7, orderNumber: "OS-2026-00007", plate: "ABC123" }])
      .mockResolvedValueOnce([
        { id: 8, orderNumber: "OS-2026-00008", plate: "DEF456" },
        { id: 9, orderNumber: "OS-2026-00009", plate: "GHI789" },
      ]);

    await expect(getOperationalPendingNotifications()).resolves.toEqual({
      total: 3,
      diagnosisCount: 1,
      quoteCount: 2,
      diagnosisPending: [{ id: 7, orderNumber: "OS-2026-00007", plate: "ABC123" }],
      quotePending: [
        { id: 8, orderNumber: "OS-2026-00008", plate: "DEF456" },
        { id: 9, orderNumber: "OS-2026-00009", plate: "GHI789" },
      ],
    });
    expect(database.pool.query).toHaveBeenCalledTimes(2);
    expect(String(database.pool.query.mock.calls[0][0])).toContain("diagnosis_pending_reminder = 1");
    expect(String(database.pool.query.mock.calls[1][0])).toContain("NOT EXISTS (SELECT 1 FROM quote_versions");
  });
});
