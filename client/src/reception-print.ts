import { loadPdfLibrary } from "./pdf-library";
import { prepareReceptionSvg } from "./reception-svg";

type Point = { u: number; v: number };
type Damage = {
  body: string;
  view: "01" | "02" | "03" | "04" | "05";
  path: Point[];
};

export type ReceptionPrintData = {
  receivedAt?: string;
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


const blobAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const signatureDataUrls = new Map<string, Promise<string>>();

async function embedSignature(signature?: string): Promise<string | undefined> {
  if (!signature || signature.startsWith("data:")) return signature;
  let cached = signatureDataUrls.get(signature);
  if (!cached) {
    cached = fetch(signature, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("No fue posible cargar la firma.");
        return blobAsDataUrl(await response.blob());
      })
      .catch((error) => {
        signatureDataUrls.delete(signature);
        throw error;
      });
    signatureDataUrls.set(signature, cached);
  }
  try {
    return await cached;
  } catch {
    return signature;
  }
}

export async function downloadReceptionPdf(data: ReceptionPrintData, orderNumber: string): Promise<void> {
  const [signature, { jsPDF }, { svg2pdf }] = await Promise.all([
    embedSignature(data.signature),
    loadPdfLibrary(),
    import("svg2pdf.js"),
  ]);
  const source = await prepareReceptionSvg({ ...data, signature });
  const xml = new DOMParser().parseFromString(source, "image/svg+xml");
  const svg = xml.documentElement;
  if (svg.nodeName.toLowerCase() !== "svg" || xml.querySelector("parsererror")) {
    throw new Error("No fue posible preparar la plantilla SVG de recepción.");
  }
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  await svg2pdf(svg, pdf, { x: 0, y: 0, width: 210, height: 297, loadImages: true });
  pdf.save(`Checklist_A4_${orderNumber}.pdf`);
}
