import printLogo from "../../../documentos/prototipo/assets/logo_parautos.svg";
import printBrands from "../../../documentos/prototipo/assets/modelo/marcas.png";
import { A4_RECEPTION_PRINT_STYLES } from "./print-layout";

type Point = { u: number; v: number };
type Damage = {
  body: string;
  view: "01" | "02" | "03" | "04" | "05";
  path: Point[];
};

export type ReceptionPrintData = {
  modality?: string;
  claimNumber?: string;
  plate?: string;
  documentNumber?: string;
  brand?: string;
  client?: string;
  model?: string;
  phone?: string;
  year?: string | number;
  color?: string;
  vin?: string;
  email?: string;
  mileage?: string | number;
  fuelLevel?: string | number;
  considerations?: string[];
  checklist: Array<{
    category: string;
    name: string;
    answer: string;
    observation?: string;
  }>;
  body: string;
  damages: Damage[];
  evidenceCount?: number;
  signature?: string;
};

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character] || character,
  );

export function openReceptionPrint(data: ReceptionPrintData): void {
  const observation = (() => {
    const entries = [
      ...(data.considerations || []).map((consideration) => `${consideration}.`),
      ...data.checklist
        .filter((item) => item.observation)
        .map((item) => `${item.name}: ${item.observation}.`),
    ];
    let text = "";
    let extra = 0;
    for (const entry of entries) {
      const next = `${text ? " " : ""}${entry}`;
      if (text.length + next.length <= 440) text += next;
      else extra++;
    }
    return `${text}${extra ? ` (+${extra} mas)` : ""}`;
  })();
  const categories = [...new Set(data.checklist.map((item) => item.category))];
  const checklistGroups = categories.slice(0, 4).map((category) => ({
    category,
    items: data.checklist.filter((item) => item.category === category),
  }));
  const checklistRows = Math.max(...checklistGroups.map((group) => group.items.length));
  const checklist = `<table class="print-inventory"><colgroup>${checklistGroups.map(() => '<col style="width:32.1mm"><col style="width:6.45mm"><col style="width:6.45mm">').join("")}</colgroup><thead><tr>${checklistGroups.map((group) => `<th>${escape(group.category)}</th><th>SI</th><th>NO</th>`).join("")}</tr></thead><tbody>${Array.from({ length: checklistRows }, (_, row) => `<tr>${checklistGroups.map((group) => {
    const item = group.items[row];
    if (!item) return "<td></td><td></td><td></td>";
    return `<td title="${item.observation ? escape(item.observation) : ""}">${escape(item.name)}${item.observation ? " *" : ""}</td><td>${item.answer === "SI" ? "&#10003;" : ""}</td><td>${item.answer === "NO" ? "&#10007;" : ""}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table>`;
  const viewSlots: Array<[Damage["view"], string]> = [
    ["03", "rear"], ["02", "top"], ["01", "front"], ["04", "left"], ["05", "right"],
  ];
  const silhouetteRatios: Record<string, number> = {
    "V1-01": 682 / 585, "V1-02": 1556 / 612, "V1-03": 477 / 576, "V1-04": 1371 / 598, "V1-05": 1377 / 605,
    "V2-01": 755 / 562, "V2-02": 1530 / 640, "V2-03": 758 / 555, "V2-04": 1553 / 523, "V2-05": 1560 / 528,
    "V3-01": 731 / 651, "V3-02": 1481 / 676, "V3-03": 692 / 560, "V3-04": 1491 / 497, "V3-05": 1429 / 504,
    "V4-01": 710 / 635, "V4-02": 1491 / 667, "V4-03": 715 / 623, "V4-04": 1472 / 613, "V4-05": 1472 / 602,
  };
  const drawings = viewSlots.map(([damageView, slot]) => {
    const paths = data.damages
      .filter((damage) => damage.body === data.body && damage.view === damageView)
      .filter((damage) => damage.path.length > 1)
      .map((damage) => `<polyline points="${damage.path.map((point) => `${(point.u * 100).toFixed(2)},${(point.v * 100).toFixed(2)}`).join(" ")}"/>`)
      .join("");
    return `<div class="vehicle ${slot}" style="aspect-ratio:${silhouetteRatios[`${data.body}-${damageView}`] || 1.2}"><img src="${location.origin}/damage-assets/${data.body}-${damageView}.png" alt=""><svg viewBox="0 0 100 100" preserveAspectRatio="none">${paths}</svg></div>`;
  }).join("");
  const fuelLevel = Number(data.fuelLevel);
  const fuelIndex = Number.isFinite(fuelLevel) && data.fuelLevel !== "" && data.fuelLevel !== undefined ? Math.min(4, Math.max(0, Math.round(fuelLevel / 25))) : -1;
  const fuel = ["Vacio", "1/4", "1/2", "3/4", "Lleno"].map((label, index) => `<i class="fuel-tick${index === fuelIndex ? " selected" : ""}" title="${label}"></i>`).join("");
  const km = String(data.mileage || "").replace(/\D/g, "").slice(-8).padStart(8, " ").split("").map((digit) => `<i>${digit.trim()}</i>`).join("");
  const evidenceNote = data.evidenceCount ? ` · Evidencias: ${data.evidenceCount}` : "";
  const popup = window.open("", "parautos-recepcion", "width=900,height=700");
  if (!popup) return;
  popup.document.write(`<!doctype html><html><head><title>Recepción ${escape(data.plate || "")}</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#666;font-family:Calibri,Arial,sans-serif;color:#231f20}.sheet{position:relative;width:210mm;height:297mm;margin:auto;background:#fff;overflow:hidden;font-size:9pt;line-height:1}.title{position:absolute;left:15mm;top:10mm;font-size:18pt;font-weight:800;letter-spacing:.4mm}.subtitle{position:absolute;left:15mm;top:18mm;font-size:8pt;letter-spacing:.5mm}.rule,.bar{position:absolute;left:15mm;width:180mm;background:#231f20}.rule{top:24mm;height:.7mm}.bar{height:5.7mm;color:#fff;font-size:10pt;font-weight:700;text-align:center;padding-top:1.3mm}.bar.vehicle{top:42mm}.bar.inventory{top:93.3mm}.bar.body{top:163.5mm}.bar.terms{top:230mm}.field{position:absolute;display:flex;gap:1.5mm;align-items:end;height:4mm}.field b{font-weight:400;white-space:nowrap}.field span{flex:1;border-bottom:.25mm solid #231f20;height:3.3mm;overflow:hidden;white-space:nowrap}.v1{left:28.3mm;width:62mm}.v2{left:104.1mm;width:62mm}.r1{top:30.7mm}.r2{top:35.5mm}.r3{top:52.1mm}.r4{top:56.9mm}.r5{top:61.7mm}.r6{top:66.5mm}.r7{top:71.3mm}.obs-label{position:absolute;left:28.6mm;top:77.4mm}.obs{position:absolute;left:55mm;top:76.5mm;width:140mm;height:15mm;font-size:8pt;line-height:1.2;overflow:hidden}.checklist{position:absolute;left:15mm;top:99mm;width:180mm;height:62.5mm;display:grid;grid-template-columns:repeat(4,45mm);overflow:hidden}.check-group{display:grid;grid-auto-rows:5.12mm;grid-template-columns:32.1mm 6.45mm 6.45mm}.check-head,.check-row{display:contents}.check-head i,.check-row i{border:.25mm solid #231f20;font-style:normal;overflow:hidden}.check-head i{border-bottom:0;text-align:center;padding-top:1.1mm;font-size:7.2pt}.check-head i:first-child{font-size:6pt;text-align:left;padding:1.1mm 1mm 0}.check-head i:not(:first-child){background:#231f20;color:#fff;font-weight:700}.check-row i{border-right:0;border-bottom:0;padding:1mm;font-size:6.8pt;white-space:nowrap;text-overflow:ellipsis}.check-row i:first-child{border-left:0}.check-row i.on{background:#231f20}.diagram{position:absolute;left:15mm;top:171.2mm;width:136.5mm;height:56.5mm;border:.5mm solid #231f20}.vehicle{position:absolute}.vehicle img,.vehicle svg{width:100%;height:100%;display:block;position:absolute}.vehicle svg{fill:none;stroke:#2563eb;stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.rear{left:1.2mm;top:1.6mm;width:29mm;aspect-ratio:1.23}.top{left:33.4mm;top:1.2mm;width:69.7mm;aspect-ratio:2.25}.front{right:1.2mm;top:1.6mm;width:29mm;aspect-ratio:1.14}.left{left:1.2mm;bottom:1.4mm;width:65.5mm;aspect-ratio:2.9}.right{right:1.2mm;bottom:1.4mm;width:65.5mm;aspect-ratio:2.9}.side{position:absolute;left:152.9mm;top:171.2mm;width:42mm;height:56.5mm;display:grid;grid-template-rows:13.9mm 12.5mm 1fr;gap:1.2mm}.box{position:relative;border:.5mm solid #231f20;text-align:center}.box strong{display:block;margin-top:1.8mm;font-size:10pt}.fuel i{display:inline-block;width:.6mm;height:4.5mm;background:#231f20;margin:2.5mm 3.1mm 0}.fuel i.selected{width:1.2mm;background:#ed3337}.km i{display:inline-grid;place-items:center;width:4.55mm;height:5.1mm;border:.25mm solid #231f20;border-right:0;margin-top:1mm;font-style:normal}.km i:last-child{border-right:.25mm solid #231f20}.sign{font-size:5.2pt;font-weight:700;line-height:1.25;padding:1mm}.sign img{position:absolute;left:3mm;bottom:5mm;width:36mm;height:13mm;object-fit:contain}.sign label{position:absolute;bottom:1.1mm;left:0;right:0;font-size:8pt}.terms-text{position:absolute;left:15mm;top:237mm;width:180mm;height:32mm;margin:0;overflow:hidden;font-size:7.6pt;line-height:1.18;text-align:justify}.footer{position:absolute;left:15mm;top:271.3mm;width:180mm;height:5.7mm;background:#231f20;color:#fff;text-align:center;padding-top:1.5mm;font-size:8pt}@media print{body{background:#fff}.sheet{margin:0}}</style></head><body><article class="sheet"><div class="title">PARAUTOS</div><div class="subtitle">CHECKLIST DE SERVICIO · CONSTANCIA DE RECEPCION${escape(evidenceNote)}</div><div class="rule"></div><div class="field v1 r1"><b>MODALIDAD:</b><span>${escape(data.modality || "")}</span></div><div class="field v2 r1"><b>ASESOR:</b><span></span></div><div class="field v1 r2"><b>FECHA:</b><span>${new Date().toLocaleDateString("es-PE")}</span></div><div class="field v2 r2"><b>NRO. SINIESTRO:</b><span>${escape(data.claimNumber || "")}</span></div><div class="bar vehicle">DATOS DEL VEHICULO Y CLIENTE</div><div class="field v1 r3"><b>PLACA:</b><span>${escape(data.plate || "")}</span></div><div class="field v2 r3"><b>DNI:</b><span>${escape(data.documentNumber || "")}</span></div><div class="field v1 r4"><b>MARCA:</b><span>${escape(data.brand || "")}</span></div><div class="field v2 r4"><b>CLIENTE:</b><span>${escape(data.client || "")}</span></div><div class="field v1 r5"><b>MODELO:</b><span>${escape(data.model || "")}</span></div><div class="field v2 r5"><b>TELEFONO:</b><span>${escape(data.phone || "")}</span></div><div class="field v1 r6"><b>AÑO:</b><span>${escape(String(data.year || ""))}</span></div><div class="field v2 r6"><b>COLOR:</b><span>${escape(data.color || "")}</span></div><div class="field v1 r7"><b>VIN:</b><span>${escape(data.vin || "")}</span></div><div class="field v2 r7"><b>E-MAIL:</b><span>${escape(data.email || "")}</span></div><div class="obs-label">OBSERVACIONES:</div><div class="obs">${escape(observation)}</div><div class="bar inventory">INVENTARIO DEL VEHICULO</div><div class="checklist">${checklist}</div><div class="bar body">CARROCERIA DEL VEHICULO</div><div class="diagram">${drawings}</div><div class="side"><div class="box fuel"><strong>COMBUSTIBLE</strong>${fuel}</div><div class="box"><strong>KILOMETRAJE</strong><div class="km">${km}</div></div><div class="box sign">FIRMA DE AUTORIZACION PARA LA REALIZACION DE TRABAJOS Y CONFORMIDAD DE INVENTARIO Y CONDICIONES DEL SERVICIO${data.signature ? `<img src="${data.signature}" alt="Firma del cliente">` : ""}<label>FIRMA DEL CLIENTE</label></div></div><div class="bar terms">CONDICIONES DEL SERVICIO</div><p class="terms-text">En caso EL CLIENTE no cumpla con retirar su vehículo dentro del plazo de tres (3) días, computados a partir de la fecha de haber recibido el aviso sobre la culminación del trabajo, LA EMPRESA cobrará la suma de S/. 50.00 diarios por el espacio que ocupa el vehículo. LA EMPRESA se compromete a efectuar la reparación, mantenimiento u otro similar en el plazo señalado, salvo caso fortuito, fuerza mayor, actos de terceros ajenos a nuestro personal, actos u omisiones del cliente. Si fuera necesaria una reparación de mayor volumen o plazo, LA EMPRESA comunicará a EL CLIENTE el plazo extraordinario. En ningún caso EL CLIENTE tendrá facultad para reclamar indemnización por daños, perjuicios o lucro cesante. Se considerará como vehículo entregado cuando EL CLIENTE firme el documento de conformidad de salida. LA EMPRESA queda autorizada a ejercer derecho de retención hasta que la deuda sea cancelada.</p><div class="footer">044-533665 · 952394849 &nbsp; | &nbsp; Avenida America Norte #2404, Urbanizacion Primavera</div></article><script>window.onload=()=>window.print()<\/script></body></html>`);
  const sheet = popup.document.querySelector<HTMLElement>(".sheet");
  if (sheet) {
    sheet.querySelector<HTMLElement>(".title")?.replaceChildren("CHECKLIST DE SERVICIO");
    const logo = popup.document.createElement("img");
    logo.className = "print-logo";
    logo.src = printLogo;
    logo.alt = "PARAUTOS";
    sheet.prepend(logo);
    const footer = popup.document.createElement("div");
    footer.className = "print-footer";
    footer.innerHTML = "&#9742; 044-533665 - 952394849<span></span>&#9679; Avenida América Norte #2404. Urbanización Primavera.";
    sheet.append(footer);
    const brands = popup.document.createElement("img");
    brands.className = "print-brands";
    brands.src = printBrands;
    brands.alt = "Marcas atendidas";
    sheet.append(brands);
    const fuelLabel = Array.from(sheet.querySelectorAll<HTMLElement>("*")).find((element) => element.textContent?.trim() === "COMBUSTIBLE");
    const mileageLabel = Array.from(sheet.querySelectorAll<HTMLElement>("*")).find((element) => element.textContent?.trim() === "KILOMETRAJE");
    (sheet.querySelector<HTMLElement>(".side") || fuelLabel?.parentElement?.parentElement)?.classList.add("reference-side");
    fuelLabel?.parentElement?.classList.add("reference-fuel");
    mileageLabel?.classList.add("print-km-title");
    mileageLabel?.parentElement?.classList.add("reference-km");
    const observationLabel = sheet.querySelector<HTMLElement>(".obs-label");
    const observationBody = sheet.querySelector<HTMLElement>(".obs");
    if (observationLabel && observationBody) {
      const observationTable = popup.document.createElement("table");
      observationTable.className = "print-observations";
      observationTable.innerHTML = `<tbody><tr><th>OBSERVACIONES:</th><td>${escape(observation) || "&nbsp;"}</td></tr></tbody>`;
      observationLabel.before(observationTable);
      observationLabel.remove();
      observationBody.remove();
    }
  }
  popup.document.head.insertAdjacentHTML("beforeend", `<style>${A4_RECEPTION_PRINT_STYLES}</style>`);
  popup.document.close();
}
