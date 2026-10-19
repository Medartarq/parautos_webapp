import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import { requestId } from "../../middleware/request-id.js";

const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn(), sessionCookieName: "parautos_session" }));
const database = vi.hoisted(() => ({ pool: { query: vi.fn() } }));
const storage = vi.hoisted(() => ({ readStoredFile: vi.fn(), storeFile: vi.fn(), deleteStoredFile: vi.fn() }));
vi.mock("../auth/service.js", () => auth);
vi.mock("../../db/pool.js", () => ({ getPool: () => database.pool }));
vi.mock("./storage.js", () => storage);

import { attachmentsRouter } from "./routes.js";

let server: Server;
let origin: string;
beforeEach(async () => {
  vi.clearAllMocks();
  const app = express();
  app.use(requestId, attachmentsRouter, errorHandler);
  server = await new Promise<Server>((resolve) => { const listening = app.listen(0, () => resolve(listening)); });
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

describe("private attachment HTTP access", () => {
  it("rejects a direct attachment URL without a session before accessing storage", async () => {
    const response = await fetch(`${origin}/42/content`);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "AUTHENTICATION_REQUIRED" } });
    expect(database.pool.query).not.toHaveBeenCalled();
    expect(storage.readStoredFile).not.toHaveBeenCalled();
  });

  it("serves an attachment only after validating the session", async () => {
    auth.getCurrentUser.mockResolvedValue({ id: 7, names: "Asesor", username: "asesor", email: "asesor@parautos.pe", role: "ASESOR" });
    database.pool.query.mockResolvedValue([{ objectKey: "2026/10/evidence.png", storageProvider: "local", mimeType: "image/png", originalName: "evidencia.png" }]);
    storage.readStoredFile.mockResolvedValue(Buffer.from("private-image"));

    const response = await fetch(`${origin}/42/content`, { headers: { cookie: "parautos_session=valid-session" } });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("private-image");
    expect(storage.readStoredFile).toHaveBeenCalledWith("local", "2026/10/evidence.png");
  });
});
