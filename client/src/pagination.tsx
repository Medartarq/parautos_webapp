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

// Función auxiliar para generar los números de página con puntos suspensivos
const generatePageNumbers = (currentPage: number, totalPages: number) => {
  const pages = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    if (currentPage <= 3) {
      // Cerca del inicio: 1 2 3 4 5 ... Última
      pages.push(1, 2, 3, 4, 5, "...", totalPages);
    } else if (currentPage >= totalPages - 2) {
      // Cerca del final: 1 ... Última-4 Última-3 Última-2 Última-1 Última
      pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      // En el medio: 1 ... actual-1 actual actual+1 ... Última
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
  }
  return pages;
};

export function Pagination({ info, controls, busy = false }: { info?: PageInfo; controls: ReturnType<typeof usePagination>; busy?: boolean }) {
  const total = info?.total ?? 0;
  const page = info?.page ?? controls.page;
  const pages = info?.pages ?? 1;
  
  const pageNumbers = generatePageNumbers(page, pages);

  return (
    <nav className="pagination" aria-label="Paginación de resultados">
      <span className="pagination-summary" aria-live="polite">
        {busy ? "Cargando resultados…" : `Mostrando ${total ? (page - 1) * controls.pageSize + 1 : 0}–${Math.min(page * controls.pageSize, total)} de ${total}`}
      </span>
      
      <div className="pagination-controls">
        <label className="pagination-size">
          Resultados por página
          <select value={controls.pageSize} onChange={(event) => controls.setPageSize(Number(event.target.value))}>
            {[10, 20, 30].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        
        <div className="pagination-navigation">
          <button 
            type="button" 
            className="btn small" 
            disabled={busy || page <= 1} 
            onClick={() => controls.setPage(1)}
            title="Primera página"
          >
            « Primera
          </button>

          <button 
            type="button" 
            className="btn small" 
            disabled={busy || page <= 1} 
            onClick={() => controls.setPage(page - 1)}
          >
            Anterior
          </button>

          <div className="pagination-numbers">
            {pageNumbers.map((p, index) => {
              if (p === "...") {
                return <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>;
              }
              return (
                <button
                  key={p}
                  type="button"
                  className={`btn small ${p === page ? "active" : ""}`}
                  disabled={busy}
                  onClick={() => controls.setPage(Number(p))}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button 
            type="button" 
            className="btn small" 
            disabled={busy || page >= pages} 
            onClick={() => controls.setPage(page + 1)}
          >
            Siguiente
          </button>

          <button 
            type="button" 
            className="btn small" 
            disabled={busy || page >= pages} 
            onClick={() => controls.setPage(pages)}
            title="Última página"
          >
            Última »
          </button>
        </div>
      </div>
    </nav>
  );
}
