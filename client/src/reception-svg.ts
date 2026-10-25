import { renderReceptionBodyDiagram, type VehicleDamage } from "./reception-svg-body";

type ChecklistEntry = { category: string; categoryOrder?: number; name: string; itemOrder?: number; answer: string; observation?: string };

export type ReceptionSvgData = {
  modality?: string;
  advisor?: string;
  claimNumber?: string;
  plate?: string;
  documentNumber?: string;
  brand?: string;
  client?: string;
  model?: string;
  phone?: string;
  year?: string | number;
  vin?: string;
  email?: string;
  mileage?: string | number;
  fuelLevel?: string | number;
  considerations?: string[];
  checklist: ChecklistEntry[];
  body?: string;
  damages: VehicleDamage[];
  signature?: string;
};

const TEMPLATE_URL = "/reception-template/checklist.identified.svg";
const SVG_END = /<\/svg>\s*$/i;
const SCALE = 21000 / 1100;
const toSvg = (value: number) => (value * SCALE).toFixed(2);
const escapeXml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;",
})[character] ?? character);
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const repairPersistedText = (value: unknown) => {
  const text = String(value ?? "");
  if (!/[ÃÂ]/.test(text)) return text;
  try { return decodeURIComponent(escape(text)); } catch { return text; }
};
const imageDataUrls = new Map<string, Promise<string>>();
let templatePromise: Promise<string> | undefined;

const inventoryOrder = [
  "emblemadelantero", "emblemaposterior", "antenaradio", "antenamotorola", "espejointerior", "espejoexterior", "farosdelanteros", "farosneblineros", "farosposteriores", "plumillasdelanteras", "plumillasposteriores",
  "radio", "claxon", "lunas", "encendedor", "cenicero", "controlradio", "mascaraderadio", "asientos", "alfombraspisos", "controlpuerta", "alarma",
  "llaverollave", "tapacombustible", "aros", "tapaaros", "llaveruedas", "ruedarepuesto", "herramientas", "gatapalanca", "botiquin", "extintor",
  "bloqueadortrabagas", "triangulo", "circulina", "escarpines", "tarjetapropiedad", "soat", "inspecciontecnica", "libretaservicio", "manualpropietario", "permisolunaspolarizadas", "seguroruedas", "segurovasos",
] as const;

// These names are the semantic IDs authored in checklist.identified.svg. They
// deliberately remain separate from the normalized catalog names used for
// matching API data.
const inventoryAnchorNames = [
  "emblema-delantero", "emblema-posterior", "antena-radio", "antena-motorola", "espejo-interior", "espejo-exterior", "faros-delanteros", "faros-neblineros", "faros-posteriores", "plumillas-delanteras", "plumillas-posteriores",
  "radio", "claxon", "lunas", "encendedor", "cenicero", "control-radio", "mascara-radio", "asientos", "alfombras-pisos", "control-puerta", "alarma",
  "llavero-llave", "tapa-combustible", "aros", "tapa-aros", "llave-ruedas", "rueda-repuesto", "herramientas", "gata-palanca", "botiquin", "extintor", "bloqueador-trabagas",
  "triangulo", "circulina", "escarpines", "tarjeta-propiedad", "soat", "inspeccion-tecnica", "libreta-servicio", "manual-propietario", "permiso-lunas-polarizadas", "seguro-ruedas", "seguro-vasos",
] as const;

const inventoryCategories = [
  "exterioreiluminacion",
  "interioryequipamiento",
  "accesoriosherramientasyseguridad",
  "documentosyadicionales",
] as const;

const inventoryAliases: Record<string, string[]> = {
  tapacombustible: ["tapadecombustible", "tapasdecombustible"],
  tapaaros: ["tapadearos"],
  llaveruedas: ["llavederuedas"],
  ruedarepuesto: ["ruedaderepuesto"],
  permisolunaspolarizadas: ["permisoparalunaspolarizadas"],
};

const checklistAnchorIds = inventoryAnchorNames.flatMap((name) => [`check-${name}-ok`, `check-${name}-obs`]);

function replaceTextById(svg: string, id: string, value: string): string {
  const expression = new RegExp(`(<text\\b(?=[^>]*\\bid="${id}")[^>]*>)[\\s\\S]*?(</text>)`);
  return svg.replace(expression, `$1${escapeXml(value)}$2`);
}

