import { Router } from "express";
import { z } from "zod";
import { managedUserSchema, updateManagedUserSchema } from "@parautos/shared";
import { requireAuthentication, requireRoles } from "../../middleware/auth.js";
import { AppError } from "../../errors/app-error.js";
import { changeOwnPassword, createManagedUser, deleteManagedUser, listManagedUsers, setManagedUserActive, updateManagedUser } from "./service.js";

export const usersRouter = Router();
usersRouter.use(requireAuthentication);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128),
});

usersRouter.put("/me/password", async (request, response) => {
  await changeOwnPassword(
    request.currentUser!.id,
    changePasswordSchema.parse(request.body),
    request.requestId,
    request.ip,
    request.get("user-agent"),
  );
  response.status(204).end();
});

usersRouter.use(requireRoles("SUPERADMINISTRADOR"));
usersRouter.get("/", async (_request, response) => response.json({ users: await listManagedUsers() }));
usersRouter.post("/", async (request, response) => response.status(201).json({ user: await createManagedUser(managedUserSchema.parse(request.body), request.currentUser!.id, request.requestId, request.ip, request.get("user-agent")) }));
usersRouter.put("/:userId", async (request, response) => {
  const userId = Number(request.params.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) throw new AppError(400, "INVALID_USER", "El usuario no es válido.");
  await updateManagedUser(userId, updateManagedUserSchema.parse(request.body), request.currentUser!.id, request.requestId, request.ip, request.get("user-agent"));
  response.status(204).end();
});
usersRouter.patch("/:userId/active", async (request, response) => {
  const userId = Number(request.params.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) throw new AppError(400, "INVALID_USER", "El usuario no es válido.");
  await setManagedUserActive(userId, z.object({ active: z.boolean() }).parse(request.body).active, request.currentUser!.id, request.requestId, request.ip, request.get("user-agent"));
  response.status(204).end();
});
usersRouter.delete("/:userId", async (request, response) => {
  const userId = Number(request.params.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) throw new AppError(400, "INVALID_USER", "El usuario no es válido.");
  await deleteManagedUser(userId, request.currentUser!.id, request.requestId, request.ip, request.get("user-agent"));
  response.status(204).end();
});
