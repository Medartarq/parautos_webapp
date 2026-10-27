import { expect, it } from "vitest";
import { clearSessionQueries, createQueryClient, invalidateOrderQueries, resourceKey } from "./query-client";

it("deduplicates simultaneous reads while separating users and real/demo data", async () => {
  const client = createQueryClient();
  try {
    let requests = 0;
    const load = () => client.fetchQuery({ queryKey: resourceKey({ userId: 1, mode: "production" }, "orders"), queryFn: async () => { requests++; return ["original"]; } });
    await Promise.all([load(), load()]);
    await load();
    expect(requests).toBe(1);
    expect(client.getQueryData(resourceKey({ userId: 1, mode: "demo" }, "orders"))).toBeUndefined();
    expect(client.getQueryData(resourceKey({ userId: 2, mode: "production" }, "orders"))).toBeUndefined();
  } finally { client.clear(); }
});

it("cancels old reads before clearing a session so late responses cannot restore its data", async () => {
  const client = createQueryClient();
  let signal: AbortSignal | undefined;
  let complete!: (value: string[]) => void;
  const pending = client.fetchQuery({ queryKey: resourceKey({ userId: 1, mode: "demo" }, "orders"), queryFn: (context) => {
    signal = context.signal;
    return new Promise<string[]>((resolve) => { complete = resolve; });
  } }).catch(() => undefined);
  await clearSessionQueries(client);
  complete(["old private data"]);
  await pending;
  expect(signal?.aborted).toBe(true);
  expect(client.getQueryCache().getAll()).toHaveLength(0);
});

it("invalidates affected resources after a mutation but not during draft autosaves", async () => {
  const client = createQueryClient();
  const key = resourceKey({ userId: 1, mode: "production" }, "orders");
  try {
    client.setQueryData(key, ["before"]);
    await invalidateOrderQueries("/orders/reception-draft", "PUT", client);
    await invalidateOrderQueries("/orders/1/quote-draft", "PUT", client);
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    await invalidateOrderQueries("/orders/1/claim", "PATCH", client);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  } finally { client.clear(); }
});
