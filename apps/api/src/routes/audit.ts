/**
 * Sprint 5 — the audit lens. Writes have been happening since Sprint 1
 * (writeAudit everywhere); this is the CSO Desk's read model over them.
 * Admin-only: audit trails are desk authority, not org property.
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", requireRole("ADMIN"), async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const take = Math.min(Number(req.query.take ?? 250) || 250, 500);

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { name: true, email: true } } },
  });

  const needle = q.toLowerCase();
  const filtered = q
    ? logs.filter(
        (l) =>
          l.action.toLowerCase().includes(needle) ||
          (l.entity ?? "").toLowerCase().includes(needle) ||
          (l.user?.name ?? "").toLowerCase().includes(needle) ||
          JSON.stringify(l.meta ?? {}).toLowerCase().includes(needle),
      )
    : logs;

  res.json(
    filtered.map((l) => ({
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      action: l.action,
      entity: l.entity,
      meta: l.meta ?? null,
      user: l.user ? { name: l.user.name, email: l.user.email } : null,
    })),
  );
});

export default router;
