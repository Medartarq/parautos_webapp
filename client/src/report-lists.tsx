import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useScopedQuery } from "./scoped-query";
import { Pagination, usePagination, type PageInfo } from "./pagination";
import { downloadOperationalReportPdf } from "./reports-view";

type ReportRow = { id: number; orderNumber: string; plate: string; brand: string; model: string; client: string; advisor?: string; modality: string; status: string; createdAt: string; description: string; providerName?: string; receivedQuantity: number; quantity: number; expectedDate?: string };
type Option = { advisor?: string; modality?: string; status: string; providerName?: string };
type ReportPage = { rows: ReportRow[]; pagination: PageInfo; options: Option[] };
const statusLabel = (value: string) => ({ PENDIENTE: "Pendiente", ENVIADA: "Enviada", POR_GESTIONAR: "Por gestionar", PEDIDO: "Pedido", EN_TALLER: "En taller" }[value] || value.replaceAll("_", " "));
const unique = (values: Array<string | undefined>) => [...new Set(values.filter((v): v is string => Boolean(v)))];

export function ReportLists({ kind }: { kind: "quotes" | "parts" }) {
  const [filters, setFilters] = useState({ status: "", modality: "", age: "", advisor: "", provider: "", from: "", to: "", search: "" });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const exportController = useRef<AbortController | null>(null);
  useEffect(() => () => exportController.current?.abort(), []);
  const paging = usePagination(filters);
  const query = useScopedQuery<ReportPage>("reports", `/reports/list/${kind}?${paging.params}`);
  const options = query.data?.options ?? [];
  const set = (field: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [field]: value }));
  const headers = kind === "quotes" ? ["Orden", "Placa", "Vehículo", "Cliente", "Asesor", "Modalidad", "Estado", "Creada"] : ["Orden", "Placa", "Repuesto", "Cliente", "Asesor", "Proveedor", "Recibido", "Estado", "Fecha esperada"];
  const cells = (item: ReportRow): Array<string | number> => kind === "quotes" ? [item.orderNumber, item.plate, `${item.brand} ${item.model}`, item.client, item.advisor || "Sin asignar", item.modality, statusLabel(item.status), new Date(item.createdAt).toLocaleDateString("es-PE")] : [item.orderNumber, item.plate, item.description, item.client, item.advisor || "Sin asignar", item.providerName || "Sin proveedor", `${item.receivedQuantity}/${item.quantity}`, statusLabel(item.status), item.expectedDate?.slice(0, 10) || "Sin fecha"];
  const exportReport = async (format: "csv" | "pdf") => {
    setExporting(true); setExportError("");
    const controller = new AbortController(); exportController.current = controller;
    try {
      const { rows } = await api<{ rows: ReportRow[] }>(`/reports/export/${kind}?${new URLSearchParams(filters)}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const values = rows.map(cells);
      if (format === "pdf") await downloadOperationalReportPdf(kind === "quotes" ? "Reporte de Cotizaciones Pendientes" : "Reporte de Repuestos Pendientes", headers, values);
      else {
        const content = [headers, ...values].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
        const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = `Reporte_${kind}_${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
      }
    } catch (error) { if (!controller.signal.aborted) setExportError(error instanceof Error ? error.message : "No fue posible exportar el reporte."); }
    finally { if (!controller.signal.aborted) setExporting(false); }
  };
  return <section className="card report-view">
    <div className="report-toolbar"><div className="report-toolbar-main"><div className="report-filter-group">
      <label>Estado<select value={filters.status} onChange={(e) => set("status", e.target.value)}><option value="">Todos los estados</option>{unique(options.map((o) => o.status)).map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
      {kind === "quotes" && <label>Modalidad<select value={filters.modality} onChange={(e) => set("modality", e.target.value)}><option value="">Todas las modalidades</option>{unique(options.map((o) => o.modality)).map((value) => <option key={value}>{value}</option>)}</select></label>}
      <label>{kind === "quotes" ? "Antigüedad" : "Urgencia"}<select value={filters.age} onChange={(e) => set("age", e.target.value)}><option value="">Todas</option>{(kind === "quotes" ? [["RECENT", "0–2 días"], ["ATTENTION", "3–5 días"], ["OVERDUE", "Más de 5 días"]] : [["OVERDUE", "Vencido"], ["NEXT_3", "Próximos 3 días"], ["NO_DATE", "Sin fecha"]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Asesor<select value={filters.advisor} onChange={(e) => set("advisor", e.target.value)}><option value="">Todos los asesores</option>{unique(options.map((o) => o.advisor)).map((value) => <option key={value}>{value}</option>)}</select></label>
      {kind === "parts" && <label>Proveedor<select value={filters.provider} onChange={(e) => set("provider", e.target.value)}><option value="">Todos los proveedores</option><option value="NO_PROVIDER">Sin proveedor</option>{unique(options.map((o) => o.providerName)).map((value) => <option key={value}>{value}</option>)}</select></label>}
    </div><div className="report-date-range"><span className="report-date-title">{kind === "quotes" ? "Fecha de creación" : "Fecha esperada"}</span><label>Desde<input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} /></label><label>Hasta<input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} /></label></div>
      <label className="report-search">Buscar<input value={filters.search} onChange={(e) => set("search", e.target.value)} placeholder="Orden, placa, cliente o vehículo" /></label>
    </div><div className="report-toolbar-footer">{Object.values(filters).some(Boolean) && <button className="report-clear" onClick={() => setFilters({ status: "", modality: "", age: "", advisor: "", provider: "", from: "", to: "", search: "" })}>Limpiar filtros</button>}<div className="report-actions"><button className="btn" disabled={exporting || !query.data} onClick={() => void exportReport("csv")}>Exportar CSV</button><button className="btn primary" disabled={exporting || !query.data} onClick={() => void exportReport("pdf")}>Descargar PDF</button></div></div></div>
    <Pagination controls={paging} info={query.data?.pagination} busy={query.isFetching} />
    {exporting && <p role="status">Preparando todos los resultados del reporte…</p>}
    {(query.error || exportError) && <p role="alert">{query.error?.message || exportError}</p>}
    <div className="report-table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{query.data?.rows.map((row) => <tr key={row.id}>{cells(row).map((value, index) => <td key={headers[index]}>{value}</td>)}</tr>)}</tbody></table></div>
    <div className="report-mobile-results">{query.data?.rows.map((row) => <article key={row.id}>{cells(row).map((value, index) => <div key={headers[index]}><small>{headers[index]}</small><strong>{value}</strong></div>)}</article>)}</div>
  </section>;
}
