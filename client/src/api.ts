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
