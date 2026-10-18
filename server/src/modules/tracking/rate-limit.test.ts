import { describe, expect, it, vi } from "vitest";
import { consumeRateLimit } from "./rate-limit.js";

describe("persistent public rate limit", () => {
  it("uses an anonymized client key and allows attempts within the configured window", async () => {
    const query = vi.fn(async (sql: string) => sql.startsWith("SELECT") ? [{ attempts: 10 }] : {});
    await expect(consumeRateLimit("tracking", "203.0.113.14", { windowSeconds: 60, maxAttempts: 10 }, { query })).resolves.toEqual({ attempts: 10, limited: false });

    const upsert = query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO api_rate_limits"));
    expect(upsert?.[1]).toEqual(["tracking", expect.stringMatching(/^[a-f0-9]{64}$/)]);
    expect((upsert?.[1] as unknown[] | undefined)?.[1]).not.toBe("203.0.113.14");
  });

  it("rejects attempts that exceed the persisted window limit", async () => {
    const query = vi.fn(async (sql: string) => sql.startsWith("SELECT") ? [{ attempts: 11 }] : {});
    await expect(consumeRateLimit("tracking", "203.0.113.14", { windowSeconds: 60, maxAttempts: 10 }, { query })).resolves.toEqual({ attempts: 11, limited: true });
  });
});
