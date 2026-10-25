import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { CurrentUser, LoginInput, UserRole } from "@parautos/shared";
import { getEnvironment } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import { mariaDbSessionRepository, type SessionRepository } from "./session-repository.js";

export const sessionCookieName = "parautos_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + getEnvironment().SESSION_TTL_HOURS);
  return expiresAt;
}

export function cookieOptions() {
  const env = getEnvironment();
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000
  };
}

export function createSessionService(repository: SessionRepository = mariaDbSessionRepository) {
  return {
    async login(input: LoginInput): Promise<{ user: CurrentUser; token: string }> {
      const user = await repository.findActiveUser(input.identifier);
      if (!user || !(await argon2.verify(user.password_hash, input.password)))
        throw new AppError(401, "INVALID_CREDENTIALS", "Usuario o contrasena incorrectos.");

      const token = randomBytes(32).toString("base64url");
      await repository.createSession(user.id, hashToken(token), sessionExpiry());
      const { password_hash: _passwordHash, ...currentUser } = user;
      return { user: { ...currentUser, role: currentUser.role as UserRole }, token };
    },
    async getCurrentUser(token: string): Promise<CurrentUser | undefined> {
      const tokenHash = hashToken(token);
      const user = await repository.findCurrentUser(tokenHash);
      if (!user) return undefined;
      await repository.touchSession(tokenHash);
      return { ...user, role: user.role as UserRole };
    },
    logout: async (token: string): Promise<void> => repository.revokeSession(hashToken(token)),
  };
}

const sessionService = createSessionService();
export const login = sessionService.login;
export const getCurrentUser = sessionService.getCurrentUser;
export const logout = sessionService.logout;
