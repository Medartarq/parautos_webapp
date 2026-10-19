import { Router } from "express";
import { requireAuthentication, requireRoles } from "../../middleware/auth.js";
import { demoCookie } from "../../middleware/demo-context.js";
import { getEnvironment } from "../../config/env.js";

export const demoRouter = Router();
demoRouter.use(requireAuthentication, requireRoles("SUPERADMINISTRADOR"));
demoRouter.get("/status", (request, response) => response.json({ enabled: getEnvironment().DEMO_MODE_ENABLED, active: request.headers.cookie?.includes(`${demoCookie}=1`) ?? false }));
demoRouter.post("/enter", (_request, response) => {
  if (!getEnvironment().DEMO_MODE_ENABLED) return response.status(404).end();
  response.cookie(demoCookie, "1", { httpOnly: true, secure: getEnvironment().NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 * 1000 });
  response.status(204).end();
});
demoRouter.post("/exit", (_request, response) => {
  response.clearCookie(demoCookie, { httpOnly: true, secure: getEnvironment().NODE_ENV === "production", sameSite: "lax", path: "/" });
  response.status(204).end();
});
