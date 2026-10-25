import express from "express";
import type { Request, Response } from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "./error-handler.js";
import { requestId } from "./request-id.js";

let server: Server | undefined;
afterEach(async () => { vi.restoreAllMocks(); if (server) await new Promise<void>((resolve) => server!.close(() => resolve())); });
it("returns 413 with a request id for an oversized JSON body", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const app = express();
  app.use(requestId, express.json({ limit: "20b" }));
  app.post("/", (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  server = app.listen(0);
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address() as { port: number };
  const response = await fetch(`http://127.0.0.1:${address.port}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "a".repeat(30) }) });
  expect(response.status).toBe(413);
  await expect(response.json()).resolves.toMatchObject({ error: { code: "PAYLOAD_TOO_LARGE", requestId: expect.any(String) } });
});

function responseStub() {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  return response;
}

describe("errorHandler", () => {
  it("maps only the dedicated order-status trigger error to a conflict", () => {
    const response = responseStub();

    errorHandler({ errno: 30001, sqlMessage: "Transicion de estado de orden no permitida" }, { requestId: "request-1" } as Request, response as unknown as Response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({ error: { code: "ORDER_STATUS_TRANSITION_INVALID", message: "Transicion de estado de orden no permitida", requestId: "request-1" } });
  });
});
