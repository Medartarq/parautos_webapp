export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { error?: { message?: string } } | undefined;
    throw new Error(body?.error?.message ?? "No fue posible completar la operacion.");
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
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
