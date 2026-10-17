import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
  type ReactNode,
} from "react";
import {
  isRecognizedPlate,
  normalizePlate,
  receptionStepOneSchema,
} from "@parautos/shared";
import "./full-new-order.css";
import "./body-type-suggestion";
import "./checklist-parity";
import "./demo-fill";
import { openReceptionPrint } from "./reception-print";

type Catalog = {
  bodyTypes: Array<{ id: number; code: DamageBody; name: string }>;
  checklist: Array<{ id: number; category: string; name: string }>;
};
type Point = { u: number; v: number };
type Evidence = { file: File; preview: string };
type DamageBody = "V1" | "V2" | "V3" | "V4";
type Damage = {
  body: DamageBody;
  view: "01" | "02" | "03" | "04" | "05";
  path: Point[];
};
type ReceptionDraftPayload = {
  d: Record<string, string>;
  answers: Record<number, "SI" | "NO">;
  notes: Record<number, string>;
  flagsSelected: string[];
  damages: Damage[];
  view: Damage["view"];
  diagnosisLegibility: "PENDIENTE" | "LEGIBLE" | "ILEGIBLE";
  diagnosisReviewState: "PENDIENTE_REVISION" | "REVISADA";
  signature: string;
  reviewed: boolean;
  accepted: boolean;
};
type StoredReceptionDraft = { revision?: number; currentStep: number; payload: ReceptionDraftPayload };
type StoredReceptionMedia = { files: File[]; diagnosisFile?: File };
const steps = [
  "Datos",
  "Checklist",
  "Consideraciones",
  "Daños",
  "Evidencias",
  "Diagnóstico",
  "Resumen",
];
const colors = [
  "Blanco",
  "Negro",
  "Gris",
  "Plata",
  "Rojo",
  "Azul",
  "Verde",
  "Amarillo",
  "Beige",
  "Marrón",
  "Naranja",
];
const brands: Record<string, string[]> = {
  TOYOTA: [
    "COROLLA",
    "HILUX",
    "RAV4",
    "YARIS",
    "FORTUNER",
    "LAND CRUISER",
    "AVANZA",
    "ETIOS",
    "PRIUS",
  ],
  SUBARU: ["FORESTER", "XV", "CROSSTREK", "OUTBACK", "IMPREZA", "WRX"],
  MITSUBISHI: ["OUTLANDER", "L200", "ASX", "ECLIPSE CROSS", "MONTERO"],
  HINO: ["300", "500", "DUTRO", "RANGER"],
  HYUNDAI: ["TUCSON", "ACCENT", "SANTA FE", "ELANTRA", "CRETA", "H1", "PORTER"],
  KIA: ["SPORTAGE", "SORENTO", "RIO", "SELTOS", "PICANTO", "CARNIVAL"],
  NISSAN: ["SENTRA", "VERSA", "QASHQAI", "X-TRAIL", "NAVARA", "KICKS"],
  MAZDA: ["MAZDA 2", "MAZDA 3", "CX-3", "CX-5", "CX-9", "BT-50"],
  HONDA: ["CIVIC", "CR-V", "HR-V", "PILOT", "FIT"],
  VOLKSWAGEN: ["GOL", "POLO", "JETTA", "TIGUAN", "AMAROK"],
  FORD: ["RANGER", "EVEREST", "ESCAPE", "EXPLORER", "MUSTANG"],
  CHEVROLET: ["ONIX", "TRACKER", "CAPTIVA", "COLORADO", "SPARK"],
  SUZUKI: ["SWIFT", "VITARA", "S-CROSS", "JIMNY", "ERTIGA"],
  BMW: ["SERIE 1", "SERIE 3", "X1", "X3", "X5"],
  "MERCEDES-BENZ": ["CLASE A", "CLASE C", "GLA", "GLC", "SPRINTER"],
};
const flags = [
  "Vehículo presenta suciedad que impide la revisión eficaz",
  "Interior con objetos personales que deben retirarse",
  "Manchas de aceite en el piso inferior",
  "Abolladuras con deformación de la plancha",
  "Vidrios con grietas o impactos",
  "Documentación incompleta o con datos que no coinciden",
];
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

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "include",
    ...options,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as {
      error?: { message?: string };
    };
    const error = new Error(body?.error?.message ?? "No fue posible completar la operación.") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json();
}

