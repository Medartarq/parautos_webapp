type Point = { u: number; v: number };
type Damage = { body: "V1" | "V2" | "V3" | "V4"; view: "01" | "02" | "03" | "04" | "05"; path: Point[] };
type ReceptionDraftPayload = { d: Record<string, string>; answers: Record<number, "SI" | "NO">; notes: Record<number, string>; flagsSelected: string[]; damages: Damage[]; view: Damage["view"]; diagnosisLegibility: "PENDIENTE" | "LEGIBLE" | "ILEGIBLE"; diagnosisReviewState: "PENDIENTE_REVISION" | "REVISADA"; signature: string; reviewed: boolean; accepted: boolean };
type StoredReceptionDraft = { revision?: number; currentStep: number; payload: ReceptionDraftPayload };
type StoredReceptionMedia = { files: File[]; diagnosisFile?: File };

const receptionDraftStore = "parautos-reception-drafts";
const receptionDraftKey = "current-user";
const receptionMediaKey = "current-user-media";
function createReceptionStores(database: IDBDatabase) {
  if (!database.objectStoreNames.contains("drafts")) database.createObjectStore("drafts");
  if (!database.objectStoreNames.contains("media")) database.createObjectStore("media");
}
export async function localReceptionDraft(read = false, value?: StoredReceptionDraft) {
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
export async function clearLocalReceptionDraft() {
  return new Promise<void>((resolve) => {
    const request = indexedDB.open(receptionDraftStore, 2);
    request.onupgradeneeded = () => createReceptionStores(request.result);
    request.onerror = () => resolve();
    request.onsuccess = () => { const transaction = request.result.transaction("drafts", "readwrite"); transaction.objectStore("drafts").delete(receptionDraftKey); transaction.oncomplete = () => resolve(); transaction.onerror = () => resolve(); };
  });
}
export async function localReceptionMedia(read = false, value?: StoredReceptionMedia) {
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
export async function clearLocalReceptionMedia() {
  return new Promise<void>((resolve) => {
    const request = indexedDB.open(receptionDraftStore, 2);
    request.onupgradeneeded = () => createReceptionStores(request.result);
    request.onerror = () => resolve();
    request.onsuccess = () => { const transaction = request.result.transaction("media", "readwrite"); transaction.objectStore("media").delete(receptionMediaKey); transaction.oncomplete = () => resolve(); transaction.onerror = () => resolve(); };
  });
}
