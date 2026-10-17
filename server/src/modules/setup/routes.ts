import { Router } from "express";
import { bootstrapAdminSchema } from "@parautos/shared";
import { bootstrapAdministrator, getSetupStatus } from "./service.js";

export const setupRouter = Router();

setupRouter.get("/status", async (_request, response) => {
  response.json(await getSetupStatus());
});

setupRouter.post("/initial", async (request, response) => {
  const input = bootstrapAdminSchema.parse(request.body);
  await bootstrapAdministrator(input, request.requestId, request.ip, request.get("user-agent"));
  response.status(201).json({ message: "Administrador inicial creado." });
});
