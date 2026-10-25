import { clearSessionQueries, invalidateOrderQueries } from "./query-client";

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!(options?.body instanceof FormData) && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/v1${path}`, {
    credentials: "include",
    ...options,
    headers,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { error?: { message?: string } } | undefined;
    const error = new Error(body?.error?.message ?? "No fue posible completar la operacion.") as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  const result = response.status === 204 ? (undefined as T) : await response.json() as T;
  const method = (options?.method || "GET").toUpperCase();
  if (method === "POST" && ["/auth/login", "/auth/logout", "/demo/enter", "/demo/exit"].includes(path))
    await clearSessionQueries();
  else await invalidateOrderQueries(path, method);
  return result;
}

export async function openAttachment(attachmentId: number): Promise<void> {
  const viewer = window.open("", "_blank");
  try {
    const response = await fetch(`/api/v1/attachments/${attachmentId}/content`, { credentials: "include" });
    if (!response.ok) {
      const body = (await response.json().catch(() => undefined)) as { error?: { message?: string } } | undefined;
      throw new Error(body?.error?.message ?? "No fue posible abrir el adjunto.");
    }
    const url = URL.createObjectURL(await response.blob());
    if (!viewer) {
      window.location.assign(url);
      return;
    }
    viewer.location.replace(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    viewer?.close();
    throw error;
  }
}
