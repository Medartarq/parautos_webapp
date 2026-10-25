import type { Dispatch, MutableRefObject, PointerEvent, RefObject, SetStateAction } from "react";

type Point = { u: number; v: number };
type Evidence = { file: File; preview: string };
type Damage = { body: string; view: string; path: Point[] };
type SummaryProps = {
  d: Record<string, string>;
  answers: Record<number, "SI" | "NO">;
  files: Evidence[];
  damages: Damage[];
  signatureCanvas: RefObject<HTMLCanvasElement | null>;
  stroke: MutableRefObject<Point[]>;
  point: (event: PointerEvent<HTMLCanvasElement>) => Point;
  paint: (event: PointerEvent<HTMLCanvasElement>, color: string) => void;
  finishSignature: () => void;
  setSignature: Dispatch<SetStateAction<string>>;
  reviewed: boolean;
  setReviewed: Dispatch<SetStateAction<boolean>>;
  accepted: boolean;
  setAccepted: Dispatch<SetStateAction<boolean>>;
};

function StepTitle({ n, title, text }: { n: string; title: string; text: string }) {
  return <div className="section-title"><span>{n}</span><div><h2>{title}</h2><small>{text}</small></div></div>;
}

export function SummaryStep({ d, answers, files, damages, signatureCanvas, stroke, point, paint, finishSignature, setSignature, reviewed, setReviewed, accepted, setAccepted }: SummaryProps) {
  return (
    <> <div className="summary">
            <StepTitle
              n="7"
              title="Resumen y firma"
              text="La orden se crea solo después de estas confirmaciones."
            />
            <div className="summary-grid">
              <article>
                <small>Cliente</small>
                <strong>{d.client || d.document}</strong>
                <span>{d.document}</span>
              </article>
              <article>
                <small>Vehículo</small>
                <strong>
                  {d.brand} {d.model} · {d.color}
                </strong>
                <span>{d.plate}</span>
              </article>
              <article>
                <small>Ingreso</small>
                <strong>{d.mileage || "No registrado"} km</strong>
                <span>
                  Combustible: {d.fuel ? `${d.fuel}%` : "No registrado"}
                </span>
              </article>
              <article>
                <small>Registro</small>
                <strong>{Object.keys(answers).length}/44 checklist</strong>
                <span>
                  {files.length} evidencias ·{" "}
                  {
                    new Set(
                      damages.map((damage) => `${damage.body}-${damage.view}`),
                    ).size
                  }{" "}
                  vistas marcadas
                </span>
              </article>
            </div>
            <section className="signature-panel">
              <header>
                <div><h3>Firma de conformidad</h3><p>Solicite al cliente firmar dentro del recuadro.</p></div>
              </header>
              <div className="signature-surface">
                <canvas
                  ref={signatureCanvas}
                  className="signature-canvas"
                  width="800"
                  height="190"
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    stroke.current = [point(event)];
                  }}
                  onPointerMove={(event) => paint(event, "#17212b")}
                  onPointerUp={finishSignature}
                />
                <span>Firma del cliente</span>
              </div>
              <footer><small>Use el mouse o el tacto para registrar la firma.</small><button type="button" className="btn small" onClick={() => { const canvas = signatureCanvas.current; canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height); setSignature(""); }}>Limpiar firma</button></footer>
            </section>
            <section className="summary-confirmations">
              <header><strong>Confirmaciones finales</strong><span>Necesarias para crear la orden.</span></header>
              <label>
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                Checklist revisado completamente.
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                Acepto las condiciones de ingreso.
              </label>
            </section>
            {(!d.mileage || !d.fuel) && (
              <div className="summary-warning">
                <strong>Información de ingreso incompleta:</strong> kilometraje
                y/o combustible no registrado. Puedes confirmar bajo
                responsabilidad del asesor.
              </div>
            )}
          </div>
    </>
  );
}

