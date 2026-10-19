import { Suspense, useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import { ReceptionDetail } from "./reception-detail";
import { QuoteExportToolbar } from "./quote-export-toolbar";
import { QuoteEditor } from "./quote-editor";
import { PartsOrderWorkbench } from "./parts-order-workbench";
import { FinalControl } from "./final-control";

type DetailTab = "summary" | "reception" | "quotes" | "parts" | "control" | "history";
type OrderDetailData = { id: number; orderNumber: string; modality: string; client: string; plate: string; brand: string; model: string; color: string; claimPending: boolean | 0 | 1; publicCode?: string; internalStatus: string; publicStatus: string; claimNumber?: string; documentType: string; documentNumber: string; phone?: string; email?: string; operationalPhone?: string; operationalEmail?: string; year?: number; vin?: string; bodyCode?: string; bodyName: string; diagnosisPending: boolean; reception: null | { mileage?: number; fuelLevel?: number; considerations?: string[] | string; diagnosis?: string; diagnosisLegibility?: string; diagnosisReviewState?: string; acceptedTerms: boolean }; checklist: Array<{ category: string; name: string; answer: string; observation?: string }>; damages: Array<{ body: string; view: string; path: unknown[] }>; attachments: Array<{ id: number; category: string; originalName: string; mimeType: string; byteSize: number }>; history: Array<{ action: string; createdAt: string; actor?: string }> };
const auditActionLabel = (action: string) => action.replaceAll("_", " ");

const detailStatuses: Record<string, { label: string; tone: string; progress: number }> = {
  COTIZACION_PENDIENTE: { label: "Cotización pendiente", tone: "red", progress: 25 },
  ESPERA_APROBACION: { label: "Espera de aprobación", tone: "amber", progress: 25 },
  ESPERA_REPUESTOS: { label: "Espera de repuestos", tone: "blue", progress: 50 },
  EN_REPARACION: { label: "En reparación", tone: "green", progress: 75 },
  LISTA_PARA_ENTREGA: { label: "Lista para entrega", tone: "ready", progress: 100 },
  ENTREGADA: { label: "Entregada", tone: "ready", progress: 100 },
  CANCELADA: { label: "Cancelada", tone: "neutral", progress: 0 },
};
export function OrderDetail({ orderId, initialTab, onBack }: { orderId: number; initialTab?: DetailTab; onBack: () => void }) {
  const [tab, setTab] = useState<DetailTab>(initialTab || "summary");
  const [order, setOrder] = useState<OrderDetailData>();
  const [message, setMessage] = useState<string>();
  const [claimNumber, setClaimNumber] = useState("");
  const [operationalEditing, setOperationalEditing] = useState(false);
  const [operationalPhone, setOperationalPhone] = useState("");
  const [operationalEmail, setOperationalEmail] = useState("");
  const [operationalClaim, setOperationalClaim] = useState("");
  const [operationalPending, setOperationalPending] = useState(false);
  const [operationalReason, setOperationalReason] = useState("");
  const [operationalBusy, setOperationalBusy] = useState(false);
  const [quoteRevision, setQuoteRevision] = useState(0);
  const refreshOrder = async () => {
    try { setOrder((await api<{ order: OrderDetailData }>(`/orders/${orderId}`)).order); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar la orden."); }
  };
  useEffect(() => {
    void refreshOrder();
  }, [orderId]);
  if (!order) return <div className="empty">{message || "Cargando detalle de orden..."}</div>;
  const status = detailStatuses[order.internalStatus] || {
    label: order.internalStatus.replaceAll("_", " "), tone: "neutral", progress: 0,
  };
  const completeClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await api(`/orders/${orderId}/claim`, { method: "PATCH", body: JSON.stringify({ claimNumber }) });
      setOrder({ ...order, claimPending: false, claimNumber });
      setMessage("Siniestro registrado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible registrar el siniestro.");
    }
  };
  const beginOperationalEdit = () => {
    setOperationalPhone(order.operationalPhone || ""); setOperationalEmail(order.operationalEmail || "");
    setOperationalClaim(order.claimNumber || ""); setOperationalPending(Boolean(order.claimPending)); setOperationalReason(""); setOperationalEditing(true);
  };
  const saveOperationalData = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setOperationalBusy(true); setMessage(undefined);
    try {
      await api(`/orders/${orderId}/operational-data`, { method: "PATCH", body: JSON.stringify({ phoneOverride: operationalPhone, emailOverride: operationalEmail, claimNumber: operationalClaim, claimPendingReminder: operationalPending, reason: operationalReason }) });
      setOperationalEditing(false); setMessage("Datos operativos actualizados."); await refreshOrder();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar los datos operativos."); }
    finally { setOperationalBusy(false); }
  };
  const tabs: Array<[DetailTab, string]> = [
    ["summary", "Resumen"], ["reception", "Recepción"], ["quotes", "Cotización"],
    ["parts", "Repuestos"], ["control", "Control final"], ["history", "Historial"],
  ];
  return <>
    <section className="detail-hero">
      <div className="detail-identity"><button className="btn small" onClick={onBack}>← Órdenes</button><h1>{order.orderNumber}</h1><p>{order.brand} {order.model} · {order.color} · {order.plate}</p><div className="detail-meta"><span>{order.modality.replaceAll("_", " ")}</span><span>{order.bodyName}</span><span>Cliente: {order.client}</span></div><a className="btn small public-tracking-link" href={`/seguimiento?plate=${encodeURIComponent(order.plate)}&code=${encodeURIComponent(order.publicCode || "")}`} target="_blank" rel="noreferrer">Abrir seguimiento público ↗</a></div>
      <div className="detail-statuses"><span className={`status ${status.tone}`}>Interno · {status.label}</span><span className="status neutral">Público · {order.publicStatus.replaceAll("_", " ")}</span><label>Estado actual<select value={order.internalStatus} disabled aria-describedby="status-readonly"><option>{status.label}</option></select><small id="status-readonly">Solo lectura: no hay API de cambio manual de estado.</small></label></div>
    </section>
    <section className="detail-progress card"><div><small>Avance del caso</small><strong>{status.progress}%</strong><span>Etapa alcanzada; no representa avance físico exacto.</span></div><div className="progress-bar" aria-label={`Avance ${status.progress}%`}><i style={{ width: `${status.progress}%` }} /></div></section>
    <div className="tabs" role="tablist" aria-label="Detalle de orden">{tabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === "summary" && <><div className="detail-grid"><section className="card"><header><h2>Información del caso</h2></header><div className="card-body detail-fields"><DetailField label="Cliente" value={order.client} note={`${order.documentType} ${order.documentNumber}`} /><DetailField label="Vehículo" value={`${order.brand} ${order.model}`} note={`${order.plate} · ${order.color}`} /><DetailField label="Modalidad" value={order.modality.replaceAll("_", " ")} note={order.claimNumber ? `Siniestro: ${order.claimNumber}` : order.claimPending ? "Siniestro pendiente" : "Sin siniestro registrado"} /><DetailField label="Carrocería" value={order.bodyName} note={order.year ? `Año ${order.year}` : "Año no registrado"} /><DetailField label="Código público" value={order.publicCode || "No disponible"} note="Compártalo con el cliente junto con la placa para el seguimiento." /><DetailField label="Estados" value={`Interno: ${status.label}`} note={`Público: ${order.publicStatus.replaceAll("_", " ")}`} /></div></section><section className="card"><header><h2>Resumen de recepción</h2></header><div className="card-body detail-fields"><DetailField label="Kilometraje" value={order.reception?.mileage === undefined ? "No registrado" : `${order.reception.mileage} km`} /><DetailField label="Combustible" value={order.reception?.fuelLevel === undefined ? "No registrado" : `${order.reception.fuelLevel}%`} /><DetailField label="Checklist" value={`${order.checklist.length} ítems registrados`} /><DetailField label="Daños" value={`${order.damages.length} marcas registradas`} /><DetailField label="Evidencias" value={`${order.attachments.length} archivos adjuntos`} /><DetailField label="Diagnóstico" value={order.reception?.diagnosis ? "Registrado" : "No registrado"} /></div></section></div><section className="card operational-data-editor"><header><div><h2>Contacto operativo actual</h2><small>La recepción original y su documento A4 son inmutables.</small></div>{!operationalEditing && <button className="btn small" disabled={["ENTREGADA", "CANCELADA"].includes(order.internalStatus)} onClick={beginOperationalEdit}>Corregir datos</button>}</header>{operationalEditing ? <form className="card-body operational-data-form" onSubmit={saveOperationalData}><label>Teléfono operativo<input inputMode="tel" value={operationalPhone} onChange={(event) => setOperationalPhone(event.target.value)} maxLength={20} /></label><label>Correo operativo<input type="email" value={operationalEmail} onChange={(event) => setOperationalEmail(event.target.value)} maxLength={150} /></label>{order.modality !== "PARTICULAR" && <><label>Número de siniestro<input value={operationalClaim} disabled={operationalPending} onChange={(event) => setOperationalClaim(event.target.value)} maxLength={60} /></label><label className="operational-pending"><input type="checkbox" checked={operationalPending} onChange={(event) => { setOperationalPending(event.target.checked); if (event.target.checked) setOperationalClaim(""); }} /> Siniestro pendiente</label></>}<label className="operational-reason">Motivo de corrección<textarea required minLength={1} maxLength={500} value={operationalReason} onChange={(event) => setOperationalReason(event.target.value)} /></label><div className="operational-actions"><button type="button" className="btn" disabled={operationalBusy} onClick={() => setOperationalEditing(false)}>Cancelar</button><button className="btn primary" disabled={operationalBusy}>{operationalBusy ? "Guardando..." : "Guardar cambios"}</button></div></form> : <div className="card-body detail-fields"><DetailField label="Teléfono" value={order.operationalPhone || "Sin override"} /><DetailField label="Correo" value={order.operationalEmail || "Sin override"} /><DetailField label="Siniestro" value={order.claimNumber || (order.claimPending ? "Pendiente" : "No corresponde")} /></div>}</section>{order.claimPending && <form className="claim-completion card" onSubmit={completeClaim}><strong>Completar siniestro pendiente</strong><input value={claimNumber} onChange={(event) => setClaimNumber(event.target.value)} placeholder="Número de siniestro" required /><button className="btn primary">Registrar siniestro</button></form>}</>}
    {tab === "reception" && <Suspense fallback={<div className="empty">Cargando recepción...</div>}><ReceptionDetail order={order} onRefresh={refreshOrder} /></Suspense>}
    {tab === "quotes" && <><Suspense fallback={<div className="empty">Cargando exportadores...</div>}><QuoteExportToolbar order={order} revision={quoteRevision} /></Suspense><Suspense fallback={<div className="empty">Cargando editor de cotización...</div>}><QuoteEditor orderId={orderId} diagnoses={order.attachments.filter((attachment) => attachment.category === "EVALUACION_MANUSCRITA")} onQuotesChanged={() => setQuoteRevision((current) => current + 1)} /></Suspense></>}
    {tab === "parts" && <Suspense fallback={<div className="empty">Cargando repuestos...</div>}><PartsOrderWorkbench orderId={orderId} onRepairStarted={refreshOrder} /></Suspense>}
    {tab === "control" && <Suspense fallback={<div className="empty">Cargando control final...</div>}><FinalControl orderId={orderId} order={order} onChanged={refreshOrder} /></Suspense>}
    {tab === "history" && <section className="card"><header><h2>Historial resumido</h2></header><div className="card-body history-list">{order.history.length ? order.history.map((event, index) => <div key={`${event.createdAt}-${index}`}><strong>{auditActionLabel(event.action)}</strong><span>{new Date(event.createdAt).toLocaleString()} · {event.actor || "Sistema"}</span></div>) : <p className="hint">No hay eventos registrados.</p>}</div></section>}
    {message && <p className="hint detail-message">{message}</p>}
  </>;
}
function DetailField({ label, value, note }: { label: string; value: string; note?: string }) { return <div><small>{label}</small><strong>{value}</strong>{note && <span>{note}</span>}</div>; }
