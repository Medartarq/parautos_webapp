import express from "express";
import { expect, it } from "vitest";
import { createTechnicalLogger } from "../logging/technical-logger.js";
import { requestId } from "./request-id.js";
import { createRequestLog } from "./request-log.js";

it("logs a completed HTTP request without its path, query, headers or body", async () => {
  const lines: string[] = [];
  const logger = createTechnicalLogger({ write: (line: string) => { lines.push(line); } });
  const app = express();
  app.use(requestId, createRequestLog(logger), express.json());
  app.post("/client/:document", (_request, response) => response.status(201).json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/client/PRIVATE_DOCUMENT?code=PRIVATE_CODE`, {
      method: "POST", headers: { "content-type": "application/json", cookie: "PRIVATE_COOKIE", authorization: "PRIVATE_TOKEN" },
      body: JSON.stringify({ email: "PRIVATE_EMAIL", password: "PRIVATE_PASSWORD" }),
    });
    await response.json();
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({ event: "request_completed", method: "POST", statusCode: 201, requestId: response.headers.get("X-Request-Id") });
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(lines.join("")).not.toContain("PRIVATE_");
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});
