import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { requireRoles } from "./auth.js";

function requestFor(role?: "ADMINISTRADOR" | "ASESOR"): Request {
  return {
    currentUser: role
      ? { id: 1, names: "Usuario de prueba", username: "prueba", email: "prueba@parautos.pe", role }
      : undefined,
  } as Request;
}

describe("role authorization", () => {
  it("allows an administrator through an administrator-only action", () => {
    const next = vi.fn();
    requireRoles("ADMINISTRADOR")(requestFor("ADMINISTRADOR"), {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("returns a 403 error when an advisor invokes an administrator-only action", () => {
    const next = vi.fn();
    requireRoles("ADMINISTRADOR")(requestFor("ASESOR"), {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403, code: "AUTHORIZATION_REQUIRED" }));
  });

  it("returns a 401 error when no authenticated user reaches a role-protected action", () => {
    const next = vi.fn();
    requireRoles("ADMINISTRADOR")(requestFor(), {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401, code: "AUTHENTICATION_REQUIRED" }));
  });
});