function applyChecklistMarks(svg: string, checklist: ChecklistEntry[]): string {
  const inventory = new Map(checklist.map((item) => [`${normalize(item.category)}:${normalize(item.name)}`, item.answer]));
  const orderedInventory = new Map(checklist.map((item) => [`${item.categoryOrder}:${item.itemOrder}`, item.answer]));
  let filled = svg;

  inventoryOrder.forEach((name, index) => {
    const categoryIndex = Math.floor(index / 11);
    const category = inventoryCategories[categoryIndex];
    // categoryOrder/itemOrder come from the same catalog that created the
    // reception. They are stable even if a printed or API item name changes.
    const orderedAnswer = orderedInventory.get(`${categoryIndex + 1}:${(index % 11) + 1}`);
    const namedAnswer = inventory.get(`${category}:${name}`) || inventoryAliases[name]
      ?.map((alias) => inventory.get(`${category}:${alias}`))
      .find((value) => value === "SI" || value === "NO");
    const answer = String(orderedAnswer || namedAnswer || "").trim().toUpperCase();
    const anchor = inventoryAnchorNames[index];
    filled = replaceTextById(filled, `check-${anchor}-ok`, answer === "SI" ? "X" : "");
    filled = replaceTextById(filled, `check-${anchor}-obs`, answer === "NO" ? "X" : "");
  });

  return filled;
}

const markerValues = (data: ReceptionSvgData) => ({
  __MODALIDAD__: data.modality,
  __FECHA__: new Date().toLocaleDateString("es-PE"),
  __HORA__: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
  __ASESOR__: data.advisor,
  __NUMERO_SINIESTRO__: data.claimNumber,
  __PLACA__: data.plate,
  __MARCA__: data.brand,
  __MODELO__: data.model,
  __ANIO__: data.year,
  __VIN__: data.vin,
  __DOCUMENTO__: data.documentNumber,
  __CLIENTE__: data.client,
  __TELEFONO__: data.phone,
  __CELULAR__: undefined,
  __CORREO__: data.email,
  __OBSERVACIONES__: "",
});

function layer(data: ReceptionSvgData, bodyDiagram: string): string {
  const observationText = [
    ...(data.considerations || []).map(repairPersistedText),
    ...data.checklist.filter((item) => item.observation).map((item) => `${repairPersistedText(item.name)}: ${repairPersistedText(item.observation)}`),
  ].filter(Boolean).join(", ");
  const observationLines: string[] = [];
  let line = "";
  for (const word of observationText.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 92 && line) { observationLines.push(line); line = word; }
    else line = next;
  }
  if (line) observationLines.push(line);
  if (observationLines.length > 4) observationLines.splice(3, observationLines.length - 3, `${observationLines.slice(3).join(" ").slice(0, 89).trimEnd()}…`);
  const observations = observationLines.map((entry, index) => `<text x="${toSvg(280)}" y="${toSvg(419 + index * 17)}" font-family="Arial, sans-serif" font-size="${toSvg(12)}" fill="#373435">${escapeXml(entry)}</text>`).join("");
  const fuelLevel = Number(data.fuelLevel);
  const fuel = Number.isFinite(fuelLevel) ? Math.max(0, Math.min(5, Math.round(fuelLevel / 20))) : 0;
  const fuelMarks = Array.from({ length: fuel }, (_, index) => `<text x="${toSvg(842 + index * 31)}" y="${toSvg(958)}" font-family="Arial, sans-serif" font-size="${toSvg(17)}" fill="#373435">X</text>`).join("");
  const digits = String(data.mileage ?? "").replace(/\D/g, "").slice(-8).padStart(8, " ");
  const mileage = [...digits].map((digit, index) => digit === " " ? "" : `<text x="${toSvg(813 + index * 25.9)}" y="${toSvg(1040)}" font-family="Arial, sans-serif" font-size="${toSvg(17)}" fill="#373435">${digit}</text>`).join("");
  const signature = data.signature?.startsWith("data:image/") ? `<image x="${toSvg(831)}" y="${toSvg(1116)}" width="${toSvg(154)}" height="${toSvg(44)}" preserveAspectRatio="xMidYMid meet" href="${escapeXml(data.signature)}"/>` : "";
  return `<g id="checklist-datos-generados">${observations}${fuelMarks}${mileage}${signature}${bodyDiagram}</g>`;
}

