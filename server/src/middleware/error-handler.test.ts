import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "./error-handler.js";

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
