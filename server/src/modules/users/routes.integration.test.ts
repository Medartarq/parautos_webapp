import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../middleware/error-handler.js";
import { requestId } from "../../middleware/request-id.js";

const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn(), sessionCookieName: "parautos_session" }));
const users = vi.hoisted(() => ({ listManagedUsers: vi.fn(), createManagedUser: vi.fn(), setManagedUserActive: vi.fn() }));
vi.mock("../auth/service.js", () => auth);
vi.mock("./service.js", () => users);

import { usersRouter } from "./routes.js";

const userFor = (role: "SUPERADMINISTRADOR" | "ADMINISTRADOR" | "ASESOR") => ({
  id: 17,
  names: "Usuario de prueba",
  username: "prueba",
  email: "prueba@parautos.pe",
  role,
});

let server: Server;
let origin: string;
beforeEach(async () => {
  vi.clearAllMocks();
  const app = express();
  app.use(express.json(), requestId, usersRouter, errorHandler);
  server = await new Promise<Server>((resolve) => { const listening = app.listen(0, () => resolve(listening)); });
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

const authenticated = { cookie: "parautos_session=valid-session" };

describe("user management HTTP authorization", () => {
  it("allows a superadministrator to list accounts", async () => {
    auth.getCurrentUser.mockResolvedValue(userFor("SUPERADMINISTRADOR"));
    users.listManagedUsers.mockResolvedValue([{ ...userFor("SUPERADMINISTRADOR"), active: true, createdAt: new Date() }]);

    const response = await fetch(`${origin}/`, { headers: authenticated });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ users: [{ role: "SUPERADMINISTRADOR" }] });
    expect(users.listManagedUsers).toHaveBeenCalledOnce();
  });

  it.each(["ADMINISTRADOR", "ASESOR"] as const)("denies %s access to account management", async (role) => {
    auth.getCurrentUser.mockResolvedValue(userFor(role));

    const response = await fetch(`${origin}/`, { headers: authenticated });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "AUTHORIZATION_REQUIRED" } });
    expect(users.listManagedUsers).not.toHaveBeenCalled();
  });

  it("allows a superadministrator to create an administrator account", async () => {
    auth.getCurrentUser.mockResolvedValue(userFor("SUPERADMINISTRADOR"));
    users.createManagedUser.mockResolvedValue({ ...userFor("ADMINISTRADOR"), active: true, createdAt: new Date() });
    const payload = { names: "Ana Pérez", username: "ana.perez", email: "ana@parautos.pe", role: "ADMINISTRADOR", password: "una-clave-segura" };

    const response = await fetch(`${origin}/`, { method: "POST", headers: { ...authenticated, "content-type": "application/json" }, body: JSON.stringify(payload) });

    expect(response.status).toBe(201);
    expect(users.createManagedUser).toHaveBeenCalledWith(payload, 17, expect.any(String), expect.any(String), expect.any(String));
  });

  it("allows a superadministrator to change an account state", async () => {
    auth.getCurrentUser.mockResolvedValue(userFor("SUPERADMINISTRADOR"));
    users.setManagedUserActive.mockResolvedValue(undefined);

    const response = await fetch(`${origin}/25/active`, { method: "PATCH", headers: { ...authenticated, "content-type": "application/json" }, body: JSON.stringify({ active: false }) });

    expect(response.status).toBe(204);
    expect(users.setManagedUserActive).toHaveBeenCalledWith(25, false, 17, expect.any(String), expect.any(String), expect.any(String));
  });
});
