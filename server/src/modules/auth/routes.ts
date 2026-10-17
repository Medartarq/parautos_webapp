import { Router } from "express";
import { loginSchema } from "@parautos/shared";
import { requireAuthentication } from "../../middleware/auth.js";
import { cookieOptions, login, logout } from "./service.js";

export const authRouter = Router();

authRouter.post("/login", async (request, response) => {
  const input = loginSchema.parse(request.body);
  const result = await login(input);
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
