import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../errors/app-error.js";
import { getEnvironment } from "../../config/env.js";
import { getPublicTracking } from "./service.js";

const lookupSchema = z.object({
  plate: z.string().trim().min(1).max(16),
  code: z.string().trim().regex(/^\d{6}$/),
});

const attemptsByIp = new Map<string, { count: number; resetAt: number }>();
const windowMs = 60_000;
const maxAttempts = 10;

function limitLookup(ip: string): void {
  const now = Date.now();
  const attempt = attemptsByIp.get(ip);
  if (!attempt || attempt.resetAt <= now) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (attempt.count >= maxAttempts)
    throw new AppError(429, "TRACKING_RATE_LIMITED", "Espera un momento antes de volver a consultar.");
  attempt.count += 1;
}

export const trackingRouter = Router();
trackingRouter.use((request, response, next) => {
  const origin = request.get("origin");
  const environment = getEnvironment();
  const host = origin ? new URL(origin).hostname : "";
  const localNetworkHost = /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);
  if (environment.NODE_ENV === "development" && origin && new URL(origin).port === "5173" && localNetworkHost) {
    response.set("Access-Control-Allow-Origin", origin);
    response.set("Vary", "Origin");
  }
  next();
});
trackingRouter.get("/", async (request, response) => {
  response.set("Cache-Control", "no-store");
  limitLookup(request.ip || "unknown");
  const parsed = lookupSchema.safeParse(request.query);
  if (!parsed.success)
    throw new AppError(400, "INVALID_TRACKING_LOOKUP", "Ingresa una placa y un código de consulta válidos.");

  const plate = parsed.data.plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!plate)
    throw new AppError(400, "INVALID_TRACKING_LOOKUP", "Ingresa una placa y un código de consulta válidos.");
  const tracking = await getPublicTracking({ plate, code: parsed.data.code });
  if (!tracking)
    throw new AppError(404, "TRACKING_NOT_FOUND", "No encontramos una orden con esos datos. Verifica la placa y el código exactamente como aparecen en tu constancia.");

  response.json({ tracking });
});
