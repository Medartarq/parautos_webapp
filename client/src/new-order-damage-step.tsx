import type { PointerEvent, RefObject } from "react";

type Point = { u: number; v: number };
type DamageBody = "V1" | "V2" | "V3" | "V4";
type Damage = { body: DamageBody; view: "01" | "02" | "03" | "04" | "05"; path: Point[] };

function DamageStepTitle({ n, title, text }: { n: string; title: string; text: string }) {
  return <div className="section-title"><span>{n}</span><div><h2>{title}</h2><small>{text}</small></div></div>;
}

const views: Array<[Damage["view"], string]> = [
  ["01", "Frontal"],
  ["02", "Superior"],
  ["03", "Posterior"],
  ["04", "Lateral izquierda"],
  ["05", "Lateral derecha"],
];
const damageBodies: Array<[DamageBody, string]> = [
  ["V1", "Camión furgón"],
  ["V2", "Camioneta pickup"],
  ["V3", "Automóvil sedán"],
  ["V4", "Camioneta SUV"],
];

export function DamageStep({
  body,
  damages,
  expanded,
  onClear,
  onFinish,
  onPaint,
  onRedo,
  onStart,
  onUndo,
  onView,
  setExpanded,
  view,
  canvas,
}: {
  body: DamageBody;
  damages: Damage[];
  expanded: boolean;
  onClear: () => void;
  onFinish: () => void;
  onPaint: (event: PointerEvent<HTMLCanvasElement>, color: string) => void;
  onRedo: () => void;
  onStart: (event: PointerEvent<HTMLCanvasElement>) => void;
  onUndo: () => void;
  onView: (view: Damage["view"]) => void;
  setExpanded: (value: boolean) => void;
  view: Damage["view"];
  canvas: RefObject<HTMLCanvasElement | null>;
}) {
  const viewIndex = views.findIndex(([id]) => id === view);
  const currentDamageCount = damages.filter(
    (damage) => damage.body === body && damage.view === view,
  ).length;
  const moveView = (offset: number) =>
    onView(views[(viewIndex + offset + views.length) % views.length][0]);
  return (
    <section className={`damage-step${expanded ? " is-expanded" : ""}`}>
      <DamageStepTitle
        n="✎"
        title="Daños visibles"
        text="Dibuja sobre cada vista de la carrocería registrada. Este paso es opcional."
      />
      <div className="damage-mobile-nav">
        <div>
          <small>
            Vista {viewIndex + 1} de {views.length}
          </small>
          <strong>{views[viewIndex][1]}</strong>
        </div>
        <div className="damage-nav-buttons">
          <button
            type="button"
            className="btn small"
            onClick={() => moveView(-1)}
            aria-label="Vista anterior"
          >
            ←
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => moveView(1)}
            aria-label="Vista siguiente"
          >
            →
          </button>
        </div>
      </div>
      <div className="damage-tabs">
        {views.map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={`${view === id ? "active" : ""}${damages.some((damage) => damage.body === body && damage.view === id) ? " marked" : ""}`}
            onClick={() => onView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="damage-editor">
        <div className="damage-editor-head">
          <span>
            {damageBodies.find(([id]) => id === body)?.[1]} ·{" "}
            {views[viewIndex][1]}
          </span>
          <button
            type="button"
            className="btn small"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Reducir" : "Ampliar"}
          </button>
        </div>
        <div className="damage-canvas-wrap">
          <img
            src={`/damage-assets/${body}-${view}.png`}
            alt={`Vista ${views[viewIndex][1]} de ${damageBodies.find(([id]) => id === body)?.[1]}`}
          />
          <canvas
            ref={canvas}
            className="damage-canvas"
            width="1200"
            height="700"
            onPointerDown={(event) => {
              if (event.pointerType !== "mouse" || event.button === 0)
                onStart(event);
            }}
            onPointerMove={(event) => onPaint(event, "#2563eb")}
            onPointerUp={onFinish}
            onPointerCancel={onFinish}
            onLostPointerCapture={onFinish}
          />
          <div className="damage-rotate">
            <strong>Gira el dispositivo</strong>
            <span>
              Las vistas laterales se revisan mejor en orientación horizontal.
            </span>
          </div>
        </div>
        <div className="canvas-tools">
          <span>
            {currentDamageCount} trazo{currentDamageCount === 1 ? "" : "s"} en
            esta vista.
          </span>
          <div>
            <button type="button" className="btn small" onClick={onUndo}>
              Deshacer
            </button>
            <button type="button" className="btn small" onClick={onRedo}>
              Rehacer
            </button>
            <button type="button" className="btn small" onClick={onClear}>
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
