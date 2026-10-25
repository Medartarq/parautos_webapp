import { describe, expect, it, vi } from "vitest";
const log = vi.hoisted(() => ({ failure: vi.fn() }));
vi.mock("../logging/technical-logger.js", () => ({ technicalLogger: log }));
import { releaseConnection } from "./release-connection.js";

describe("connection cleanup", () => {
  it("waits for release to finish before completing", async () => {
    let finish!: () => void;
    const connection = { release: vi.fn(() => new Promise<void>((resolve) => { finish = resolve; })), destroy: vi.fn() };
    let completed = false;
    const pending = releaseConnection(connection).then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    finish();
    await pending;
    expect(completed).toBe(true);
    expect(connection.destroy).not.toHaveBeenCalled();
  });

  it("discards a connection whose release fails without rejecting cleanup", async () => {
    const error = new Error("synthetic release failure");
    const connection = { release: vi.fn().mockRejectedValue(error), destroy: vi.fn() };
    await expect(releaseConnection(connection)).resolves.toBeUndefined();
    expect(connection.destroy).toHaveBeenCalledOnce();
    expect(log.failure).toHaveBeenCalledWith("database_connection_release_failed", error);
  });

  it("also handles synchronous discard errors without masking the original failure", async () => {
    const error = new Error("synthetic destroy failure");
    const connection = { release: vi.fn().mockRejectedValue(new Error("release")), destroy: vi.fn(() => { throw error; }) };
    await expect(releaseConnection(connection)).resolves.toBeUndefined();
    expect(log.failure).toHaveBeenCalledWith("database_connection_destroy_failed", error);
  });
});
