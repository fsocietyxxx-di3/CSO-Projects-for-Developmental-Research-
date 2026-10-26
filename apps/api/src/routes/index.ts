import { Router } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import organizationRoutes from "./organizations.js";
import adminUserRoutes from "./admin-users.js";
import memberRoutes from "./members.js";

const router = Router();

/** Public — Render healthCheckPath + UptimeRobot pinger. */
router.get("/health", (_req, res) => {
  res.json({ ok: true, env: env.NODE_ENV, time: new Date().toISOString() });
});

/* Everything below requires a verified Supabase session. */
router.use(requireAuth);

/**
 * GET /me — resolves the caller's app-level profile.
 * First call after admin provisioning auto-creates the Prisma row if missing.
 */
router.get("/me", async (req, res) => {
  const { authId, email, name, role } = req.user!;
  let user = await prisma.user.findUnique({ where: { authId }, include: { organization: true } });
  if (!user) {
    user = await prisma.user.create({
      data: { authId, email: email ?? `${authId}@unknown.local`, name: name ?? "Unknown", role },
      include: { organization: true },
    });
  }
  res.json(user);
});

/* Sprint 1 module — org registry. */
router.use("/organizations", organizationRoutes);

/* Sprint 1 module — CSO Desk admin provisions president accounts. */
router.use("/admin/users", adminUserRoutes);

/* Sprint 2 module — member profiling + duplicate detection. */
router.use("/members", memberRoutes);

export default router;
