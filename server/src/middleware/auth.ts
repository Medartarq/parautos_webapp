import type { NextFunction, Request, Response } from "express";
import type { CurrentUser, UserRole } from "@parautos/shared";
import { AppError } from "../errors/app-error.js";
import { getCurrentUser, sessionCookieName } from "../modules/auth/service.js";

declare global {
  namespace Express {
    interface Request {
      currentUser?: CurrentUser;
      sessionToken?: string;
    }
  }
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  return header.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function requireAuthentication(request: Request, _response: Response, next: NextFunction): Promise<void> {
  try {
    const token = readCookie(request.headers.cookie, sessionCookieName);
    if (!token) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Debe iniciar sesion.");
    const user = await getCurrentUser(token);
    if (!user) throw new AppError(401, "SESSION_INVALID", "La sesion no es valida o ya vencio.");
    request.currentUser = user;
    request.sessionToken = token;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.currentUser) {
      next(new AppError(401, "AUTHENTICATION_REQUIRED", "Debe iniciar sesion."));
      return;
    }
    if (!roles.includes(request.currentUser.role)) {
      next(new AppError(403, "AUTHORIZATION_REQUIRED", "No tiene permisos para realizar esta acción."));
      return;
    }
    next();
  };
}
