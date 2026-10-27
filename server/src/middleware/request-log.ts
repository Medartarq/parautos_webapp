import type { RequestHandler } from "express";
import { technicalLogger } from "../logging/technical-logger.js";

export function createRequestLog(logger = technicalLogger): RequestHandler {
  return (request, response, next) => {
    const started = performance.now();
    response.once("finish", () => logger.requestCompleted({
      requestId: request.requestId, method: request.method,
      statusCode: response.statusCode, durationMs: performance.now() - started,
    }));
    next();
  };
}
