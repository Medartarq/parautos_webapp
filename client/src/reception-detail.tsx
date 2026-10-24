import { useEffect, useState, type FormEvent } from "react";
import { openAttachment } from "./api";
import { downloadReceptionPdf } from "./reception-print";
import { preloadReceptionPdfResources } from "./reception-svg";

type ReceptionDetailOrder = {
  id: number; orderNumber: string; modality: string; claimNumber?: string; advisorName?: string; documentType: string; documentNumber: string;
  phone?: string; email?: string; year?: number; vin?: string; plate: string; brand: string; client: string; model: string; color: string;
  bodyCode?: string; bodyName: string; diagnosisPending: boolean;
  reception: null | { mileage?: number; fuelLevel?: number; considerations?: string[] | string; diagnosis?: string; diagnosisLegibility?: string; diagnosisReviewState?: string; acceptedTerms: boolean };
  checklist: Array<{ category: string; categoryOrder?: number; name: string; itemOrder?: number; answer: string; observation?: string }>;
  damages: Array<{ body: string; view: string; path: unknown[] }>;
  attachments: Array<{ id: number; category: string; originalName: string; mimeType: string; byteSize: number }>;
};

function DetailField({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value}</strong></div>; }

export function ReceptionDetail({ order, onRefresh }: { order: ReceptionDetailOrder; onRefresh: () => Promise<void> }) {
  useEffect(() => {
    preloadReceptionPdfResources(order.bodyCode || order.damages[0]?.body || "V3");
  }, [order.bodyCode, order.damages]);
  const considerations = Array.isArray(order.reception?.considerations) ? order.reception.considerations : [];
  const categories = [...new Set(order.checklist.map((item) => item.category))];
  const diagnoses = order.attachments.filter((attachment) => attachment.category === "EVALUACION_MANUSCRITA");
  const [diagnosisPage, setDiagnosisPage] = useState(0);
  const diagnosis = diagnoses[Math.min(diagnosisPage, Math.max(diagnoses.length - 1, 0))];
  const [diagnosisMessage, setDiagnosisMessage] = useState<string>();
  const downloadChecklist = async () => {
    try {
      await downloadReceptionPdf({
        modality: order.modality,
        advisor: order.advisorName,
        claimNumber: order.claimNumber,
        plate: order.plate,
        documentNumber: order.documentNumber,
        brand: order.brand,
        client: order.client,
        model: order.model,
        phone: order.phone,
        year: order.year,
        color: order.color,
        vin: order.vin,
        email: order.email,
        mileage: order.reception?.mileage,
        fuelLevel: order.reception?.fuelLevel,
        considerations,
        checklist: order.checklist,
        body: order.bodyCode || order.damages[0]?.body || "V3",
        damages: order.damages as Array<{ body: string; view: "01" | "02" | "03" | "04" | "05"; path: Array<{ u: number; v: number }> }>,
        evidenceCount: order.attachments.filter((attachment) => attachment.category === "RECEPCION").length,
        signature: order.attachments.find((attachment) => attachment.category === "OTRO") ? `/api/v1/attachments/${order.attachments.find((attachment) => attachment.category === "OTRO")?.id}/content` : undefined,
      }, order.orderNumber);
    } catch (error) {
      setDiagnosisMessage(error instanceof Error ? error.message : "No fue posible generar el checklist A4.");
    }
  };
  const uploadDiagnosis = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const uploadForm = event.currentTarget; const files = new FormData(uploadForm).getAll("file").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) { setDiagnosisMessage("Seleccione una o más imágenes para continuar."); return; }
    setDiagnosisMessage(`Cargando ${files.length} página${files.length === 1 ? "" : "s"}...`);
    try {
      for (const file of files) { const form = new FormData(); form.append("category", "EVALUACION_MANUSCRITA"); form.append("file", file); const response = await fetch(`/api/v1/attachments/orders/${order.id}`, { method: "POST", credentials: "include", body: form }); if (!response.ok) { const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined; throw new Error(body?.error?.message || "No fue posible cargar el diagnóstico."); } }
      uploadForm.reset(); await onRefresh(); setDiagnosisPage(diagnoses.length); setDiagnosisMessage(`${files.length} página${files.length === 1 ? "" : "s"} cargada${files.length === 1 ? "" : "s"} y recordatorio completado.`);
    } catch (error) { setDiagnosisMessage(error instanceof Error ? error.message : "No fue posible cargar el diagnóstico."); }
  };
  return <div className="reception-screen">
    <div className="reception-workspace">
        <section className="card reception-inventory-card"><header><div><h2>Inventario de recepción</h2><small>{order.checklist.length} ítems verificados al ingreso</small></div><div className="reception-document-actions"><span className="status neutral">Registro cerrado</span><button className="btn small reception-pdf-action" type="button" onClick={() => void downloadChecklist()}>Descargar checklist A4</button></div></header><div className="reception-inventory">{categories.map((category) => <section key={category}><h3>{category}</h3>{order.checklist.filter((item) => item.category === category).map((item) => <div key={item.name}><span>{item.name}</span><i className={item.answer === "SI" ? "yes" : "no"}>{item.answer === "SI" ? "OK" : "OBS"}</i>{item.observation && <small>{item.observation}</small>}</div>)}</section>)}</div></section>
      <section className="reception-insights"><article className="card"><header><h2>Consideraciones de ingreso</h2></header><div className="card-body"><p>{considerations.length ? considerations.join(" · ") : "Sin consideraciones registradas."}</p></div></article><article className="card"><header><h2>Condiciones registradas</h2></header><div className="card-body reception-metrics"><DetailField label="Kilometraje" value={order.reception?.mileage === undefined ? "No registrado" : `${order.reception.mileage} km`} /><DetailField label="Combustible" value={order.reception?.fuelLevel === undefined ? "No registrado" : `${order.reception.fuelLevel}%`} /><DetailField label="Carrocería" value={order.bodyName} /><DetailField label="Daños visibles" value={`${order.damages.length} marcas`} /><DetailField label="Firma" value="Registrada" /><DetailField label="Términos" value={order.reception?.acceptedTerms ? "Aceptados" : "Pendientes"} /></div></article></section>
    </div>
    <aside className="reception-support card diagnosis-card"><header><div><small>Evaluación de recepción</small><h2>Diagnóstico</h2></div>{diagnosis ? <span className="status ready">{diagnoses.length} página{diagnoses.length === 1 ? "" : "s"}</span> : order.diagnosisPending ? <span className="status amber">Pendiente</span> : <span className="status neutral">Sin archivo</span>}</header><div className="card-body"><section className="diagnosis-note"><span>Descripción registrada</span><p>{order.reception?.diagnosis || "No se registró una descripción de diagnóstico."}</p></section><div className="diagnosis-tags"><span>{order.reception?.diagnosisLegibility || "PENDIENTE"}</span><span>{(order.reception?.diagnosisReviewState || "PENDIENTE_REVISION").replaceAll("_", " ")}</span></div>{diagnosis && <><div className="diagnosis-page-nav"><button type="button" onClick={() => setDiagnosisPage((page) => Math.max(0, page - 1))} disabled={diagnosisPage === 0} aria-label="Página anterior">←</button><strong>Página {Math.min(diagnosisPage + 1, diagnoses.length)} de {diagnoses.length}</strong><button type="button" onClick={() => setDiagnosisPage((page) => Math.min(diagnoses.length - 1, page + 1))} disabled={diagnosisPage >= diagnoses.length - 1} aria-label="Página siguiente">→</button></div><a className="diagnosis-preview" href={`/api/v1/attachments/${diagnosis.id}/content`} onClick={(event) => { event.preventDefault(); void openAttachment(diagnosis.id).catch((error) => setDiagnosisMessage(error instanceof Error ? error.message : "No fue posible abrir el diagnóstico.")); }} target="_blank" rel="noreferrer" aria-label="Abrir evaluación a tamaño completo"><img src={`/api/v1/attachments/${diagnosis.id}/content`} alt={diagnosis.originalName} /><i>Ver a tamaño completo</i></a><div className="diagnosis-thumbnails">{diagnoses.map((page, index) => <button type="button" className={index === diagnosisPage ? "active" : ""} key={page.id} onClick={() => setDiagnosisPage(index)} aria-label={`Ver página ${index + 1}`}><img src={`/api/v1/attachments/${page.id}/content`} alt="" /></button>)}</div><div className="diagnosis-file"><span>{diagnosis.originalName}</span><a className="btn" href={`/api/v1/attachments/${diagnosis.id}/content`} download={diagnosis.originalName}>Descargar imagen</a></div></>}<form className="diagnosis-late-upload" onSubmit={uploadDiagnosis}><p className="hint">{diagnosis ? "Agregar más páginas a la evaluación." : order.diagnosisPending ? "El recordatorio se cerrará al cargar el archivo." : "Puede adjuntar la evaluación después de crear la orden."}</p><input name="file" type="file" accept="image/jpeg,image/png,image/webp" multiple /><button className="btn primary">{diagnosis ? "Agregar páginas" : "Cargar evaluación"}</button></form>{diagnosisMessage && <p className="hint">{diagnosisMessage}</p>}</div></aside>
  </div>;
}

