import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";
import { queryClient, resourceKey } from "./query-client";
afterEach(() => { vi.unstubAllGlobals(); queryClient.clear(); });
it("leaves multipart boundaries to fetch and preserves custom headers", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetch);
  const form = new FormData();
  form.set("category", "RECEPCION");
  await api("/attachments/orders/1", { method: "POST", body: form, headers: new Headers({ "X-Test": "audit" }) });
  const init = fetch.mock.calls[0][1];
  expect(new Headers(init.headers).get("Content-Type")).toBeNull();
  expect(new Headers(init.headers).get("X-Test")).toBe("audit");
  expect(init.credentials).toBe("include");
});
it("preserves JSON defaults when adding request headers", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);
  await expect(api("/orders/1/claim", { method: "PATCH", headers: { "X-Test": "audit" }, body: "{}" })).resolves.toBeUndefined();
  expect(new Headers(fetch.mock.calls[0][1].headers).get("Content-Type")).toBe("application/json");
});
it("retains HTTP status for draft conflict handling", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Conflicto" } }), { status: 409 })));
  await expect(api("/orders/reception-draft")).rejects.toMatchObject({ message: "Conflicto", status: 409 });
});

it("invalidates order data only after a successful write", async () => {
  const key = resourceKey({ userId: 1, mode: "production" }, "orders");
  queryClient.setQueryData(key, ["original"]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Conflicto" } }), { status: 409 })));
  await expect(api("/orders/1/claim", { method: "PATCH" })).rejects.toMatchObject({ status: 409 });
  expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  await api("/orders/1/claim", { method: "PATCH" });
  expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
});

it("preserves the session cache when logout fails and clears it after revocation succeeds", async () => {
  queryClient.setQueryData(resourceKey({ userId: 1, mode: "demo" }, "orders"), ["private"]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
  await expect(api("/auth/logout", { method: "POST" })).rejects.toMatchObject({ status: 500 });
  expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  await api("/auth/logout", { method: "POST" });
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});

it("clears cached real data after switching the demo cookie", async () => {
  queryClient.setQueryData(resourceKey({ userId: 1, mode: "production" }, "orders"), ["private"]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  await api("/demo/enter", { method: "POST" });
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});
