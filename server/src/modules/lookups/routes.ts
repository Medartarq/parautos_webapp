import { Router } from "express";
import { normalizePlate } from "@parautos/shared";
import { z } from "zod";
import { AppError } from "../../errors/app-error.js";
import { requireAuthentication, requireRoles } from "../../middleware/auth.js";
import { findFactilizaClient, findFactilizaVehicle, findLocalClient, findLocalVehicle } from "./service.js";

const documentSchema = z.string().regex(/^\d{8}$|^\d{11}$/);
const plateSchema = z.string().trim().min(5).max(16);

function document(request: import("express").Request): string { return documentSchema.parse(request.params.document); }
function plate(request: import("express").Request): string {
  const value = normalizePlate(plateSchema.parse(request.params.plate));
  if (!value.replace(/[^A-Z0-9]/g, "")) throw new AppError(400, "INVALID_PLATE", "La placa no es válida.");
  return value;
}

export const lookupsRouter = Router();
lookupsRouter.use(requireAuthentication, requireRoles("SUPERADMINISTRADOR", "ADMINISTRADOR", "ASESOR"));
lookupsRouter.get("/local/client/:document", async (request, response) => response.json({ client: await findLocalClient(document(request)) || null }));
lookupsRouter.get("/local/vehicle/:plate", async (request, response) => response.json({ vehicle: await findLocalVehicle(plate(request)) || null }));
lookupsRouter.get("/factiliza/client/:document", async (request, response) => response.json({ client: await findFactilizaClient(document(request)) }));
lookupsRouter.get("/factiliza/vehicle/:plate", async (request, response) => response.json({ vehicle: await findFactilizaVehicle(plate(request)) }));
