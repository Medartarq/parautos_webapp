import { beforeEach, describe, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../db/pool.js", () => ({ getPool: () => database }));
import { buildListFilter, exportReportRows, listPage, listQuerySchema } from "./paginated-lists.js";

describe("bounded operational lists", () => {
  beforeEach(() => vi.clearAllMocks());
  it("defaults to ten and rejects attempts to bypass the permitted sizes", () => {
    expect(listQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 10 });
    for (const size of ["10", "20", "30"]) expect(listQuerySchema.parse({ pageSize: size }).pageSize).toBe(Number(size));
    for (const pageSize of ["0", "5", "31", "1000", "all", "10.5", ["10", "30"]]) expect(listQuerySchema.safeParse({ pageSize }).success).toBe(false);
    for (const page of ["0", "-1", "1.5", "Infinity"]) expect(listQuerySchema.safeParse({ page }).success).toBe(false);
  });
  it("applies search and filters before counting and paging, with bound parameters", async () => {
    const search = "%' OR 1=1 --";
    database.query.mockResolvedValueOnce([{ total: 42 }]).mockResolvedValueOnce([{ id: 30 }]);
    const result = await listPage("orders", listQuerySchema.parse({ page: "3", pageSize: "20", search, status: "EN_REPARACION" }));
    expect(result.pagination).toEqual({ page: 3, pageSize: 20, total: 42, pages: 3 });
    const [countSql, countValues] = database.query.mock.calls[0];
    const [rowsSql, rowsValues] = database.query.mock.calls[1];
    expect(countSql).toContain("LIKE ?");
    expect(countSql).not.toContain(search);
    expect(rowsSql).toContain("status = ? ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?");
    expect(countValues).toEqual([`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, "EN_REPARACION"]);
    expect(rowsValues).toEqual([`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, "EN_REPARACION", 20, 40]);
  });
  it("clamps an out-of-range page after results shrink and handles an empty list", async () => {
    database.query.mockResolvedValueOnce([{ total: 11 }]).mockResolvedValueOnce([{ id: 1 }]);
    expect((await listPage("orders", listQuerySchema.parse({ page: "99" }))).pagination).toEqual({ page: 2, pageSize: 10, total: 11, pages: 2 });
    expect(database.query.mock.calls[1][1]).toEqual([10, 10]);
    database.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    expect((await listPage("orders", listQuerySchema.parse({ page: "99" }))).pagination).toEqual({ page: 1, pageSize: 10, total: 0, pages: 1 });
  });
  it("handles received parts, missing providers and inclusive date ranges", () => {
    const filter = buildListFilter("parts", listQuerySchema.parse({ status: "RECIBIDO", provider: "NO_PROVIDER", from: "2026-10-01", to: "2026-10-31" }));
    expect(filter.where).toContain("receivedQuantity >= quantity");
    expect(filter.where).toContain("providerId IS NULL");
    expect(filter.where).toContain("expectedDate < DATE_ADD(?, INTERVAL 1 DAY)");
    expect(filter.values).toEqual(["RECIBIDO", "2026-10-01", "2026-10-31"]);
  });
  it("exports every matching row with the same filters, independent of the visible page", async () => {
    database.query.mockResolvedValueOnce(Array.from({ length: 42 }, (_, id) => ({ id })));
    const query = listQuerySchema.parse({ page: "3", search: "Toyota", advisor: "Asesor demo", age: "OVERDUE" });
    expect(await exportReportRows("reportQuotes", query)).toHaveLength(42);
    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain(buildListFilter("reportQuotes", query).where);
    expect(sql).not.toContain("LIMIT");
    expect(values).toEqual(["%Toyota%", "%Toyota%", "%Toyota%", "%Toyota%", "%Toyota%", "Asesor demo"]);
  });
});
