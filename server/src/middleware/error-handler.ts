import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";

export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction): void {
  if (error instanceof SyntaxError && "status" in error && (error as SyntaxError & { status?: number }).status === 400) {
    response.status(400).json({ error: { code: "INVALID_JSON", message: "El cuerpo de la solicitud no es valido.", requestId: request.requestId } });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Revise los datos ingresados.", requestId: request.requestId } });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message, requestId: request.requestId } });
    return;
  }

  console.error({ requestId: request.requestId, error });
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Ocurrio un error inesperado.", requestId: request.requestId } });
}