export async function loadReceptionSvgTemplate(): Promise<string> {
  templatePromise ??= fetch(TEMPLATE_URL)
    .then(async (response) => {
      if (!response.ok) throw new Error("No fue posible cargar la plantilla SVG de recepción.");
      const template = (await response.text())
        .replaceAll("Formato_checklist_Images/", "/reception-template/Formato_checklist_Images/")
        // The identified master was exported under its own filename, while the
        // project keeps the original static images in this shared directory.
        .replaceAll("checklist_base_Images\\", "/reception-template/Formato_checklist_Images/")
        .replaceAll("checklist_base_Images/", "/reception-template/Formato_checklist_Images/")
        .replaceAll("checklist_base_ImgID", "Formato_checklist_ImgID");
      const missingAnchors = checklistAnchorIds.filter((id) => !template.includes(`id="${id}"`));
      if (missingAnchors.length) throw new Error("La plantilla SVG no contiene todas las casillas identificadas del checklist.");
      return embedSvgImages(template);
    })
    .catch((error) => {
      templatePromise = undefined;
      throw error;
    });
  return templatePromise;
}

async function imageDataUrl(url: string): Promise<string> {
  let cached = imageDataUrls.get(url);
  if (!cached) {
    cached = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`No fue posible cargar una imagen del checklist (${response.status}).`);
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error(`El recurso de imagen del checklist no es válido: ${url}`);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    }).catch((error) => {
      imageDataUrls.delete(url);
      throw error;
    });
    imageDataUrls.set(url, cached);
  }
  return cached;
}

async function embedSvgImages(svg: string): Promise<string> {
  const urls = [...new Set([...svg.matchAll(/(?:xlink:)?href="([^"]+)"/g)].map((match) => match[1]).filter((url) => !url.startsWith("data:") && !url.startsWith("#")))];
  const embedded = new Map(await Promise.all(urls.map(async (url) => [url, await imageDataUrl(url)] as const)));
  return svg.replace(/((?:xlink:)?href=")([^"]+)(")/g, (source, prefix: string, url: string, suffix: string) => embedded.has(url) ? `${prefix}${embedded.get(url)}${suffix}` : source);
}

async function bodyAssetDataUrls(body: string): Promise<(body: string, view: VehicleDamage["view"]) => string> {
  const views: VehicleDamage["view"][] = ["01", "02", "03", "04", "05"];
  const urls = await Promise.all(views.map((view) => imageDataUrl(`/damage-assets/${encodeURIComponent(body)}-${view}.png`)));
  return (_body, view) => urls[views.indexOf(view)];
}

export function renderReceptionSvg(template: string, data: ReceptionSvgData, bodyAssetUrl?: (body: string, view: VehicleDamage["view"]) => string): string {
  if (!/viewBox\s*=\s*["']0 0 21000 29700["']/i.test(template)) throw new Error("La plantilla SVG A4 no es válida.");
  let svg = template.replace(/<g id="checklist-datos-generados">[\s\S]*?<\/g>\s*(?=<\/svg>)/, "");
  for (const [marker, value] of Object.entries(markerValues(data))) svg = svg.replaceAll(marker, escapeXml(value));
  svg = applyChecklistMarks(svg, data.checklist);
  if (!SVG_END.test(svg)) throw new Error("La plantilla SVG está incompleta.");
  const bodyLayer = bodyAssetUrl ? renderReceptionBodyDiagram({ body: data.body, damages: data.damages, assetUrl: bodyAssetUrl }) : renderReceptionBodyDiagram({ body: data.body, damages: data.damages });
  return svg.replace(SVG_END, `${layer(data, bodyLayer)}\n</svg>`);
}

export async function prepareReceptionSvg(data: ReceptionSvgData): Promise<string> {
  const body = data.body || "V3";
  const [template, assetUrl] = await Promise.all([loadReceptionSvgTemplate(), bodyAssetDataUrls(body)]);
  return renderReceptionSvg(template, data, assetUrl);
}

export function preloadReceptionPdfResources(body?: string): void {
  void Promise.all([loadReceptionSvgTemplate(), bodyAssetDataUrls(body || "V3"), import("jspdf"), import("svg2pdf.js")]).catch(() => undefined);
}
