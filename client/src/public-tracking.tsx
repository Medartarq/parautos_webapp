import { useState, type CSSProperties, type FormEvent } from "react";
import logo from "./assets/logo_parautos.svg";
import "./public-tracking.css";

type Tracking = {
  orderNumber: string;
  plate: string;
  brand: string;
  model: string;
  publicStatus: string;
};

const statusMeta: Record<string, { label: string; progress: number }> = {
  COTIZACION_PENDIENTE: { label: "En taller", progress: 25 },
  ESPERA_APROBACION: { label: "En taller", progress: 25 },
  ESPERA_REPUESTOS: { label: "Espera de repuestos", progress: 50 },
  EN_REPARACION: { label: "En reparacion", progress: 75 },
  LISTA_PARA_ENTREGA: { label: "Listo para entregar", progress: 100 },
};

const stages = ["En taller", "Espera de repuestos", "En reparacion", "Listo para entregar"];
async function trackingFetch(url: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try { return await fetch(url, { cache: "no-store", signal: controller.signal }); }
  finally { window.clearTimeout(timeout); }
}

export function PublicTracking() {
  const query = new URLSearchParams(window.location.search);
  const [plate, setPlate] = useState(query.get("plate") || "");
  const [code, setCode] = useState(query.get("code") || "");
  const [tracking, setTracking] = useState<Tracking>();
  const [message, setMessage] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPlate = plate.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const normalizedCode = code.replace(/\D/g, "");
    setTracking(undefined);
    if (!normalizedPlate || !/^\d{6}$/.test(normalizedCode)) {
      setMessage("Ingresa la placa y el código numérico de 6 dígitos.");
      return;
    }
    setLoading(true);
    setMessage(undefined);
    try {
      const query = `plate=${encodeURIComponent(normalizedPlate)}&code=${encodeURIComponent(normalizedCode)}`;
      let response: Response;
      try {
        response = await trackingFetch(`/api/v1/tracking?${query}`);
      } catch (proxyError) {
        const isLocalNetworkDevelopment = import.meta.env.DEV && location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
        if (!isLocalNetworkDevelopment) throw proxyError;
        response = await trackingFetch(`http://${location.hostname}:3000/api/v1/tracking?${query}`);
      }
      if (response.status === 404) {
        setMessage("No encontramos una orden con esos datos. Verifica la placa y el codigo exactamente como aparecen en tu constancia.");
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
        throw new Error(body?.error?.message || "No fue posible realizar la consulta.");
      }
      setTracking((await response.json() as { tracking: Tracking }).tracking);
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "AbortError" ? "La consulta tardó demasiado. Verifica la conexión e inténtalo nuevamente." : error instanceof Error ? error.message : "No fue posible realizar la consulta.");
    } finally {
      setLoading(false);
    }
  }

  const terminal = tracking?.publicStatus === "ENTREGADA" || tracking?.publicStatus === "CANCELADA";
  const meta = tracking ? statusMeta[tracking.publicStatus] : undefined;
  return (
    <main className="tracking-page">
      <header className="tracking-header"><img src={logo} alt="PARAUTOS" /></header>
      <section className="tracking-content">
        <div className="tracking-intro"><p>SEGUIMIENTO DE SERVICIO</p><h1>Consulta tu vehiculo</h1><span>Ingresa la placa y el código de 6 dígitos entregado por tu asesor en la recepción o constancia.</span></div>
        <form className="tracking-card" onSubmit={submit}>
          <div className="tracking-fields">
            <label>Placa<input value={plate} onChange={(event) => setPlate(event.target.value)} maxLength={16} autoCapitalize="characters" autoComplete="off" placeholder="ABC-123" /></label>
            <label>Código de consulta<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" placeholder="Ej. 123456" /></label>
            <button disabled={loading}>{loading ? "Consultando..." : "Consultar"}</button>
          </div>
          <p className="tracking-help">¿No tienes el código? Solicítalo a tu asesor de servicio. No se usa la contraseña de tu cuenta.</p>
          {message && <p className="tracking-message error" role="alert">{message}</p>}
          {tracking && terminal && <section className="tracking-result terminal" aria-live="polite"><h2>{tracking.publicStatus === "ENTREGADA" ? "Servicio finalizado" : "Seguimiento finalizado"}</h2><p>{tracking.publicStatus === "ENTREGADA" ? "El vehiculo fue entregado y este seguimiento ha concluido. Gracias por confiar en PARAUTOS." : "La atencion fue cancelada. Para cualquier consulta, comunicate con tu asesor de servicio."}</p></section>}
          {tracking && !terminal && meta && <section className="tracking-result" aria-live="polite"><small>ORDEN {tracking.orderNumber}</small><h2>{tracking.brand} {tracking.model} <span>{tracking.plate}</span></h2><p>Etapa actual: <strong>{meta.label}</strong></p><div className="tracking-progress" style={{ "--progress": `${meta.progress}%` } as CSSProperties}>{stages.map((stage, index) => <div className={meta.progress >= (index + 1) * 25 ? "done" : ""} key={stage}><i>{meta.progress >= (index + 1) * 25 ? "OK" : index + 1}</i><span>{stage}</span></div>)}</div><p className="tracking-note">Esta barra representa la etapa alcanzada, no el porcentaje fisico exacto de reparacion.</p></section>}
          {tracking && !terminal && !meta && <p className="tracking-message error" role="alert">No fue posible mostrar el estado de esta orden.</p>}
        </form>
      </section>
    </main>
  );
}
