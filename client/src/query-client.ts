import { QueryClient } from "@tanstack/react-query";

export type DataScope = { userId: number; mode: "production" | "demo" };
export const sessionKey = (scope: DataScope) => ["session", scope.userId, scope.mode] as const;
export const resourceKey = (scope: DataScope, resource: string) => [...sessionKey(scope), resource] as const;

export function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: {
    staleTime: 15_000, gcTime: 5 * 60_000,
    retry: (attempt, error) => attempt < 1 && !("status" in error && typeof error.status === "number" && error.status < 500),
    refetchOnWindowFocus: true,
  }, mutations: { retry: false } } });
}

export const queryClient = createQueryClient();

export async function clearSessionQueries(client = queryClient) {
  await client.cancelQueries();
  client.clear();
}

export async function invalidateOrderQueries(path: string, method: string, client = queryClient) {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;
  const pathname = path.split("?")[0];
  if (!/^\/(orders(?:\/|$)|attachments\/orders\/)/.test(pathname)) return;
  if (/\/(reception-draft|quote-draft)$/.test(pathname)) return;
  const predicate = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] === "session"
    && ["orders", "reports", "navigation-summary", "pending-notifications"].includes(String(query.queryKey[3]));
  await client.cancelQueries({ predicate });
  await client.invalidateQueries({ predicate });
}
