type Point = { u: number; v: number };
type Damage = { body: "V1" | "V2" | "V3" | "V4"; view: "01" | "02" | "03" | "04" | "05"; path: Point[] };
type ReceptionDraftPayload = { d: Record<string, string>; answers: Record<number, "SI" | "NO">; notes: Record<number, string>; flagsSelected: string[]; damages: Damage[]; view: Damage["view"]; diagnosisLegibility: "PENDIENTE" | "LEGIBLE" | "ILEGIBLE"; diagnosisReviewState: "PENDIENTE_REVISION" | "REVISADA"; signature: string; reviewed: boolean; accepted: boolean };
type StoredReceptionDraft = { revision?: number; currentStep: number; payload: ReceptionDraftPayload };
type StoredReceptionMedia = { files: File[]; diagnosisFile?: File };

const receptionDraftStore = "parautos-reception-drafts";
function createReceptionStores(database: IDBDatabase) {
  if (!database.objectStoreNames.contains("drafts")) database.createObjectStore("drafts");
  if (!database.objectStoreNames.contains("media")) database.createObjectStore("media");
}

function accessStore<T>(storeName: "drafts" | "media", scope: string, mode: "read" | "write" | "delete", value?: T): Promise<T | undefined> {
  // Legacy keys have no owner and must never be restored to another account.
  const key = `${scope}:${storeName}`;
  return new Promise((resolve) => {
    let database: IDBDatabase | undefined;
    const finish = (result?: T) => { database?.close(); resolve(result); };
    try {
      const request = indexedDB.open(receptionDraftStore, 2);
      request.onupgradeneeded = () => createReceptionStores(request.result);
      request.onerror = () => finish();
      request.onblocked = () => finish();
      request.onsuccess = () => {
        database = request.result;
        try {
          const transaction = database.transaction(storeName, mode === "read" ? "readonly" : "readwrite");
          const store = transaction.objectStore(storeName);
          const operation = mode === "read" ? store.get(key) : mode === "delete" ? store.delete(key) : store.put(value, key);
          let result: T | undefined;
          operation.onsuccess = () => { result = mode === "read" ? operation.result as T | undefined : value; };
          transaction.oncomplete = () => finish(result);
          transaction.onerror = () => finish();
          transaction.onabort = () => finish();
        } catch { finish(); }
      };
    } catch { finish(); }
  });
}

export const localReceptionDraft = (read: boolean, value: StoredReceptionDraft | undefined, scope: string) => accessStore("drafts", scope, read ? "read" : "write", value);
export const localReceptionMedia = (read: boolean, value: StoredReceptionMedia | undefined, scope: string) => accessStore("media", scope, read ? "read" : "write", value);
export const clearLocalReceptionDraft = (scope: string) => accessStore("drafts", scope, "delete");
export const clearLocalReceptionMedia = (scope: string) => accessStore("media", scope, "delete");
