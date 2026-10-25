/**
 * Renders the vehicle-damage panel in the checklist SVG coordinate system.
 *
 * Damage points are persisted normalized (0..1) by the reception wizard, so
 * they remain independent from the dimensions of the SVG master and from the
 * dimensions of each body silhouette.
 */
export type DamageView = "01" | "02" | "03" | "04" | "05";

export type DamagePoint = { u: number; v: number };

export type VehicleDamage = {
  body: string;
  view: DamageView;
  path: DamagePoint[];
};

type DiagramSlot = {
  view: DamageView;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** The inner area of "CARROCERÍA DEL VEHÍCULO" in Formato_checklist.svg. */
export const RECEPTION_BODY_DIAGRAM = {
  x: 1500,
  y: 17120,
  width: 13650,
  height: 5650,
} as const;

const slots: readonly DiagramSlot[] = [
  { view: "03", x: 120, y: 160, width: 2900, height: 2358 },
  { view: "02", x: 3340, y: 120, width: 6970, height: 3098 },
  { view: "01", x: 10630, y: 160, width: 2900, height: 2544 },
  { view: "04", x: 120, y: 3251, width: 6550, height: 2259 },
  { view: "05", x: 6960, y: 3251, width: 6550, height: 2259 },
];

const escapeXml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&apos;",
  '"': "&quot;",
})[character] ?? character);

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function normalizedPolyline(path: DamagePoint[]): string | undefined {
  const points = path
    .filter((point) => Number.isFinite(point.u) && Number.isFinite(point.v))
    .map((point) => `${(clamp(point.u) * 100).toFixed(2)},${(clamp(point.v) * 100).toFixed(2)}`);

  return points.length > 1 ? points.join(" ") : undefined;
}

/** Returns the public URL for a silhouette used by the reception damage editor. */
export function damageAssetUrl(body: string, view: DamageView): string {
  return `/damage-assets/${encodeURIComponent(body)}-${view}.png`;
}

/**
 * Builds a vector SVG layer for the vehicle diagram and its registered damage
 * strokes. The silhouettes are PNG assets; the damage strokes remain vectors.
 */
export function renderReceptionBodyDiagram({
  body,
  damages,
  assetUrl = damageAssetUrl,
}: {
  body?: string;
  damages: VehicleDamage[];
  assetUrl?: (body: string, view: DamageView) => string;
}): string {
  const selectedBody = body || "V3";
  const marksByView = new Map<DamageView, string[]>();

  for (const damage of damages) {
    if (damage.body !== selectedBody) continue;
    const points = normalizedPolyline(damage.path);
    if (!points) continue;
    const marks = marksByView.get(damage.view) || [];
    marks.push(`<polyline points="${points}"/>`);
    marksByView.set(damage.view, marks);
  }

  const views = slots.map((slot) => {
    const href = escapeXml(assetUrl(selectedBody, slot.view));
    const marks = marksByView.get(slot.view)?.join("") || "";
    return `<svg x="${RECEPTION_BODY_DIAGRAM.x + slot.x}" y="${RECEPTION_BODY_DIAGRAM.y + slot.y}" width="${slot.width}" height="${slot.height}" viewBox="0 0 100 100" preserveAspectRatio="none"><image href="${href}" width="100" height="100" preserveAspectRatio="none"/><g fill="none" stroke="#2563eb" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">${marks}</g></svg>`;
  }).join("");

  return `<g id="checklist-body-diagram">${views}</g>`;
}
