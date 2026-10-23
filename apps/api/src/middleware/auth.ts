/**
 * Auth middleware — Supabase Auth issues the JWT; this API is the enforcement point.
 * Strategy:
 *   - JWKS (RS256) is the default — matches current Supabase signing keys.
 *   - SUPABASE_JWT_SECRET (HS256) is a legacy fallback for older projects.
 * Role claims are read from app_metadata ONLY (users can edit user_metadata themselves).
 */
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { env, jwksUrl } from "../config/env.js";

export type AuthRole = "ADMIN" | "PRESIDENT";

export interface AuthUser {
  authId: string;
  email?: string;
  name?: string;
  role: AuthRole;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

const jwks = jwksClient({
  jwksUri: jwksUrl,
  cache: true,
  cacheMaxAge: 10 * 60 * 1000,
});

function verifyWithJwks(token: string): Promise<jwt.JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => {
        jwks.getSigningKey(header.kid as string, (err, key) => {
          if (err || !key) return callback(err ?? new Error("JWKS key not found"));
          callback(null, key.getPublicKey());
        });
      },
      { algorithms: ["RS256"] },
      (err, decoded) => (err ? reject(err) : resolve(decoded as jwt.JwtPayload)),
    );
  });
}

function verifyWithSecret(token: string): Promise<jwt.JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      env.SUPABASE_JWT_SECRET as string,
      { algorithms: ["HS256"] },
      (err, decoded) => (err ? reject(err) : resolve(decoded as jwt.JwtPayload)),
    );
  });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (env.DEV_BYPASS_AUTH) {
    req.user = { authId: "dev-admin", email: "dev@admin.local", name: "Dev Admin", role: "ADMIN" };
    return next();
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const payload = await (env.SUPABASE_JWT_SECRET
      ? verifyWithSecret(header.slice(7))
      : verifyWithJwks(header.slice(7)));

    req.user = {
      authId: String(payload.sub),
      email: typeof payload.email === "string" ? payload.email : undefined,
      name:
        (typeof payload.name === "string" ? payload.name : undefined) ??
        (typeof payload.user_metadata?.name === "string" ? payload.user_metadata.name : undefined) ??
        payload.email,
      role: payload.app_metadata?.role === "ADMIN" ? "ADMIN" : "PRESIDENT",
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** RBAC gate — call after requireAuth, e.g. router.post("/", requireRole("ADMIN"), handler). */
export function requireRole(...roles: AuthRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden — insufficient role" });
    }
    next();
  };
}
