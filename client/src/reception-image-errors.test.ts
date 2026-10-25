import { readFile } from "node:fs/promises";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

it.each([false, true])("reports image read errors and allows a subsequent retry, null=%s", async (nullReason) => {
  vi.resetModules();
  const template = await readFile(new URL("../public/reception-template/checklist.identified.svg", import.meta.url), "utf8");
  let failing = true;
  const reason = nullReason ? null : new DOMException("synthetic image read failure", "NotReadableError");
  class Reader {
    error = reason;
    result = "data:image/png;base64,AA==";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL() { queueMicrotask(() => { if (failing) this.onerror?.(); else this.onload?.(); }); }
  }
  vi.stubGlobal("FileReader", Reader);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith(".svg")
    ? new Response(template, { headers: { "content-type": "image/svg+xml" } })
    : new Response(new Uint8Array([0]), { headers: { "content-type": "image/png" } })));
  const { loadReceptionSvgTemplate } = await import("./reception-svg");
  if (reason) await expect(loadReceptionSvgTemplate()).rejects.toBe(reason);
  else await expect(loadReceptionSvgTemplate()).rejects.toThrow("No fue posible leer la imagen del checklist.");
  failing = false;
  await expect(loadReceptionSvgTemplate()).resolves.toContain("data:image/png;base64,AA==");
});