const receptionDraftStore = "parautos-reception-drafts";
const receptionDraftKey = "current-user";
const receptionMediaKey = "current-user-media";
function createReceptionStores(database: IDBDatabase) {
  if (!database.objectStoreNames.contains("drafts")) database.createObjectStore("drafts");
  if (!database.objectStoreNames.contains("media")) database.createObjectStore("media");
}
async function localReceptionDraft(read = false, value?: StoredReceptionDraft) {
  return new Promise<StoredReceptionDraft | undefined>((resolve) => {
    const request = indexedDB.open(receptionDraftStore, 2);
    request.onupgradeneeded = () => createReceptionStores(request.result);
    request.onerror = () => resolve(undefined);
    request.onsuccess = () => {
      const transaction = request.result.transaction("drafts", read ? "readonly" : "readwrite");
      const store = transaction.objectStore("drafts");
      const operation = read ? store.get(receptionDraftKey) : store.put(value, receptionDraftKey);
      operation.onsuccess = () => resolve(read ? operation.result as StoredReceptionDraft | undefined : value);
      operation.onerror = () => resolve(undefined);
    };
  });
}
async function clearLocalReceptionDraft() {
  return new Promise<void>((resolve) => {
    const request = indexedDB.open(receptionDraftStore, 2);
    request.onupgradeneeded = () => createReceptionStores(request.result);
    request.onerror = () => resolve();
    request.onsuccess = () => { const transaction = request.result.transaction("drafts", "readwrite"); transaction.objectStore("drafts").delete(receptionDraftKey); transaction.oncomplete = () => resolve(); transaction.onerror = () => resolve(); };
  });
}
async function localReceptionMedia(read = false, value?: StoredReceptionMedia) {
  return new Promise<StoredReceptionMedia | undefined>((resolve) => {
    const request = indexedDB.open(receptionDraftStore, 2);
    request.onupgradeneeded = () => createReceptionStores(request.result);
    request.onerror = () => resolve(undefined);
    request.onsuccess = () => {
      const transaction = request.result.transaction("media", read ? "readonly" : "readwrite");
      const store = transaction.objectStore("media");
      const operation = read ? store.get(receptionMediaKey) : store.put(value, receptionMediaKey);
      operation.onsuccess = () => resolve(read ? operation.result as StoredReceptionMedia | undefined : value);
      operation.onerror = () => resolve(undefined);
    };
  });
}
async function clearLocalReceptionMedia() {
  return new Promise<void>((resolve) => {
    const request = indexedDB.open(receptionDraftStore, 2);
    request.onupgradeneeded = () => createReceptionStores(request.result);
    request.onerror = () => resolve();
    request.onsuccess = () => { const transaction = request.result.transaction("media", "readwrite"); transaction.objectStore("media").delete(receptionMediaKey); transaction.oncomplete = () => resolve(); transaction.onerror = () => resolve(); };
  });
}
function readImagePreview(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function NewOrder({ onCreated }: { onCreated: () => void }) {
  const [catalog, setCatalog] = useState<Catalog>();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Record<string, string>>({
    modality: "PARTICULAR",
    colorType: "CATALOGO",
    fuel: "",
  });
  const [answers, setAnswers] = useState<Record<number, "SI" | "NO">>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [openChecklistCategory, setOpenChecklistCategory] = useState<string>();
  const [openChecklistNotes, setOpenChecklistNotes] = useState<Record<number, boolean>>({});
  const [checklistUndo, setChecklistUndo] = useState<{ category: string; answers: Record<number, "SI" | "NO" | undefined>; notes: Record<number, string | undefined> }>();
  const [flagsSelected, setFlagsSelected] = useState<string[]>([]);
  const [damages, setDamages] = useState<Damage[]>([]);
  const [undoneDamages, setUndoneDamages] = useState<Damage[]>([]);
  const [view, setView] = useState<Damage["view"]>("01");
  const [damageExpanded, setDamageExpanded] = useState(false);
  const [files, setFiles] = useState<Evidence[]>([]);
  const [diagnosisFile, setDiagnosisFile] = useState<File>();
  const [diagnosisPreview, setDiagnosisPreview] = useState("");
  const [diagnosisLegibility, setDiagnosisLegibility] = useState<
    "PENDIENTE" | "LEGIBLE" | "ILEGIBLE"
  >("PENDIENTE");
  const [diagnosisReviewState, setDiagnosisReviewState] = useState<
    "PENDIENTE_REVISION" | "REVISADA"
  >("PENDIENTE_REVISION");
  const [signature, setSignature] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{ id: number; orderNumber: string }>();
  const [uploadedEvidence, setUploadedEvidence] = useState<number[]>([]);
  const [diagnosisUploaded, setDiagnosisUploaded] = useState(false);
  const [draftRevision, setDraftRevision] = useState<number>();
  const [draftReady, setDraftReady] = useState(false);
  const [syncState, setSyncState] = useState<"loading" | "saved" | "saving" | "offline" | "conflict">("loading");
  const [syncRetry, setSyncRetry] = useState(0);
  const [cameraTarget, setCameraTarget] = useState<"evidence" | "diagnosis">();
  const damageCanvas = useRef<HTMLCanvasElement>(null);
  const signatureCanvas = useRef<HTMLCanvasElement>(null);
  const evidenceDeviceInput = useRef<HTMLInputElement>(null);
  const diagnosisDeviceInput = useRef<HTMLInputElement>(null);
  const stroke = useRef<Point[]>([]);
  const skipInitialDraftSave = useRef(true);
  const draftRevisionRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    api<Catalog>("/orders/reception-catalog")
      .then(setCatalog)
      .catch((error: Error) => setMessage(error.message));
  }, []);
  useEffect(() => {
    const retry = () => setSyncRetry((current) => current + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);
  useEffect(() => { draftRevisionRef.current = draftRevision; }, [draftRevision]);
  useEffect(() => {
    if (!draftReady) return;
    const checkRemoteDraft = () => {
      if (!navigator.onLine) return;
      api<{ draft?: StoredReceptionDraft }>("/orders/reception-draft").then(({ draft }) => {
        if (draft && draftRevisionRef.current !== undefined && draft.revision !== draftRevisionRef.current) setSyncState("conflict");
      }).catch(() => undefined);
    };
    const interval = window.setInterval(checkRemoteDraft, 30000);
    window.addEventListener("focus", checkRemoteDraft);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", checkRemoteDraft); };
  }, [draftReady]);
  useEffect(() => {
    const loadDemo = () => {
      if (!catalog) return;
      const body =
        catalog.bodyTypes.find((item) => item.name === "Camioneta pickup") ||
        catalog.bodyTypes[0];
      const demoAnswers: Record<number, "SI" | "NO"> = {};
      catalog.checklist.forEach((item, index) => {
        demoAnswers[item.id] = index % 7 === 0 ? "NO" : "SI";
      });
      setD({
        document: "70894561",
        client: "María Fernanda Torres",
        phone: "987654321",
        email: "maria.torres@demo.pe",
        plate: "ABC-123",
        modality: "MAPFRE",
        claim: "SIN-2026-00421",
        claimPending: "false",
        brand: "TOYOTA",
        model: "HILUX",
        color: "Blanco",
        colorType: "CATALOGO",
        body: String(body.id),
        year: "2024",
        vin: "8AJHA8CD0R1234567",
        mileage: "24580",
        fuel: "75",
        diagnosis:
          "Revisión demostrativa: se identifican daños leves de carrocería y se recomienda evaluación de pintura.",
      });
      setAnswers(demoAnswers);
      setNotes({
        [catalog.checklist[0].id]:
          "Registro de demostración para revisión del flujo.",
      });
      setFlagsSelected([flags[0], flags[1]]);
      setDamages([]);
      setFiles([]);
      setDiagnosisFile(undefined);
      setDiagnosisPreview("");
      setDiagnosisLegibility("PENDIENTE");
      setDiagnosisReviewState("PENDIENTE_REVISION");
      setSignature(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5wQAAAABJRU5ErkJggg==",
      );
      setReviewed(true);
      setAccepted(true);
      setMessage(
        "Datos de demostración cargados. Revisa los siete pasos antes de crear la orden.",
      );
      setStep(0);
    };
    window.addEventListener("parautos:fill-demo", loadDemo);
    return () => window.removeEventListener("parautos:fill-demo", loadDemo);
  }, [catalog]);
  const receptionPayload: ReceptionDraftPayload = { d, answers, notes, flagsSelected, damages, view, diagnosisLegibility, diagnosisReviewState, signature, reviewed, accepted };
  const serializedReceptionDraft = JSON.stringify({ currentStep: step, payload: receptionPayload });
  useEffect(() => {
    let active = true;
    const restore = async () => {
      const [local, localMedia] = await Promise.all([localReceptionDraft(true), localReceptionMedia(true)]);
      try {
        const result = await api<{ draft?: StoredReceptionDraft }>("/orders/reception-draft");
        const draft = result.draft;
        if (active && draft) {
          setD(draft.payload.d || {}); setAnswers(draft.payload.answers || {}); setNotes(draft.payload.notes || {});
          setFlagsSelected(draft.payload.flagsSelected || []); setDamages(draft.payload.damages || []); setView(draft.payload.view || "01");
          setDiagnosisLegibility(draft.payload.diagnosisLegibility || "PENDIENTE"); setDiagnosisReviewState(draft.payload.diagnosisReviewState || "PENDIENTE_REVISION");
          setSignature(draft.payload.signature || ""); setReviewed(Boolean(draft.payload.reviewed)); setAccepted(Boolean(draft.payload.accepted));
          setStep(draft.currentStep || 0); setDraftRevision(draft.revision); setSyncState("saved");
          void localReceptionDraft(false, draft);
        } else if (active) setSyncState("saved");
      } catch {
        if (active && local) {
          setD(local.payload.d || {}); setAnswers(local.payload.answers || {}); setNotes(local.payload.notes || {});
          setFlagsSelected(local.payload.flagsSelected || []); setDamages(local.payload.damages || []); setView(local.payload.view || "01");
          setDiagnosisLegibility(local.payload.diagnosisLegibility || "PENDIENTE"); setDiagnosisReviewState(local.payload.diagnosisReviewState || "PENDIENTE_REVISION");
          setSignature(local.payload.signature || ""); setReviewed(Boolean(local.payload.reviewed)); setAccepted(Boolean(local.payload.accepted));
          setStep(local.currentStep || 0); setDraftRevision(local.revision); setSyncState("offline");
        } else if (active) setSyncState("offline");
      } finally {
        if (active && localMedia) {
          const restoredEvidence = await Promise.all((localMedia.files || []).map(async (file) => ({ file, preview: await readImagePreview(file) })));
          if (active) {
            setFiles(restoredEvidence);
            if (localMedia.diagnosisFile) {
              setDiagnosisFile(localMedia.diagnosisFile);
              setDiagnosisPreview(await readImagePreview(localMedia.diagnosisFile));
            }
          }
        }
        if (active) setDraftReady(true);
      }
    };
    void restore();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!draftReady) return;
    const snapshot = JSON.parse(serializedReceptionDraft) as Omit<StoredReceptionDraft, "revision">;
    if (skipInitialDraftSave.current) { skipInitialDraftSave.current = false; return; }
    void localReceptionDraft(false, { ...snapshot, revision: draftRevision });
    if (!navigator.onLine) { setSyncState("offline"); return; }
    const timer = window.setTimeout(() => {
      setSyncState("saving");
      api<{ draft: StoredReceptionDraft }>("/orders/reception-draft", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snapshot, revision: draftRevision }) })
        .then(({ draft }) => { setDraftRevision(draft.revision); setSyncState("saved"); void localReceptionDraft(false, draft); })
        .catch((error: Error & { status?: number }) => setSyncState(error.status === 409 ? "conflict" : "offline"));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [serializedReceptionDraft, draftReady, syncRetry]);
  useEffect(() => {
    if (!draftReady) return;
    void localReceptionMedia(false, { files: files.map((evidence) => evidence.file), diagnosisFile });
  }, [files, diagnosisFile, draftReady]);
  const selectedDamageBody =
    catalog?.bodyTypes.find((item) => item.id === Number(d.body))?.code || "V3";
  useEffect(() => {
    if (step !== 3 || !damageCanvas.current) return;
    const canvas = damageCanvas.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#2563eb";
    context.lineWidth = 4;
    context.lineCap = "round";
    damages
      .filter(
        (damage) => damage.body === selectedDamageBody && damage.view === view,
      )
      .forEach((damage) => {
        context.beginPath();
        damage.path.forEach((point, index) =>
          index
            ? context.lineTo(point.u * canvas.width, point.v * canvas.height)
            : context.moveTo(point.u * canvas.width, point.v * canvas.height),
        );
        context.stroke();
      });
  }, [damages, selectedDamageBody, step, view]);
  useEffect(() => {
    if (step !== 6 || !signature || !signatureCanvas.current) return;
    const canvas = signatureCanvas.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      // The development fixture is a 1px PNG used only to satisfy signature validation.
      if (image.naturalWidth <= 1 && image.naturalHeight <= 1) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = signature;
  }, [signature, step]);
  const set = (key: string, value: string) =>
    setD((current) => ({
      ...current,
      [key]:
        key === "client"
          ? value
              .toLocaleLowerCase("es-PE")
              .replace(/(^|\s)\S/g, (letter) =>
                letter.toLocaleUpperCase("es-PE"),
              )
          : value,
    }));
  const updateNumeric = (key: string, value: string, length: number) =>
    set(key, value.replace(/\D/g, "").slice(0, length));
  const updateUpper = (key: string, value: string, length: number) =>
    set(
      key,
      value
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase()
        .slice(0, length),
    );
  const addEvidence = async (selected: File[]) => {
    const available = 15 - files.length;
    const accepted = selected
      .filter(
        (file) =>
          ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
          file.size <= 10 * 1024 * 1024,
      )
      .slice(0, available);
    if (accepted.length !== selected.length)
      setMessage(
        "Solo se admiten JPG, PNG o WebP de hasta 10 MB, con un máximo de 15 evidencias.",
      );
    const evidence = await Promise.all(accepted.map(async (file) => ({ file, preview: await readImagePreview(file) })));
    setFiles((current) => [...current, ...evidence].slice(0, 15));
  };
  const selectDiagnosis = async (file?: File) => {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setMessage("La evaluación debe ser JPG, PNG o WebP de hasta 10 MB.");
      return;
    }
    try {
      const preview = await readImagePreview(file);
      setDiagnosisFile(file);
      setDiagnosisPreview(preview);
    } catch {
      setMessage("No fue posible preparar la fotografía de evaluación.");
    }
  };
  const openCamera = (target: "evidence" | "diagnosis") => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMessage("La cámara integrada requiere HTTPS. En esta prueba local use “Elegir del dispositivo”; en Hostinger funcionará con HTTPS.");
      return;
    }
    setCameraTarget(target);
  };
  const formStep = () =>
    receptionStepOneSchema.safeParse({
      documentType: (d.document || "").length === 11 ? "RUC" : "DNI",
      documentNumber: d.document,
      fullName: d.client,
      phone: d.phone,
      email: d.email,
      plate: d.plate,
      modality: d.modality,
      claimNumber: d.claim,
      claimPendingReminder: d.claimPending === "true",
      brand: d.brand,
      model: d.model,
      color: d.color,
      colorType: d.colorType,
      year: d.year || undefined,
      vin: d.vin,
      mileage: d.mileage || undefined,
      bodyTypeId: d.body,
    });
  const next = () => {
    if (step === 0) {
      const normalizedPlate = normalizePlate(d.plate || "");
      if (
        normalizedPlate.length >= 5 &&
        !isRecognizedPlate(d.plate || "") &&
        !confirm(
          `El formato de placa "${normalizedPlate}" no coincide con los estándares habituales.\n\nEjemplos válidos: ABC-123, NG-1234, E ABC-789, CD-0123.\n\n¿Está seguro de que es correcta?`,
        )
      )
        return;
      const result = formStep();
      if (!result.success) {
        setMessage(result.error.issues[0]?.message);
        return;
      }
      setD((current) => ({
        ...current,
        plate: result.data.plate,
        document: result.data.documentNumber,
        client: result.data.fullName,
        phone: result.data.phone || "",
        email: result.data.email || "",
        claim: result.data.claimNumber || "",
        brand: result.data.brand,
        model: result.data.model,
        color: result.data.color,
        vin: result.data.vin || "",
        year: result.data.year ? String(result.data.year) : "",
        mileage: result.data.mileage ? String(result.data.mileage) : "",
        body: String(result.data.bodyTypeId),
      }));
    }
    if (
      step === 1 &&
      catalog &&
      Object.keys(answers).length !== catalog.checklist.length
    ) {
      setMessage("Responda los 44 ítems del checklist.");
      return;
    }
    setMessage(undefined);
    setStep((current) => Math.min(6, current + 1));
  };
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      u: (event.clientX - rect.left) / rect.width,
      v: (event.clientY - rect.top) / rect.height,
    };
  };
  const paint = (event: PointerEvent<HTMLCanvasElement>, color: string) => {
    if (
      !event.currentTarget.hasPointerCapture(event.pointerId) ||
      (event.pointerType === "mouse" && event.buttons !== 1)
    )
      return;
    const previous = stroke.current.at(-1);
    const current = point(event);
    stroke.current.push(current);
    if (!previous) return;
    const ctx = event.currentTarget.getContext("2d")!;
    ctx.strokeStyle = color;
    ctx.lineWidth = color === "#2563eb" ? 4 : 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(
      previous.u * event.currentTarget.width,
      previous.v * event.currentTarget.height,
    );
    ctx.lineTo(
      current.u * event.currentTarget.width,
      current.v * event.currentTarget.height,
    );
    ctx.stroke();
  };
  const finishDamage = () => {
    const path = stroke.current.map((point) => ({ ...point }));
    if (path.length > 1)
      setDamages((current) => [
        ...current,
        { body: selectedDamageBody, view, path },
      ]);
    setUndoneDamages([]);
    stroke.current = [];
  };
  const finishSignature = () => {
    if (signatureCanvas.current)
      setSignature(signatureCanvas.current.toDataURL("image/png"));
    stroke.current = [];
  };
  async function upload(orderId: number, file: File, category: string) {
    const form = new FormData();
    form.set("category", category);
    form.set("file", file);
    await api(`/attachments/orders/${orderId}`, { method: "POST", body: form });
  }
  async function uploadPendingFiles(order: { id: number; orderNumber: string }) {
    for (const [index, evidence] of files.entries()) {
      if (uploadedEvidence.includes(index)) continue;
      await upload(order.id, evidence.file, "RECEPCION");
      setUploadedEvidence((current) => [...current, index]);
    }
    if (diagnosisFile && !diagnosisUploaded) {
      await upload(order.id, diagnosisFile, "EVALUACION_MANUSCRITA");
      setDiagnosisUploaded(true);
    }
  }
  async function submit() {
    if (!catalog || !reviewed || !accepted || !signature) {
      setMessage(
        "Confirme la revisión, aceptación y firma antes de crear la orden.",
      );
      return;
    }
    const stepOne = formStep();
    if (!stepOne.success) {
      setMessage(stepOne.error.issues[0]?.message);
      return;
    }
    if (Object.keys(answers).length !== catalog.checklist.length) {
      setMessage("Responda los 44 ítems del checklist antes de crear la orden.");
      return;
    }
    setSaving(true);
    try {
      let order = createdOrder;
      if (!order) {
        const result = await api<{ order: { id: number; orderNumber: string } }>(
          "/orders",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            client: {
              documentType: d.document.length === 11 ? "RUC" : "DNI",
              documentNumber: d.document,
              fullName: d.client,
              phone: d.phone || undefined,
              email: d.email || undefined,
            },
            vehicle: {
              plate: d.plate,
              brand: d.brand,
              model: d.model,
              year: d.year || undefined,
              vin: d.vin || undefined,
              color: d.color,
              colorType: d.colorType,
              bodyTypeId: Number(d.body),
            },
            modality: d.modality,
            claimNumber: d.claim || undefined,
            claimPendingReminder: d.claimPending === "true",
            diagnosisPendingReminder: d.diagnosisPending === "true",
            mileage: d.mileage || undefined,
            fuelLevel: d.fuel ? Number(d.fuel) : undefined,
            considerations: flagsSelected,
            damages,
            diagnosis: d.diagnosis || undefined,
            diagnosisLegibility,
            diagnosisReviewState,
            checklistReviewed: reviewed,
            signature,
            acceptedTerms: accepted,
            checklist: catalog.checklist.map((item) => ({
              itemId: item.id,
              answer: answers[item.id],
              observation: notes[item.id] || undefined,
            })),
            }),
          },
        );
        order = result.order;
        setCreatedOrder(order);
      }
      await uploadPendingFiles(order);
      await api("/orders/reception-draft", { method: "DELETE" }).catch(() => undefined);
      await clearLocalReceptionDraft();
      await clearLocalReceptionMedia();
      setMessage(`Orden ${order.orderNumber} creada correctamente.`);
      setTimeout(onCreated, 800);
    } catch (error) {
      setMessage(
        createdOrder
          ? `La orden ${createdOrder.orderNumber} ya fue creada, pero faltan archivos por cargar. Use “Reintentar cargas”.`
          : error instanceof Error
            ? error.message
            : "No fue posible crear la orden.",
      );
    } finally {
      setSaving(false);
    }
  }
  const printReception = () => {
    if (!catalog) return;
    openReceptionPrint({
      modality: d.modality,
      claimNumber: d.claim,
      plate: d.plate,
      documentNumber: d.document,
      brand: d.brand,
      client: d.client,
      model: d.model,
      phone: d.phone,
      year: d.year,
      color: d.color,
      vin: d.vin,
      email: d.email,
      mileage: d.mileage,
      fuelLevel: d.fuel,
      considerations: flagsSelected,
      checklist: catalog.checklist.map((item) => ({ category: item.category, name: item.name, answer: answers[item.id], observation: notes[item.id] })),
      body: selectedDamageBody,
      damages,
      evidenceCount: files.length,
      signature,
    });
  };
  /*
    const escape = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (character) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[character] || character,
      );
    const observation = (() => {
      const entries = [
        ...flagsSelected.map((flag) => `${flag}.`),
        ...catalog.checklist
          .filter((item) => notes[item.id])
          .map((item) => `${item.name}: ${notes[item.id]}.`),
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
    const categories = [...new Set(catalog.checklist.map((item) => item.category))];
    const checklistGroups = categories.slice(0, 4).map((category) => ({
      category,
      items: catalog.checklist.filter((item) => item.category === category),
    }));
    const checklistRows = Math.max(...checklistGroups.map((group) => group.items.length));
    const checklist = `<table class="print-inventory"><colgroup>${checklistGroups.map(() => '<col style="width:32.1mm"><col style="width:6.45mm"><col style="width:6.45mm">').join("")}</colgroup><thead><tr>${checklistGroups.map((group) => `<th>${escape(group.category)}</th><th>SI</th><th>NO</th>`).join("")}</tr></thead><tbody>${Array.from({ length: checklistRows }, (_, row) => `<tr>${checklistGroups.map((group) => {
      const item = group.items[row];
      if (!item) return "<td></td><td></td><td></td>";
      const answer = answers[item.id];
      return `<td title="${notes[item.id] ? escape(notes[item.id]) : ""}">${escape(item.name)}${notes[item.id] ? " *" : ""}</td><td>${answer === "SI" ? "&#10003;" : ""}</td><td>${answer === "NO" ? "&#10007;" : ""}</td>`;
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
      const paths = damages
        .filter((damage) => damage.body === selectedDamageBody && damage.view === damageView)
        .filter((damage) => damage.path.length > 1)
        .map((damage) => `<polyline points="${damage.path.map((point) => `${(point.u * 100).toFixed(2)},${(point.v * 100).toFixed(2)}`).join(" ")}"/>`)
        .join("");
      return `<div class="vehicle ${slot}" style="aspect-ratio:${silhouetteRatios[`${selectedDamageBody}-${damageView}`] || 1.2}"><img src="${location.origin}/damage-assets/${selectedDamageBody}-${damageView}.png" alt=""><svg viewBox="0 0 100 100" preserveAspectRatio="none">${paths}</svg></div>`;
    }).join("");
    const fuelLevel = Number(d.fuel);
    const fuelIndex = Number.isFinite(fuelLevel) && d.fuel !== "" ? Math.min(4, Math.max(0, Math.round(fuelLevel / 25))) : -1;
    const fuel = ["Vacio", "1/4", "1/2", "3/4", "Lleno"].map((label, index) => `<i class="fuel-tick${index === fuelIndex ? " selected" : ""}" title="${label}"></i>`).join("");
    const km = String(d.mileage || "").replace(/\D/g, "").slice(-8).padStart(8, " ").split("").map((digit) => `<i>${digit.trim()}</i>`).join("");
    const evidenceNote = files.length ? ` · Evidencias: ${files.length}` : "";
    const popup = window.open("", "parautos-recepcion", "width=900,height=700");
    if (!popup) return;
    popup.document.write(
      `<!doctype html><html><head><title>Recepción ${escape(d.plate || "")}</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#666;font-family:Calibri,Arial,sans-serif;color:#231f20}.sheet{position:relative;width:210mm;height:297mm;margin:auto;background:#fff;overflow:hidden;font-size:9pt;line-height:1}.title{position:absolute;left:15mm;top:10mm;font-size:18pt;font-weight:800;letter-spacing:.4mm}.subtitle{position:absolute;left:15mm;top:18mm;font-size:8pt;letter-spacing:.5mm}.rule,.bar{position:absolute;left:15mm;width:180mm;background:#231f20}.rule{top:24mm;height:.7mm}.bar{height:5.7mm;color:#fff;font-size:10pt;font-weight:700;text-align:center;padding-top:1.3mm}.bar.vehicle{top:42mm}.bar.inventory{top:93.3mm}.bar.body{top:163.5mm}.bar.terms{top:230mm}.field{position:absolute;display:flex;gap:1.5mm;align-items:end;height:4mm}.field b{font-weight:400;white-space:nowrap}.field span{flex:1;border-bottom:.25mm solid #231f20;height:3.3mm;overflow:hidden;white-space:nowrap}.v1{left:28.3mm;width:62mm}.v2{left:104.1mm;width:62mm}.r1{top:30.7mm}.r2{top:35.5mm}.r3{top:52.1mm}.r4{top:56.9mm}.r5{top:61.7mm}.r6{top:66.5mm}.r7{top:71.3mm}.obs-label{position:absolute;left:28.6mm;top:77.4mm}.obs{position:absolute;left:55mm;top:76.5mm;width:140mm;height:15mm;font-size:8pt;line-height:1.2;overflow:hidden}.checklist{position:absolute;left:15mm;top:99mm;width:180mm;height:62.5mm;display:grid;grid-template-columns:repeat(4,45mm);overflow:hidden}.check-group{display:grid;grid-auto-rows:5.12mm;grid-template-columns:32.1mm 6.45mm 6.45mm}.check-head,.check-row{display:contents}.check-head i,.check-row i{border:.25mm solid #231f20;font-style:normal;overflow:hidden}.check-head i{border-bottom:0;text-align:center;padding-top:1.1mm;font-size:7.2pt}.check-head i:first-child{font-size:6pt;text-align:left;padding:1.1mm 1mm 0}.check-head i:not(:first-child){background:#231f20;color:#fff;font-weight:700}.check-row i{border-right:0;border-bottom:0;padding:1mm;font-size:6.8pt;white-space:nowrap;text-overflow:ellipsis}.check-row i:first-child{border-left:0}.check-row i.on{background:#231f20}.diagram{position:absolute;left:15mm;top:171.2mm;width:136.5mm;height:56.5mm;border:.5mm solid #231f20}.vehicle{position:absolute}.vehicle img,.vehicle svg{width:100%;height:100%;display:block;position:absolute}.vehicle svg{fill:none;stroke:#2563eb;stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.rear{left:1.2mm;top:1.6mm;width:29mm;aspect-ratio:1.23}.top{left:33.4mm;top:1.2mm;width:69.7mm;aspect-ratio:2.25}.front{right:1.2mm;top:1.6mm;width:29mm;aspect-ratio:1.14}.left{left:1.2mm;bottom:1.4mm;width:65.5mm;aspect-ratio:2.9}.right{right:1.2mm;bottom:1.4mm;width:65.5mm;aspect-ratio:2.9}.side{position:absolute;left:152.9mm;top:171.2mm;width:42mm;height:56.5mm;display:grid;grid-template-rows:13.9mm 12.5mm 1fr;gap:1.2mm}.box{position:relative;border:.5mm solid #231f20;text-align:center}.box strong{display:block;margin-top:1.8mm;font-size:10pt}.fuel i{display:inline-block;width:.6mm;height:4.5mm;background:#231f20;margin:2.5mm 3.1mm 0}.fuel i.selected{width:1.2mm;background:#ed3337}.km i{display:inline-grid;place-items:center;width:4.55mm;height:5.1mm;border:.25mm solid #231f20;border-right:0;margin-top:1mm;font-style:normal}.km i:last-child{border-right:.25mm solid #231f20}.sign{font-size:5.2pt;font-weight:700;line-height:1.25;padding:1mm}.sign img{position:absolute;left:3mm;bottom:5mm;width:36mm;height:13mm;object-fit:contain}.sign label{position:absolute;bottom:1.1mm;left:0;right:0;font-size:8pt}.terms-text{position:absolute;left:15mm;top:237mm;width:180mm;height:32mm;margin:0;overflow:hidden;font-size:7.6pt;line-height:1.18;text-align:justify}.footer{position:absolute;left:15mm;top:271.3mm;width:180mm;height:5.7mm;background:#231f20;color:#fff;text-align:center;padding-top:1.5mm;font-size:8pt}@media print{body{background:#fff}.sheet{margin:0}}</style></head><body><article class="sheet"><div class="title">PARAUTOS</div><div class="subtitle">CHECKLIST DE SERVICIO · CONSTANCIA DE RECEPCION${escape(evidenceNote)}</div><div class="rule"></div><div class="field v1 r1"><b>MODALIDAD:</b><span>${escape(d.modality || "")}</span></div><div class="field v2 r1"><b>ASESOR:</b><span></span></div><div class="field v1 r2"><b>FECHA:</b><span>${new Date().toLocaleDateString("es-PE")}</span></div><div class="field v2 r2"><b>NRO. SINIESTRO:</b><span>${escape(d.claim || "")}</span></div><div class="bar vehicle">DATOS DEL VEHICULO Y CLIENTE</div><div class="field v1 r3"><b>PLACA:</b><span>${escape(d.plate || "")}</span></div><div class="field v2 r3"><b>DNI:</b><span>${escape(d.document || "")}</span></div><div class="field v1 r4"><b>MARCA:</b><span>${escape(d.brand || "")}</span></div><div class="field v2 r4"><b>CLIENTE:</b><span>${escape(d.client || "")}</span></div><div class="field v1 r5"><b>MODELO:</b><span>${escape(d.model || "")}</span></div><div class="field v2 r5"><b>TELEFONO:</b><span>${escape(d.phone || "")}</span></div><div class="field v1 r6"><b>AÑO:</b><span>${escape(d.year || "")}</span></div><div class="field v2 r6"><b>COLOR:</b><span>${escape(d.color || "")}</span></div><div class="field v1 r7"><b>VIN:</b><span>${escape(d.vin || "")}</span></div><div class="field v2 r7"><b>E-MAIL:</b><span>${escape(d.email || "")}</span></div><div class="obs-label">OBSERVACIONES:</div><div class="obs">${escape(observation)}</div><div class="bar inventory">INVENTARIO DEL VEHICULO</div><div class="checklist">${checklist}</div><div class="bar body">CARROCERIA DEL VEHICULO</div><div class="diagram">${drawings}</div><div class="side"><div class="box fuel"><strong>COMBUSTIBLE</strong>${fuel}</div><div class="box"><strong>KILOMETRAJE</strong><div class="km">${km}</div></div><div class="box sign">FIRMA DE AUTORIZACION PARA LA REALIZACION DE TRABAJOS Y CONFORMIDAD DE INVENTARIO Y CONDICIONES DEL SERVICIO${signature ? `<img src="${signature}" alt="Firma del cliente">` : ""}<label>FIRMA DEL CLIENTE</label></div></div><div class="bar terms">CONDICIONES DEL SERVICIO</div><p class="terms-text">En caso EL CLIENTE no cumpla con retirar su vehículo dentro del plazo de tres (3) días, computados a partir de la fecha de haber recibido el aviso sobre la culminación del trabajo, LA EMPRESA cobrará la suma de S/. 50.00 diarios por el espacio que ocupa el vehículo. LA EMPRESA se compromete a efectuar la reparación, mantenimiento u otro similar en el plazo señalado, salvo caso fortuito, fuerza mayor, actos de terceros ajenos a nuestro personal, actos u omisiones del cliente. Si fuera necesaria una reparación de mayor volumen o plazo, LA EMPRESA comunicará a EL CLIENTE el plazo extraordinario. En ningún caso EL CLIENTE tendrá facultad para reclamar indemnización por daños, perjuicios o lucro cesante. Se considerará como vehículo entregado cuando EL CLIENTE firme el documento de conformidad de salida. LA EMPRESA queda autorizada a ejercer derecho de retención hasta que la deuda sea cancelada.</p><div class="footer">044-533665 · 952394849 &nbsp; | &nbsp; Avenida America Norte #2404, Urbanizacion Primavera</div></article><script>window.onload=()=>window.print()<\/script></body></html>`,
    );
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

      const fuelLabel = Array.from(sheet.querySelectorAll<HTMLElement>("*")).find(
        (element) => element.textContent?.trim() === "COMBUSTIBLE",
      );
      const mileageLabel = Array.from(sheet.querySelectorAll<HTMLElement>("*")).find(
        (element) => element.textContent?.trim() === "KILOMETRAJE",
      );
      (sheet.querySelector<HTMLElement>(".side") || fuelLabel?.parentElement?.parentElement)
        ?.classList.add("reference-side");
      const fuelBox = fuelLabel?.parentElement;
      fuelBox?.classList.add("reference-fuel");
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
    popup.document.head.insertAdjacentHTML(
      "beforeend",
      `<style>${A4_RECEPTION_PRINT_STYLES}</style>`,
    );
    popup.document.close();
  };
  */
  if (!catalog)
    return <div className="empty">{message || "Cargando recepción..."}</div>;
  const categories = [
    ...new Set(catalog.checklist.map((item) => item.category)),
  ];
  const markCategoryConforming = (category: string) => {
    const items = catalog.checklist.filter((item) => item.category === category);
    if (!window.confirm(`Se marcarán ${items.length} ítems de “${category}” como conformes y se eliminarán sus observaciones. ¿Desea continuar?`)) return;
    const previousAnswers = Object.fromEntries(items.map((item) => [item.id, answers[item.id]])) as Record<number, "SI" | "NO" | undefined>;
    const previousNotes = Object.fromEntries(items.map((item) => [item.id, notes[item.id]])) as Record<number, string | undefined>;
    setChecklistUndo({ category, answers: previousAnswers, notes: previousNotes });
    setAnswers((current) => ({ ...current, ...Object.fromEntries(items.map((item) => [item.id, "SI" as const])) }));
    setNotes((current) => { const next = { ...current }; items.forEach((item) => delete next[item.id]); return next; });
    setOpenChecklistNotes((current) => { const next = { ...current }; items.forEach((item) => delete next[item.id]); return next; });
    setMessage(`${items.length} ítems de ${category} se marcaron como conformes.`);
  };
  const undoChecklistCategory = () => {
    if (!checklistUndo) return;
    setAnswers((current) => { const next = { ...current }; Object.entries(checklistUndo.answers).forEach(([id, value]) => value ? next[Number(id)] = value : delete next[Number(id)]); return next; });
    setNotes((current) => { const next = { ...current }; Object.entries(checklistUndo.notes).forEach(([id, value]) => value ? next[Number(id)] = value : delete next[Number(id)]); return next; });
    setMessage(`Se restauraron las respuestas de ${checklistUndo.category}.`); setChecklistUndo(undefined);
  };
  return (
    <section className="wizard full-wizard">
      <p className="orientation-guidance" role="status">
        Para registrar una orden recomendamos usar el teléfono en vertical. Puedes continuar si lo necesitas.
      </p>
      <div className="wizard-top">
        <div>
          <strong>{steps[step]}</strong>
          <small>Paso {step + 1} de 7 · {syncState === "loading" ? "Cargando borrador…" : syncState === "saving" ? "Guardando borrador…" : syncState === "offline" ? "Sin conexión · cambios pendientes" : syncState === "conflict" ? "El borrador cambió en otro dispositivo" : "Borrador sincronizado"}</small>
        </div>
        <div className="steps">
          {steps.map((_, index) => (
            <i
              key={index}
              className={index < step ? "done" : index === step ? "active" : ""}
            />
          ))}
        </div>
      </div>
      {syncState === "conflict" && <div className="reception-sync-conflict"><span>Otro dispositivo guardó cambios antes que este. Recarga para ver la versión actual; los cambios locales permanecen en este dispositivo.</span><button type="button" className="btn small" onClick={() => window.location.reload()}>Recargar versión actual</button></div>}
      <div className="card wizard-card">
        {step === 0 && (
          <DataStep
            d={d}
            set={set}
            updateNumeric={updateNumeric}
            updateUpper={updateUpper}
            catalog={catalog}
          />
        )}
        {step === 1 && (
          <>
            <Title
              n="✓"
              title="Checklist de recepción"
              text={`${Object.keys(answers).length} de 44 respondidos · todos obligatorios.`}
            />
            <div className="checklist-mobile-hint"><strong>Modo rápido</strong><span>Marca una categoría sin novedades o revisa sólo sus excepciones.</span></div>
            {checklistUndo && <div className="checklist-undo"><span>{checklistUndo.category} se marcó como conforme.</span><button type="button" onClick={undoChecklistCategory}>Deshacer</button></div>}
            {categories.map((category, categoryIndex) => {
              const items = catalog.checklist.filter((item) => item.category === category); const answered = items.filter((item) => answers[item.id]).length; const observations = items.filter((item) => answers[item.id] === "NO").length; const isOpen = openChecklistCategory === category || (!openChecklistCategory && categoryIndex === 0);
              return <section className={`check-category ${isOpen ? "open" : ""}`} key={category}><header><button type="button" className="check-category-toggle" onClick={() => setOpenChecklistCategory(isOpen ? undefined : category)}><span>{category}</span><small>{answered}/{items.length}{observations ? ` · ${observations} observación${observations === 1 ? "" : "es"}` : ""}</small><b aria-hidden="true">{isOpen ? "⌃" : "›"}</b></button>{isOpen && <button type="button" className="check-category-all-good" onClick={() => markCategoryConforming(category)}>Marcar sin novedades</button>}</header>{isOpen && <div className="check-category-items">{items.map((item) => { const showNote = answers[item.id] === "NO" || Boolean(notes[item.id]) || openChecklistNotes[item.id]; const quickNote = (value: string) => { setNotes((current) => ({ ...current, [item.id]: current[item.id] ? `${current[item.id]} · ${value}` : value })); setOpenChecklistNotes((current) => ({ ...current, [item.id]: true })); }; return <div className={`check-row ${answers[item.id] === "NO" ? "has-observation" : ""}`} key={item.id}><div className="check-item-main"><strong>{item.name}</strong>{showNote ? <><div className="check-note-templates">{["Rayado", "Golpe", "No opera", "Falta"].map((value) => <button type="button" key={value} onClick={() => quickNote(value)}>{value}</button>)}</div><input className="check-note" placeholder="Describe la observación" value={notes[item.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} /></> : <button type="button" className="check-add-note" onClick={() => setOpenChecklistNotes((current) => ({ ...current, [item.id]: true }))}>+ Añadir observación</button>}</div><div className="segmented"><button type="button" className={answers[item.id] === "SI" ? "selected" : ""} onClick={() => setAnswers((current) => ({ ...current, [item.id]: "SI" }))}>Conforme</button><button type="button" className={answers[item.id] === "NO" ? "selected no" : ""} onClick={() => { setAnswers((current) => ({ ...current, [item.id]: "NO" })); setOpenChecklistNotes((current) => ({ ...current, [item.id]: true })); }}>Observación</button></div></div>; })}</div>}</section>;
            })}
          </>
        )}
        {step === 2 && (
          <div className="considerations-step">
            <Title
              n="!"
              title="Consideraciones de recepción"
              text="Opcionales; se conservarán en la constancia."
            />
            <div className="considerations-hint"><strong>Inspección visual</strong><span>Marca únicamente los hallazgos presentes al recibir el vehículo.</span></div>
            <div className="flags">
              {flags.map((flag) => (
                <label key={flag}>
                  <input
                    type="checkbox"
                    checked={flagsSelected.includes(flag)}
                    onChange={(event) =>
                      setFlagsSelected(
                        event.target.checked
                          ? [...flagsSelected, flag]
                          : flagsSelected.filter((value) => value !== flag),
                      )
                    }
                  />
                  {flag}
                </label>
              ))}
            </div>
          </div>
        )}
        {step === 3 && (
          <DamageStep
            body={selectedDamageBody}
            damages={damages}
            expanded={damageExpanded}
            onClear={() => {
              if (confirm("¿Limpiar todos los trazos de esta vista?")) {
                setDamages((current) =>
                  current.filter(
                    (damage) =>
                      damage.body !== selectedDamageBody ||
                      damage.view !== view,
                  ),
                );
                setUndoneDamages([]);
              }
            }}
            onFinish={finishDamage}
            onPaint={paint}
            onRedo={() =>
              setUndoneDamages((current) => {
                const damage = current.at(-1);
                if (
                  damage &&
                  damage.body === selectedDamageBody &&
                  damage.view === view
                )
                  setDamages((items) => [...items, damage]);
                return damage &&
                  damage.body === selectedDamageBody &&
                  damage.view === view
                  ? current.slice(0, -1)
                  : current;
              })
            }
            onStart={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              stroke.current = [point(event)];
            }}
            onUndo={() =>
              setDamages((current) => {
                const index = current
                  .map((damage, index) => ({ damage, index }))
                  .filter(
                    ({ damage }) =>
                      damage.body === selectedDamageBody &&
                      damage.view === view,
                  )
                  .at(-1)?.index;
                if (index === undefined) return current;
                setUndoneDamages((undone) => [...undone, current[index]]);
                return current.filter((_, itemIndex) => itemIndex !== index);
              })
            }
            onView={setView}
            setExpanded={setDamageExpanded}
            view={view}
            canvas={damageCanvas}
          />
        )}
        {step === 4 && (
          <>
            <Title
              n="▣"
              title="Evidencias"
              text={`${files.length} de 15 · orden cronológico.`}
            />
            <div
              className={`evidence-upload${files.length >= 15 ? " is-full" : ""}`}
            >
              <strong>
                {files.length >= 15
                  ? "✓ Evidencias completas"
                  : "＋ Tomar o elegir fotografías"}
              </strong>
              <small>
                {files.length >= 15
                  ? "Se alcanzó el máximo de 15 imágenes."
                  : "JPG, PNG o WebP · máximo 10 MB por imagen"}
              </small>
              <div className="evidence-upload-actions">
                <button type="button" className="btn small" disabled={files.length >= 15} onClick={() => openCamera("evidence")}>Tomar foto</button>
                <button type="button" className="btn small" disabled={files.length >= 15} onClick={() => evidenceDeviceInput.current?.click()}>Elegir del dispositivo</button>
                <input ref={evidenceDeviceInput} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { void addEvidence(Array.from(event.target.files || [])); event.currentTarget.value = ""; }} />
              </div>
            </div>
            <div className="evidence-grid">
              {files.length ? (
                files.map((evidence, index) => (
                  <div
                    className="evidence-photo"
                    key={`${evidence.file.name}-${evidence.file.lastModified}-${index}`}
                  >
                    <img
                      src={evidence.preview}
                      alt={`Evidencia ${index + 1}`}
                    />
                    <span>{index + 1}</span>
                    <button
                      type="button"
                      aria-label={`Eliminar evidencia ${index + 1}`}
                      onClick={() =>
                        setFiles((current) => {
                          URL.revokeObjectURL(evidence.preview);
                          return current.filter(
                            (_, itemIndex) => itemIndex !== index,
                          );
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <div className="evidence-empty">
                  Aún no has adjuntado fotografías.
                  <br />
                  Usa el área de arriba para agregarlas.
                </div>
              )}
            </div>
            <div className="evidence-hint">
              <strong>Recomendación:</strong> documenta los daños principales.
              Puedes continuar sin completar las 15 fotografías.
            </div>
          </>
        )}
        {step === 5 && (
          <div className="diagnosis-step">
            <Title
              n="⌁"
              title="Diagnóstico"
              text="La evaluación manuscrita es independiente de las evidencias."
            />
            <label className="diagnosis-field">
              <span className="diagnosis-field-head"><span><b>Descripción del diagnóstico</b><small>Registra daños observados y trabajos sugeridos para cotización.</small></span><output>{(d.diagnosis || "").length}/4000</output></span>
              <textarea
                className="diagnosis"
                value={d.diagnosis || ""}
                onChange={(event) => set("diagnosis", event.target.value)}
                placeholder="Daños observados y trabajos sugeridos..."
                maxLength={4000}
              />
            </label>
            <section className="diagnosis-upload">
              <header>
                <div>
                  <strong>Fotografía de evaluación manuscrita</strong>
                  <small>
                    Opcional, pero recomendada. JPG, PNG o WebP hasta 10 MB.
                  </small>
                </div>
                {diagnosisFile ? (
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => {
                      setDiagnosisFile(undefined);
                      setDiagnosisPreview("");
                    }}
                  >
                    Eliminar
                  </button>
                ) : (
                  <span className="diagnosis-upload-optional">Opcional</span>
                )}
              </header>
              {diagnosisPreview ? (
                <img
                  src={diagnosisPreview}
                  alt="Vista previa de evaluación manuscrita"
                />
              ) : (
                <div className="diagnosis-picker">
                  <span className="diagnosis-picker-icon">⌁</span>
                  <strong>Tomar o elegir fotografía</strong>
                  <small>Usa la cámara o selecciona un archivo desde este equipo.</small>
                  <div className="evidence-upload-actions">
                    <button type="button" className="btn small" onClick={() => openCamera("diagnosis")}>Tomar foto</button>
                    <button type="button" className="btn small" onClick={() => diagnosisDeviceInput.current?.click()}>Elegir del dispositivo</button>
                    <input ref={diagnosisDeviceInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void selectDiagnosis(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                  </div>
                </div>
              )}
              {diagnosisFile && (
                <div className="diagnosis-status">
                  <span>{diagnosisFile.name}</span>
                  <label>
                    Legibilidad
                    <select
                      value={diagnosisLegibility}
                      onChange={(event) =>
                        setDiagnosisLegibility(
                          event.target.value as
                            "PENDIENTE" | "LEGIBLE" | "ILEGIBLE",
                        )
                      }
                    >
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="LEGIBLE">Legible</option>
                      <option value="ILEGIBLE">Ilegible</option>
                    </select>
                  </label>
                  <label>
                    Revisión
                    <select
                      value={diagnosisReviewState}
                      onChange={(event) =>
                        setDiagnosisReviewState(
                          event.target.value as
                            "PENDIENTE_REVISION" | "REVISADA",
                        )
                      }
                    >
                      <option value="PENDIENTE_REVISION">Pendiente</option>
                      <option value="REVISADA">Revisada</option>
                    </select>
                  </label>
                </div>
              )}
              {!diagnosisFile && (
                <label className="diagnosis-reminder">
                  <input type="checkbox" checked={d.diagnosisPending === "true"} onChange={(event) => set("diagnosisPending", String(event.target.checked))} />
                  <span>Crear recordatorio: diagnóstico manuscrito pendiente de cargar.</span>
                </label>
              )}
            </section>
          </div>
        )}
        {step === 6 && (
          <div className="summary">
            <Title
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
                <button type="button" className="btn small" onClick={printReception}>Vista previa A4</button>
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
        )}
      </div>
      {message && <p className="wizard-message">{message}</p>}
      <div className="wizard-actions">
        {step > 0 && (
          <button
            type="button"
            className="btn"
            onClick={() => setStep(step - 1)}
          >
            ← Anterior
          </button>
        )}
        {step < 6 ? (
          <button type="button" className="btn primary" onClick={next}>
            Continuar →
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            disabled={saving}
            onClick={submit}
          >
            {saving ? "Guardando..." : createdOrder ? "Reintentar cargas" : "Confirmar y crear orden"}
          </button>
        )}
      </div>
      {cameraTarget && <CameraCapture target={cameraTarget} onCancel={() => setCameraTarget(undefined)} onCapture={(file) => { if (cameraTarget === "evidence") void addEvidence([file]); else void selectDiagnosis(file); setCameraTarget(undefined); }} />}
    </section>
  );
}

function CameraCapture({ target, onCancel, onCapture }: { target: "evidence" | "diagnosis"; onCancel: () => void; onCapture: (file: File) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Abriendo cámara…");
  useEffect(() => {
    let stream: MediaStream | undefined;
    navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } }).then((activeStream) => {
      stream = activeStream;
      if (!video.current) return;
      video.current.srcObject = activeStream;
      void video.current.play();
      setMessage("");
    }).catch(() => setMessage("No fue posible usar la cámara. Revise el permiso del navegador o elija una imagen del dispositivo."));
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, []);
  const takePhoto = () => {
    const source = video.current;
    if (!source || !source.videoWidth || !source.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth; canvas.height = source.videoHeight;
    canvas.getContext("2d")?.drawImage(source, 0, 0);
    canvas.toBlob((blob) => { if (blob) onCapture(new File([blob], `${target}-${new Date().toISOString().replaceAll(":", "-")}.jpg`, { type: "image/jpeg" })); }, "image/jpeg", 0.9);
  };
  return <div className="camera-capture" role="dialog" aria-modal="true" aria-label="Cámara"><div className="camera-capture-card"><header><strong>{target === "evidence" ? "Fotografía de evidencia" : "Fotografía de evaluación"}</strong><button type="button" className="btn small" onClick={onCancel}>Cerrar</button></header>{message ? <p className="hint">{message}</p> : <video ref={video} autoPlay playsInline muted />}{!message && <button type="button" className="btn primary" onClick={takePhoto}>Capturar fotografía</button>}</div></div>;
}

function Title({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="section-title">
      <span>{n}</span>
      <div>
        <h2>{title}</h2>
        <small>{text}</small>
      </div>
    </div>
  );
}
function DamageStep({
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
      <Title
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

function DataStep({
  d,
  set,
  updateNumeric,
  updateUpper,
  catalog,
}: {
  d: Record<string, string>;
  set: (key: string, value: string) => void;
  updateNumeric: (key: string, value: string, length: number) => void;
  updateUpper: (key: string, value: string, length: number) => void;
  catalog: Catalog;
}) {
  const models = brands[d.brand] || [];
  return (
    <div className="intake-sections">
      <Title
        n="1"
        title="Registro de recepción"
        text="Los campos con * son obligatorios."
      />
      <section className="intake-section">
        <header>
          <h3>Datos del cliente</h3>
          <p>Información de contacto del propietario.</p>
        </header>
        <div className="form-grid">
          <Field label="DNI o RUC *">
            <input
              inputMode="numeric"
              maxLength={11}
              value={d.document || ""}
              onChange={(e) => updateNumeric("document", e.target.value, 11)}
            />
          </Field>
          <Field label="Cliente *">
            <input
              value={d.client || ""}
              onChange={(e) => set("client", e.target.value)}
            />
          </Field>
          <Field label="Celular">
            <input
              inputMode="numeric"
              maxLength={15}
              value={d.phone || ""}
              onChange={(e) => updateNumeric("phone", e.target.value, 15)}
            />
          </Field>
          <Field label="Correo">
            <input
              type="email"
              value={d.email || ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
        </div>
      </section>
      <section className="intake-section">
        <header>
          <h3>Datos del vehículo</h3>
          <p>Identificación técnica que se mantiene durante la reparación.</p>
        </header>
        <div className="form-grid">
          <Field label="Placa *">
            <input
              maxLength={9}
              value={d.plate || ""}
              onChange={(e) =>
                set(
                  "plate",
                  e.target.value.replace(/[^A-Za-z0-9- ]/g, "").toUpperCase(),
                )
              }
              onBlur={(e) => set("plate", normalizePlate(e.target.value))}
            />
          </Field>
          <Field label="Marca *">
            <input
              list="brands"
              value={d.brand || ""}
              onChange={(e) => updateUpper("brand", e.target.value, 80)}
            />
            <datalist id="brands">
              {Object.keys(brands).map((brand) => (
                <option key={brand} value={brand} />
              ))}
            </datalist>
          </Field>
          <Field label="Modelo *">
            <input
              list="models"
              value={d.model || ""}
              onChange={(e) => updateUpper("model", e.target.value, 80)}
            />
            <datalist id="models">
              {models.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </Field>
          <Field label="Carrocería *">
            <select
              value={d.body || ""}
              onChange={(e) => set("body", e.target.value)}
            >
              <option value="">Selecciona</option>
              {catalog.bodyTypes.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Año">
            <input
              inputMode="numeric"
              maxLength={4}
              value={d.year || ""}
              onChange={(e) => updateNumeric("year", e.target.value, 4)}
            />
          </Field>
          <Field label="VIN">
            <input
              maxLength={17}
              value={d.vin || ""}
              onChange={(e) => updateUpper("vin", e.target.value, 17)}
            />
          </Field>
        </div>
      </section>
      <section className="intake-section">
        <header>
          <h3>Condiciones de ingreso</h3>
          <p>Datos registrados al momento de recibir el vehículo.</p>
        </header>
        <div className="form-grid">
          <Field label="Modalidad *">
            <select
              value={d.modality}
              onChange={(e) => set("modality", e.target.value)}
            >
              {["PARTICULAR", "MAPFRE", "LA_POSITIVA", "RIMAC", "PACIFICO"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Color *">
            <select
              value={
                d.colorType === "PERSONALIZADO" ? "__CUSTOM__" : d.color || ""
              }
              onChange={(e) => {
                if (e.target.value === "__CUSTOM__") {
                  set("colorType", "PERSONALIZADO");
                  set("color", "");
                } else {
                  set("colorType", "CATALOGO");
                  set("color", e.target.value);
                }
              }}
            >
              <option value="">Selecciona</option>
              {colors.map((color) => (
                <option key={color}>{color}</option>
              ))}
              <option value="__CUSTOM__">Otro color (especificar)</option>
            </select>
          </Field>
          {d.colorType === "PERSONALIZADO" && (
            <Field label="Color personalizado">
              <input
                maxLength={40}
                value={d.color || ""}
                placeholder="Ej. Gris Nardo"
                onChange={(e) =>
                  set("color", e.target.value.replace(/[^A-Za-zÀ-ÿ ]/g, ""))
                }
              />
            </Field>
          )}
          <Field label="Kilometraje">
            <input
              inputMode="numeric"
              maxLength={7}
              value={d.mileage || ""}
              onChange={(e) => updateNumeric("mileage", e.target.value, 7)}
            />
          </Field>
          <Field label="Número de siniestro">
            <input
              disabled={d.claimPending === "true"}
              value={d.claim || ""}
              onChange={(e) => set("claim", e.target.value)}
            />
          </Field>
          <Field label="Combustible">
            <select
              value={d.fuel || ""}
              onChange={(e) => set("fuel", e.target.value)}
            >
              <option value="">No registrado</option>
              {[
                [0, "Vacío"],
                [25, "1/4"],
                [50, "1/2"],
                [75, "3/4"],
                [100, "Lleno"],
              ].map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <label className="claim-field">
            <input
              type="checkbox"
              checked={d.claimPending === "true"}
              onChange={(e) => set("claimPending", String(e.target.checked))}
            />
            Número de siniestro pendiente
          </label>
        </div>
      </section>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const control = isValidElement<{
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
  }>(children)
    ? children
    : null;
  const value = control?.props.value;
  const placeholders: Record<string, string> = {
    "DNI o RUC *": "DNI (8) o RUC (11)",
    "Cliente *": "Nombre o razón social",
    Celular: "999 999 999",
    Correo: "nombre@correo.com",
    "Placa *": "ABC-123 · NG-1234 · E ABC-789 · CD-0123",
    "Marca *": "Ej. TOYOTA",
    "Modelo *": "Ej. COROLLA",
    "Color personalizado": "Ej. Gris Nardo",
    Año: "Ej. 2024",
    VIN: "17 caracteres",
    Kilometraje: "Ej. 12500",
    "Número de siniestro": "Código de la aseguradora",
  };
  const input =
    control && control.type === "input"
      ? cloneElement(control, {
          placeholder: control.props.placeholder || placeholders[label],
        })
      : children;
  const palette: Record<string, string> = {
    Blanco: "#f8fafc",
    Negro: "#171717",
    Gris: "#7b8490",
    Plata: "#c5ccd3",
    Rojo: "#dc2626",
    Azul: "#2563eb",
    Verde: "#15803d",
    Amarillo: "#eab308",
    Beige: "#d6c19a",
    Marrón: "#7c4a2d",
    Naranja: "#ea580c",
  };
  const fuelValues = ["0", "25", "50", "75", "100"];
  const fuelLabels = ["Vacío", "1/4", "1/2", "3/4", "Lleno"];
  const fuelIndex = fuelValues.indexOf(value || "");
  const fuelLevel = Math.max(0, fuelIndex) * 25;
  const fuel =
    label === "Combustible" && control ? (
      <div className="fuel-control">
        <div className="fuel-control-header">
          <button
            type="button"
            className={fuelIndex === -1 ? "active" : ""}
            onClick={() => control.props.onChange?.({ target: { value: "" } })}
          >
            Sin registrar
          </button>
          <strong>
            {fuelIndex === -1 ? "No registrado" : fuelLabels[fuelIndex]}
          </strong>
        </div>
        <input
          type="range"
          min="0"
          max="4"
          step="1"
          value={Math.max(0, fuelIndex)}
          style={{
            background: `linear-gradient(to right, var(--dark) 0%, var(--dark) ${fuelLevel}%, #d5dce3 ${fuelLevel}%, #d5dce3 100%)`,
          }}
          onChange={(event) =>
            control.props.onChange?.({
              target: { value: fuelValues[Number(event.target.value)] },
            })
          }
        />
        <div className="fuel-marks">
          {fuelLabels.map((item, index) => (
            <span className={index === fuelIndex ? "active" : ""} key={item}>
              {item}
            </span>
          ))}
        </div>
      </div>
    ) : (
      input
    );
  return (
    <label
      className={`wizard-field ${label === "Color *" ? "color-field" : label === "Color personalizado" ? "custom-color-field" : label === "Combustible" ? "fuel-field" : ""}`}
    >
      <span>{label}</span>
      <div className="field-with-swatch">
        {fuel}
        {label === "Color *" && (
          <i
            className="color-swatch"
            style={{ background: palette[value || ""] || "#fff" }}
            aria-label={`Color ${value || "sin seleccionar"}`}
          />
        )}
      </div>
    </label>
  );
}
