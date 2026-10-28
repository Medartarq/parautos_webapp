import { useState } from "react";
import "./pagination.css";
export type PageInfo = { page: number; pageSize: number; total: number; pages: number };
export function usePagination(filters: Record<string, string>) {
  const key = JSON.stringify(filters);
  const [state, setState] = useState({ key, page: 1, pageSize: 10 });
  if (state.key !== key) setState({ ...state, key, page: 1 });
  const page = state.key === key ? state.page : 1;
  const pageSize = state.pageSize;
  const setPage = (next: number) => setState({ key, page: next, pageSize });
  const setPageSize = (next: number) => setState({ key, page: 1, pageSize: next });
  const params = new URLSearchParams({ ...filters, page: String(page), pageSize: String(pageSize) });
  return { page, pageSize, setPage, setPageSize, params: params.toString() };
}
export function Pagination({ info, controls, busy = false }: { info?: PageInfo; controls: ReturnType<typeof usePagination>; busy?: boolean }) {
  const total = info?.total ?? 0; const page = info?.page ?? controls.page; const pages = info?.pages ?? 1;
  return <nav className="pagination" aria-label="Paginación de resultados">
    <span className="pagination-summary" aria-live="polite">{busy ? "Cargando resultados…" : `Mostrando ${total ? (page - 1) * controls.pageSize + 1 : 0}–${Math.min(page * controls.pageSize, total)} de ${total}`}</span>
    <div className="pagination-controls">
    <label className="pagination-size">Resultados por página<select value={controls.pageSize} onChange={(event) => controls.setPageSize(Number(event.target.value))}>{[10, 20, 30].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
    <div className="pagination-navigation">
    <button type="button" className="btn small" disabled={busy || page <= 1} onClick={() => controls.setPage(page - 1)}>Anterior</button>
    <span className="pagination-page">Página {page} de {pages}</span>
    <button type="button" className="btn small" disabled={busy || page >= pages} onClick={() => controls.setPage(page + 1)}>Siguiente</button>
    </div>
    </div>
  </nav>;
}
