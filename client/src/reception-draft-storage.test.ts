import { afterEach, expect, it, vi } from "vitest";
import { localReceptionDraft, localReceptionMedia } from "./reception-draft-storage";

afterEach(() => vi.unstubAllGlobals());
it("isolates offline drafts and images by authenticated user and demo scope", async () => {
  const keys: unknown[] = [];
  const close = vi.fn();
  vi.stubGlobal("indexedDB", { open: () => {
    const request: any = {};
    request.result = { close, transaction: () => {
      const transaction: any = { objectStore: () => ({ get: (key: unknown) => {
        keys.push(key);
        const operation: any = { result: undefined };
        queueMicrotask(() => { operation.onsuccess?.(); transaction.oncomplete?.(); });
        return operation;
      } }) };
      return transaction;
    } };
    queueMicrotask(() => request.onsuccess());
    return request;
  } });
  await localReceptionDraft(true, undefined, "production:1");
  await localReceptionDraft(true, undefined, "production:2");
  await localReceptionMedia(true, undefined, "production:1");
  await localReceptionMedia(true, undefined, "demo:1");
  expect(new Set(keys).size).toBe(4);
  expect(keys).not.toContain("current-user");
  expect(close).toHaveBeenCalledTimes(4);
});
