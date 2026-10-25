import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { resourceKey, type DataScope } from "./query-client";

export const DataScopeContext = createContext<DataScope | undefined>(undefined);

export function useScopedQuery<T>(resource: string, path: string) {
  const scope = useContext(DataScopeContext);
  if (!scope) throw new Error("La consulta necesita un contexto de sesión.");
  return useQuery({ queryKey: resourceKey(scope, resource), queryFn: ({ signal }) => api<T>(path, { signal }) });
}
