import { Router } from "express";
import { loginSchema } from "@parautos/shared";
import { requireAuthentication } from "../../middleware/auth.js";
import { cookieOptions, login, logout } from "./service.js";
import { clearRateLimit, consumeRateLimit } from "../tracking/rate-limit.js";
import { loginIdentifierPolicy, loginIpPolicy, normalizedIdentifier, progressiveAuthDelay, recordRateLimitedAttempt } from "./security.js";
import { AppError } from "../../errors/app-error.js";

export const authRouter = Router();

authRouter.post("/login", async (request, response) => {
  const input = loginSchema.parse(request.body);
  const identifier = normalizedIdentifier(input.identifier);
  const ip = request.ip || "unknown";
  const [ipRate, identifierRate] = await Promise.all([
    consumeRateLimit("login_ip", ip, loginIpPolicy),
    consumeRateLimit("login_identifier", identifier, loginIdentifierPolicy),
  ]);
  if (ipRate.limited || identifierRate.limited) {
    const rate = ipRate.limited ? ipRate : identifierRate;
    await recordRateLimitedAttempt(ipRate.limited ? "login_ip" : "login_identifier", rate.attempts, request.requestId, request.ip, request.get("user-agent"));
    throw new AppError(429, "LOGIN_RATE_LIMITED", "Espera un momento antes de volver a intentar iniciar sesión.");
  }
  await progressiveAuthDelay(Math.max(ipRate.attempts, identifierRate.attempts));
  const result = await login(input);
  await clearRateLimit("login_identifier", identifier);
  response.cookie("parautos_session", result.token, cookieOptions());
  response.json({ user: result.user });
});

authRouter.post("/logout", requireAuthentication, async (request, response) => {
  await logout(request.sessionToken!);
  response.clearCookie("parautos_session", cookieOptions());
  response.status(204).send();
});

authRouter.get("/me", requireAuthentication, (request, response) => {
  response.json({ user: request.currentUser });
});
