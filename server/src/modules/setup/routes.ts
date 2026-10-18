import { Router } from "express";
import { bootstrapAdminSchema } from "@parautos/shared";
import { bootstrapAdministrator, getSetupStatus } from "./service.js";
import { clearRateLimit, consumeRateLimit } from "../tracking/rate-limit.js";
import { bootstrapEmailPolicy, bootstrapIpPolicy, normalizedIdentifier, progressiveAuthDelay, recordRateLimitedAttempt } from "../auth/security.js";
import { AppError } from "../../errors/app-error.js";

export const setupRouter = Router();

setupRouter.get("/status", async (_request, response) => {
  response.json(await getSetupStatus());
});

setupRouter.post("/initial", async (request, response) => {
  const input = bootstrapAdminSchema.parse(request.body);
  const email = normalizedIdentifier(input.email);
  const ip = request.ip || "unknown";
  const [ipRate, emailRate] = await Promise.all([
    consumeRateLimit("bootstrap_ip", ip, bootstrapIpPolicy),
    consumeRateLimit("bootstrap_email", email, bootstrapEmailPolicy),
  ]);
  if (ipRate.limited || emailRate.limited) {
    const rate = ipRate.limited ? ipRate : emailRate;
    await recordRateLimitedAttempt(ipRate.limited ? "bootstrap_ip" : "bootstrap_email", rate.attempts, request.requestId, request.ip, request.get("user-agent"));
    throw new AppError(429, "BOOTSTRAP_RATE_LIMITED", "Espera un momento antes de volver a intentar la configuración inicial.");
  }
  await progressiveAuthDelay(Math.max(ipRate.attempts, emailRate.attempts));
  await bootstrapAdministrator(input, request.requestId, request.ip, request.get("user-agent"));
  await clearRateLimit("bootstrap_email", email);
  response.status(201).json({ message: "Administrador inicial creado." });
});
