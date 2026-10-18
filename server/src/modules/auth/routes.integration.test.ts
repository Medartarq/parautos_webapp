import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import { requestId } from "../../middleware/request-id.js";

const auth = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn(), cookieOptions: vi.fn(() => ({ httpOnly: true })) }));
const limits = vi.hoisted(() => ({ consumeRateLimit: vi.fn(), clearRateLimit: vi.fn() }));
const security = vi.hoisted(() => ({ normalizedIdentifier: (value: string) => value.trim().toLowerCase(), loginIpPolicy: {}, loginIdentifierPolicy: {}, progressiveAuthDelay: vi.fn(), recordRateLimitedAttempt: vi.fn() }));
vi.mock("./service.js", () => auth);
vi.mock("../tracking/rate-limit.js", () => limits);
vi.mock("./security.js", () => security);

import { authRouter } from "./routes.js";

let server: Server;
let origin: string;
beforeEach(async () => {
  vi.clearAllMocks();
  const app = express();
  app.use(express.json(), requestId, authRouter, errorHandler);
  server = await new Promise<Server>((resolve) => { const listening = app.listen(0, () => resolve(listening)); });
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

describe("login HTTP integration", () => {
  it("returns a uniform 429 before password verification when an IP/account window is exhausted", async () => {
    limits.consumeRateLimit.mockResolvedValueOnce({ attempts: 21, limited: true }).mockResolvedValueOnce({ attempts: 1, limited: false });
    const response = await fetch(`${origin}/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "asesor01", password: "incorrecta" }) });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "LOGIN_RATE_LIMITED" } });
    expect(auth.login).not.toHaveBeenCalled();
    expect(security.recordRateLimitedAttempt).toHaveBeenCalledOnce();
  });

  it("creates a session and clears the account window after a valid login", async () => {
    limits.consumeRateLimit.mockResolvedValue({ attempts: 1, limited: false });
    auth.login.mockResolvedValue({ token: "session-token", user: { id: 2, names: "Asesor", username: "asesor01", email: "asesor@parautos.pe", role: "ASESOR" } });
    const response = await fetch(`${origin}/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "asesor01", password: "test-password-only" }) });

    expect(response.status).toBe(200);
    expect(limits.clearRateLimit).toHaveBeenCalledWith("login_identifier", "asesor01");
    expect(response.headers.get("set-cookie")).toContain("parautos_session=session-token");
  });
});
