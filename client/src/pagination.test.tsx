import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { Pagination } from "./pagination";

const controls = { page: 1, pageSize: 10, params: "", setPage: vi.fn(), setPageSize: vi.fn() };
it("shows full totals and only the permitted sizes on the last partial page", () => {
  const html = renderToStaticMarkup(<Pagination controls={controls} info={{ page: 3, pageSize: 10, total: 24, pages: 3 }} />);
  expect(html).toContain("Mostrando 21–24 de 24");
  expect(html).toMatch(/class="btn small active"[^>]*>3<\/button>/);
  expect(html.match(/<option /g)).toHaveLength(3);
  expect(html).toMatch(/disabled=""[^>]*>Siguiente/);
  expect(html).toMatch(/disabled=""[^>]*>Última »/);
  expect(html.match(/disabled=""/g)).toHaveLength(2);
});
it("does not display a phantom first result when there are no matches", () => {
  const html = renderToStaticMarkup(<Pagination controls={controls} info={{ page: 1, pageSize: 10, total: 0, pages: 1 }} />);
  expect(html).toContain("Mostrando 0–0 de 0");
  expect(html.match(/disabled=""/g)).toHaveLength(4);
});
