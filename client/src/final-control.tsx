import { useEffect, useRef, useState } from "react";
import logo from "./assets/logo_parautos.svg";
import { api } from "./api";
import { loadPdfLibrary } from "./pdf-library";

type FinalControlOrder = { orderNumber: string; client: string; documentNumber: string; operationalPhone?: string; phone?: string; modality: string; plate: string; brand: string; model: string };

async function downloadConformityPdf(data: { orderNumber: string; client: string; documentNumber: string; phone?: string; modality: string; plate: string; brand: string; model: string; completedAt?: string }) {
  const { jsPDF } = await loadPdfLibrary();
  const pdf = new jsPDF({ unit: "mm", format: "a4" }); const left = 20; const right = 15; const width = 210 - left - right; let y = 16;
  const rasterizeLogo = () => new Promise<string>((resolve, reject) => { const image = new Image(); image.onload = () => { const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; canvas.getContext("2d")?.drawImage(image, 0, 0); resolve(canvas.toDataURL("image/png")); }; image.onerror = reject; image.src = logo; });
  try { pdf.addImage(await rasterizeLogo(), "PNG", left, y - 5, 29, 18); } catch { pdf.setTextColor(237, 51, 55); pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.text("PARAUTOS", left, y + 5); }
  pdf.setTextColor(23, 33, 43); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text("Acta de Conformidad de Servicios", 195, y + 1, { align: "right" });
  pdf.setFontSize(8); pdf.text(`Orden de servicio: ${data.orderNumber}`, 195, y + 6, { align: "right" });
  pdf.setFont("helvetica", "normal"); pdf.setTextColor(95, 107, 122); pdf.text("B & P Service S.A.C. · PARAUTOS · RUC 20560170549 · Av. América Norte N.° 2404, Trujillo", 195, y + 11, { align: "right" }); y += 15;
  pdf.setDrawColor(237, 51, 55); pdf.setLineWidth(.5); pdf.line(left, y, 195, y);
  // La cabecera se mantiene fija; el bloque de conformidad se centra en el área útil restante del A4.
  const date = new Date(data.completedAt || Date.now()); pdf.setTextColor(23, 33, 43); pdf.setFontSize(9); pdf.text(`Trujillo, ${date.toLocaleDateString("es-PE")}`, 195, 60, { align: "right" });
  y = 96;
  const statement = "Mediante el presente documento, se deja constancia que se ha recibido a mi satisfacción los servicios brindados por PARAUTOS, servicios que corresponden al 100% del monto total de la orden de servicio suscrita. Por lo cual, procedo al retiro de mi unidad de las instalaciones de la empresa en mención.";
  pdf.setFontSize(9.5); pdf.text(pdf.splitTextToSize(statement, width), left, y, { lineHeightFactor: 1.45, align: "justify", maxWidth: width }); y += pdf.getTextDimensions(pdf.splitTextToSize(statement, width)).h * 1.45 + 15;
  const field = (label: string, value: string) => { pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5); pdf.text(`${label}:`, left, y); pdf.setFont("helvetica", "normal"); pdf.text(value || "No registrado", left + pdf.getTextWidth(`${label}: `), y); y += 7; };
  field("NOMBRES Y APELLIDOS", data.client); field("DNI", data.documentNumber); field("TELÉFONO", data.phone || ""); y += 12;
  field("MODALIDAD", data.modality.replaceAll("_", " ")); field("PLACA", data.plate); field("MARCA", data.brand); field("MODELO", data.model); y += 8;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.text("Con mi firma acepto recibir mi vehículo con las reparaciones concluidas.", left, y);
  const signatureY = y + 42; pdf.setDrawColor(23, 33, 43); pdf.line(72, signatureY, 138, signatureY); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text("FIRMA DE CONFORMIDAD", 105, signatureY + 5, { align: "center" }); pdf.setFont("helvetica", "normal"); pdf.text(data.client, 105, signatureY + 9, { align: "center" });
  pdf.save(`Acta_de_Conformidad_${data.orderNumber}.pdf`);
}
type FinalControlData = { internalStatus: string; publicStatus: string; labor: Array<{ id: number; description: string; category?: "PLANCHADO" | "PINTURA" | "MECANICA"; quantity: number; verified: boolean }>; pendingParts: Array<{ id: number; description: string; quantity: number; receivedQuantity: number }>; record: null | { completedAt?: string; publishedAt?: string; publicationChannel?: string; publicationNote?: string; deliveredAt?: string; conformityAcknowledgedAt?: string } };
function FinalControlLegacy({ orderId, order, onChanged }: { orderId: number; order: FinalControlOrder; onChanged: () => Promise<void> }) {
  const [control, setControl] = useState<FinalControlData>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [channel, setChannel] = useState("");
  const [note, setNote] = useState("");
  const [conformity, setConformity] = useState(false);
  const load = async () => { try { setControl((await api<{ control: FinalControlData }>(`/orders/${orderId}/final-control`)).control); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible cargar el control final."); } };
  useEffect(() => { void load(); }, [orderId]);
  const act = async (path: string, body?: unknown) => { setBusy(true); setMessage(undefined); try { await api(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }); await load(); await onChanged(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible registrar la acción."); } finally { setBusy(false); } };
  const toggle = async (line: FinalControlData["labor"][number]) => { setBusy(true); try { await api(`/orders/${orderId}/final-control/labor/${line.id}`, { method: "PUT", body: JSON.stringify({ verified: !line.verified }) }); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar la verificación."); } finally { setBusy(false); } };
  if (!control) return <div className="empty">{message || "Cargando control final..."}</div>;
  const downloadConformity = () => void downloadConformityPdf({ orderNumber: order.orderNumber, client: order.client, documentNumber: order.documentNumber, phone: order.operationalPhone || order.phone, modality: order.modality, plate: order.plate, brand: order.brand, model: order.model, completedAt: control.record?.completedAt });
  const blockers = [!control.labor.length ? "La cotización aprobada no tiene partidas de mano de obra." : "", control.pendingParts.length ? `${control.pendingParts.length} repuesto(s) aún no se ha(n) recibido.` : "", control.labor.some((line) => !line.verified) ? "Debe verificar todas las partidas de mano de obra." : ""].filter(Boolean);
  const completed = Boolean(control.record?.completedAt);
  const published = control.publicStatus === "LISTA_PARA_ENTREGA";
  const delivered = Boolean(control.record?.deliveredAt);
  const categoryLabels: Record<string, string> = { PLANCHADO: "Planchado", PINTURA: "Pintura", MECANICA: "Mecánica" };
  const laborGroups = control.labor.reduce<Record<string, FinalControlData["labor"]>>((groups, line) => { const category = line.category || "OTROS"; (groups[category] ||= []).push(line); return groups; }, {});
  return <section className="final-control">
    <section className="card final-control-card">
      <header className="control-card-header">
        <h2>Control final obligatorio</h2>
        <div className="control-header-actions"><span className={`status ${completed ? "ready" : "amber"}`}>{delivered ? "Entregada" : completed ? "Completado" : "Pendiente"}</span>{delivered && <button className="btn control-document-action" type="button" onClick={downloadConformity}>Descargar acta PDF</button>}</div>
      </header>
      <div className="card-body">
        {delivered ? <>
          <div className="control-delivered-summary"><strong>Control final completado</strong><span>{control.labor.filter((line) => line.verified).length} de {control.labor.length} partidas verificadas · Orden entregada</span></div>
          <p className="control-delivered-note">La orden fue entregada. Puede descargar el acta de conformidad.</p>
          <details className="control-verified-details"><summary>Ver partidas verificadas <span>{control.labor.length}</span></summary><div className="control-verified-groups">{Object.entries(laborGroups).map(([category, lines]) => <section key={category}><h3>{categoryLabels[category] || "Otras partidas"}<small>{lines.length} verificadas</small></h3><div className="control-labor readonly">{lines.map((line) => <label key={line.id}><input type="checkbox" checked={line.verified} disabled /><span>{line.description}</span><small>Cant. {line.quantity}</small></label>)}</div></section>)}</div></details>
        </> : <>
          {blockers.length > 0 && !completed && <ul className="control-blockers">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}
          {control.labor.length > 0 && <div className="control-labor">{control.labor.map((line) => <label key={line.id}><input type="checkbox" checked={line.verified} disabled={busy || completed} onChange={() => void toggle(line)} /><span>{line.description}</span><small>Cant. {line.quantity}</small></label>)}</div>}
          <div className="control-actions">{completed ? <button className="btn" disabled={busy || !reason.trim()} onClick={() => void act(`/orders/${orderId}/final-control/reopen`, { reason })}>Reabrir control</button> : <button className="btn primary" disabled={busy || blockers.length > 0} onClick={() => void act(`/orders/${orderId}/final-control/complete`)}>Registrar control final</button>}</div>
          {completed && <label className="control-form">Motivo para reabrir<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Describa el motivo" /></label>}
        </>}
      </div>
    </section>
    {completed && !delivered && <section className="card"><header><h2>Publicación y entrega</h2><span className="status neutral">Público · {control.publicStatus.replaceAll("_", " ")}</span></header><div className="card-body control-form">{!published ? <><label>Canal de aviso (opcional)<input value={channel} onChange={(event) => setChannel(event.target.value)} maxLength={80} placeholder="WhatsApp, llamada..." /></label><label>Nota (opcional)<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} /></label><div className="control-actions"><button className="btn primary" disabled={busy} onClick={() => void act(`/orders/${orderId}/final-control/publish`, { channel, note })}>Publicar lista para entrega</button></div></> : <><p className="hint">Publicada{control.record?.publicationChannel ? ` por ${control.record.publicationChannel}` : ""}{control.record?.publicationNote ? `: ${control.record.publicationNote}` : "."}</p><label className="control-conformity"><input type="checkbox" checked={conformity} onChange={(event) => setConformity(event.target.checked)} />Confirmo la conformidad del cliente al momento de la entrega.</label><div className="control-actions"><button className="btn primary" disabled={busy || !conformity} onClick={() => void act(`/orders/${orderId}/final-control/deliver`, { conformityAcknowledged: true })}>Registrar entrega</button></div></>}</div></section>}
    {message && <p className="hint detail-message">{message}</p>}
  </section>;
}
export function FinalControl({ orderId, order, onChanged }: { orderId: number; order: FinalControlOrder; onChanged: () => Promise<void> }) {
  const [control, setControl] = useState<FinalControlData>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const load = async () => {
    try { setControl((await api<{ control: FinalControlData }>(`/orders/${orderId}/final-control`)).control); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible cargar el control final."); }
  };
  useEffect(() => { void load(); }, [orderId]);
  const setAll = async (verified: boolean) => {
    setBusy(true); setMessage(undefined);
    try { await api(`/orders/${orderId}/final-control/labor`, { method: "PUT", body: JSON.stringify({ verified }) }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar las verificaciones."); }
    finally { setBusy(false); }
  };
  const toggle = async (line: FinalControlData["labor"][number]) => {
    setBusy(true); setMessage(undefined);
    try { await api(`/orders/${orderId}/final-control/labor/${line.id}`, { method: "PUT", body: JSON.stringify({ verified: !line.verified }) }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar la verificación."); }
    finally { setBusy(false); }
  };
  const complete = async () => {
    setBusy(true); setMessage(undefined);
    try { await api(`/orders/${orderId}/final-control/complete`, { method: "POST" }); await load(); await onChanged(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible registrar el control final."); }
    finally { setBusy(false); }
  };
  const verified = control?.labor.filter((line) => line.verified).length ?? 0;
  const allVerified = Boolean(control?.labor.length) && verified === control?.labor.length;
  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = verified > 0 && !allVerified; }, [verified, allVerified]);
  if (!control) return <div className="empty">{message || "Cargando control final..."}</div>;
  if (control.record?.completedAt) return <FinalControlLegacy orderId={orderId} order={order} onChanged={onChanged} />;
  const changesBlocked = busy || Boolean(control.record?.deliveredAt);
  const blockers = [!control.labor.length ? "La cotización aprobada no tiene partidas de mano de obra." : "", control.pendingParts.length ? `${control.pendingParts.length} repuesto(s) aún no se ha(n) recibido.` : "", !allVerified && control.labor.length ? "Faltan partidas de mano de obra por verificar." : ""].filter(Boolean);
  return <section className="final-control"><section className="card"><header><h2>Control final obligatorio</h2><span className="status amber">Pendiente</span></header><div className="card-body"><div className="control-progress"><strong>{verified} de {control.labor.length} verificadas</strong><span>{allVerified ? "Lista para el control final" : "Revise cada partida antes de continuar"}</span></div>{blockers.length > 0 && <ul className="control-blockers">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}{control.labor.length > 0 && <div className="control-labor"><label className="control-select-all"><input ref={selectAllRef} type="checkbox" checked={allVerified} disabled={changesBlocked} onChange={(event) => void setAll(event.target.checked)} /><span>Marcar todo</span><small>{verified}/{control.labor.length}</small></label>{control.labor.map((line) => <label key={line.id}><input type="checkbox" checked={line.verified} disabled={changesBlocked} onChange={() => void toggle(line)} /><span>{line.description}</span><small>Cant. {line.quantity}</small></label>)}</div>}<div className="control-action-bar"><p>{blockers.length ? `${blockers.length} bloqueo(s) pendiente(s)` : "Todas las validaciones están completas."}</p><button className="btn primary" disabled={busy || blockers.length > 0} onClick={() => void complete()}>Registrar control final</button></div>{message && <p className="hint">{message}</p>}</div></section></section>;
}
