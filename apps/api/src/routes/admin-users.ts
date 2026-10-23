/**
 * Admin user provisioning — Sprint 1's privacy backbone.
 * Open sign-up is DISABLED in Supabase; the CSO Desk admin creates president
 * accounts here (auth user via service_role + matching Prisma User row).
 */
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { param } from "../lib/param.js";
import { requireRole } from "../middleware/auth.js";
import { createUserSchema } from "@cso-registry/shared";
import { roleSchema } from "./admin-users.schema.js";

const router = Router();

/** GET / — list all app users (admin only). */
router.get("/", requireRole("ADMIN"), async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { organization: { select: { id: true, name: true } } },
  });
  res.json(users);
});

/** POST / — create a president (or admin) account end-to-end. */
router.post("/", requireRole("ADMIN"), async (req, res) => {
  const input = createUserSchema.parse(req.body);

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(501).json({
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not configured — account provisioning is unavailable without it.",
    });
  }

  // 1) Create the Supabase auth user with the role baked into app_metadata
  //    (service role required; clients can never write app_metadata themselves).
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name },
      app_metadata: { role: input.role },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return res.status(400).json({ error: "Supabase auth user creation failed", detail });
  }

  const authUser = (await response.json()) as { id: string };
  if (!authUser.id) {
    return res
      .status(502)
      .json({ error: "Supabase auth user creation returned an unexpected response" });
  }

  // 2) Mirror it into the app schema.
  const user = await prisma.user.create({
    data: {
      authId: authUser.id,
      email: input.email,
      name: input.name,
      role: input.role,
      organizationId: input.organizationId ?? null,
    },
    include: { organization: true },
  });

  return res.status(201).json(user);
});

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: roleSchema.optional(),
  organizationId: z.string().uuid().nullable().optional(),
});

/**
 * PATCH /:id — change app-level role/org (admin only).
 * Role changes are pushed back to Supabase app_metadata so the JWT itself carries
 * the new role (frontend can't grant self admin).
 */
router.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const input = updateUserSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { id: param(req, "id") } });
  if (!existing) return res.status(404).json({ error: "User not found" });

  const [user] = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: existing.id },
      data: {
        name: input.name ?? existing.name,
        role: input.role ?? existing.role,
        organizationId: input.organizationId !== undefined ? input.organizationId : existing.organizationId,
      },
      include: { organization: true },
    });

    if (input.role && input.role !== existing.role && env.SUPABASE_SERVICE_ROLE_KEY) {
      const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${existing.authId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ app_metadata: { role: input.role }, user_metadata: { name: input.name } }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new z.ZodError([
          {
            code: "custom",
            path: ["role"],
            message: `Supabase role sync failed — ${detail}. Prisma row was updated; re-patch to retry.`,
          },
        ]);
      }
    }

    return [updated];
  });

  res.json(user);
});

export default router;
