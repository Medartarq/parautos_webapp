import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import { requestId } from "../../middleware/request-id.js";

const limits = vi.hoisted(() => ({ consumeRateLimit: vi.fn() }));
const tracking = vi.hoisted(() => ({ getPublicTracking: vi.fn() }));
vi.mock("./rate-limit.js", () => limits);
vi.mock("./service.js", () => tracking);
vi.mock("../../config/env.js", () => ({ getEnvironment: () => ({ NODE_ENV: "test" }) }));

import { trackingRouter } from "./routes.js";

let server: Server;
let origin: string;
beforeEach(async () => {
  vi.clearAllMocks();
  const app = express();
  app.use(requestId, trackingRouter, errorHandler);
  server = await new Promise<Server>((resolve) => { const listening = app.listen(0, () => resolve(listening)); });
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

describe("public tracking HTTP integration", () => {
  it("does not reflect untrusted Origin headers", async () => {
    limits.consumeRateLimit.mockResolvedValue({ attempts: 1, limited: false });
    tracking.getPublicTracking.mockResolvedValue(null);

    const response = await fetch(`${origin}/?plate=ABC123&code=123456`, { headers: { origin: "https://attacker.example" } });

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns 429 before looking up a public case when the shared window is limited", async () => {
    limits.consumeRateLimit.mockResolvedValue({ attempts: 11, limited: true });
    const response = await fetch(`${origin}/?plate=ABC123&code=123456`);

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "TRACKING_RATE_LIMITED" } });
    expect(tracking.getPublicTracking).not.toHaveBeenCalled();
  });

  it("normalizes the plate and exposes only the public projection", async () => {
    limits.consumeRateLimit.mockResolvedValue({ attempts: 1, limited: false });
    tracking.getPublicTracking.mockResolvedValue({ orderNumber: "OS-2026-00001", plate: "ABC123", brand: "TOYOTA", model: "COROLLA", publicStatus: "EN_REPARACION" });
    const response = await fetch(`${origin}/?plate=abc-123&code=123456`);

    expect(response.status).toBe(200);
    expect(tracking.getPublicTracking).toHaveBeenCalledWith({ plate: "ABC123", code: "123456" });
    await expect(response.json()).resolves.toEqual({ tracking: { orderNumber: "OS-2026-00001", plate: "ABC123", brand: "TOYOTA", model: "COROLLA", publicStatus: "EN_REPARACION" } });
  });
});
