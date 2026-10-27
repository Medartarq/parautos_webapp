import { describe, expect, it, vi } from "vitest";
import { mariaDbAuditWriter } from "./audit-writer.js";

describe("MariaDB audit writer", () => {
  it("keeps audit metadata and null optional values", async () => {
    const connection = { query: vi.fn().mockResolvedValue(undefined) };
    await mariaDbAuditWriter.append(connection as any, { actorUserId: 1, entity: "service_order", recordId: "2", action: "CREATED", requestId: "request" });
    expect(connection.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO audit_events"), [1, "service_order", "2", "CREATED", null, null, "request", null, null]);
  });
});
