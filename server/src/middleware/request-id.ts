import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestId(request: Request, response: Response, next: NextFunction): void {
  request.requestId = randomUUID();
  response.setHeader("X-Request-Id", request.requestId);
  next();
}
