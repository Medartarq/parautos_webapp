import { Router } from "express";
import { z } from "zod";
import { requireAuthentication, requireRoles } from "../../middleware/auth.js";
import { listAuditEvents } from "./service.js";

export const auditRouter = Router();
auditRouter.use(requireAuthentication, requireRoles("SUPERADMINISTRADOR", "ADMINISTRADOR"));
auditRouter.get("/events", async (request, response) => {
  const filters = z.object({ text: z.string().trim().max(200).optional(), userId: z.coerce.number().int().positive().optional(), action: z.string().trim().max(80).optional(), from: z.string().date().optional(), to: z.string().date().optional() }).parse(request.query);
  response.json(await listAuditEvents(filters));
});
