import { useEffect, useState } from "react";
import { api } from "./api";

type AuditEvent = { id: number; entity: string; recordId: string; action: string; createdAt: string; actorUserId?: number; actorName?: string; orderNumber?: string; previousData?: unknown; newData?: unknown };
type AuditResult = { events: AuditEvent[]; actions: string[]; users: Array<{ id: number; names: string }> };
const auditActionLabels: Record<string, string> = {
  CREATED: "Orden creada",
  CLAIM_COMPLETED: "Número de siniestro registrado",
  DIAGNOSIS_UPLOADED: "Diagnóstico cargado",
  OPERATIONAL_DATA_CORRECTED: "Datos operativos corregidos",
  QUOTE_CREATED: "Cotización creada",
  QUOTE_UPDATED: "Cotización actualizada",
  QUOTE_DELETED: "Cotización eliminada",
  QUOTE_SENT: "Cotización enviada",
  QUOTE_APPROVED: "Cotización aprobada",
  PART_UPDATED: "Repuesto actualizado",
  PARTS_LOGISTICS_UPDATED: "Logística de repuestos actualizada",
  REPAIR_STARTED: "Reparación iniciada",
  LABOR_VERIFIED: "Partida de mano de obra verificada",
  LABOR_VERIFICATION_REMOVED: "Verificación de partida retirada",
  ALL_LABOR_VERIFIED: "Todas las partidas verificadas",
  ALL_LABOR_VERIFICATIONS_REMOVED: "Verificación masiva retirada",
  FINAL_CONTROL_COMPLETED: "Control final completado",
  FINAL_CONTROL_REOPENED: "Control final reabierto",
  READY_FOR_PICKUP_PUBLISHED: "Lista para entrega publicada",
  ORDER_DELIVERED: "Orden entregada",
};
const auditActionLabel = (action: string) => auditActionLabels[action] || action.replaceAll("_", " ");
export function AuditView() {
  const [result, setResult] = useState<AuditResult>(); const [text, setText] = useState(""); const [action, setAction] = useState(""); const [userId, setUserId] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [error, setError] = useState<string>();
  const load = async () => { try { setError(undefined); const query = new URLSearchParams(); if (text.trim()) query.set("text", text.trim()); if (action) query.set("action", action); if (userId) query.set("userId", userId); if (from) query.set("from", from); if (to) query.set("to", to); setResult(await api<AuditResult>(`/audit/events?${query}`)); } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cargar la auditoría."); } };
  useEffect(() => { void load(); }, []);
  return <><div className="page-head"><div><h1>Auditoría</h1><p>Consulta inmutable de eventos registrados en la aplicación.</p></div></div><section className="card audit-view"><div className="audit-filters"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Buscar acción, entidad, registro o usuario" /><select value={action} onChange={(event) => setAction(event.target.value)}><option value="">Todas las acciones</option>{result?.actions.map((item) => <option key={item} value={item}>{auditActionLabel(item)}</option>)}</select><select value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">Todos los usuarios</option>{result?.users.map((item) => <option key={item.id} value={item.id}>{item.names}</option>)}</select><label>Desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Hasta<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="btn primary" onClick={() => void load()}>Filtrar</button></div>{error ? <div className="empty">{error}</div> : !result ? <div className="empty">Cargando auditoría...</div> : <div className="audit-events">{result.events.length ? result.events.map((event) => <article key={event.id}><div><strong>{event.action.replaceAll("_", " ")}</strong><span>{event.orderNumber || `${event.entity} #${event.recordId}`}</span></div><div><b>{event.actorName || "Sistema"}</b><small>{new Date(event.createdAt).toLocaleString()}</small></div></article>) : <div className="empty">No hay eventos con estos filtros.</div>}</div>}</section></>;
}
