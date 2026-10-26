/**
 * Sprint 5 — membership lifecycle: clearance (CSO Desk authority) and
 * turnover/reactivation (org autonomy). Every action is audited.
 *
 * Transfer story this powers:
 *   president turns the member over -> membership ends (CLEARED + endedAt)
 *   -> an otra org's president encodes the same person (duplicate-check path)
 *   -> their profile shows the standing chip from the previous org.
 */
import { Router } from "express";
import { membershipClearanceSchema, type MembershipActionResult } from "@cso-registry/shared";
import { prisma } from "../lib/prisma.js";
import { param } from "../lib/param.js";
import { requireRole } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";

const router = Router();

type Caller = {
  id: string;
  role: "ADMIN" | "PRESIDENT";
  organizationId: string | null;
};

async function requireCaller(req: { user?: { authId: string } }): Promise<Caller | null> {
  const dbUser = await prisma.user.findUnique({ where: { authId: req.user!.authId } });
  if (!dbUser) return null;
  return { id: dbUser.id, role: dbUser.role, organizationId: dbUser.organizationId };
}

/** Can this caller manage THIS membership's roster state? */
function canManage(caller: Caller, membership: { organizationId: string }): boolean {
  if (caller.role === "ADMIN") return true;
  return !!caller.organizationId && caller.organizationId === membership.organizationId;
}

function present(m: {
  id: string;
  memberId: string;
  organizationId: string;
  status: string;
  goodStanding: string | null;
  endedAt: Date | null;
  organization: { name: string } | null;
}): MembershipActionResult {
  return {
    id: m.id,
    memberId: m.memberId,
    organizationId: m.organizationId,
    organizationName: m.organization?.name ?? "",
    status: m.status,
    goodStanding: m.goodStanding,
    endedAt: m.endedAt ? m.endedAt.toISOString() : null,
  };
}

/* ------------------------------------------------------------------ */
/* POST /:id/clearance — ADMIN names the standing (verified clearances  */
/* ------------------------------------------------------------------ */
router.post("/:id/clearance", requireRole("ADMIN"), async (req, res) => {
  const input = membershipClearanceSchema.parse(req.body);
  const caller = await requireCaller(req as never);
  if (!caller) return res.status(404).json({ error: "Caller profile not found" });

  const membership = await prisma.membership.findUnique({
    where: { id: param(req, "id") },
    include: { organization: { select: { name: true } } },
  });
  if (!membership) return res.status(404).json({ error: "Membership not found" });

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { goodStanding: input.goodStanding },
    include: { organization: { select: { name: true } } },
  });

  await writeAudit(prisma, {
    userId: caller.id,
    action: "CLEARANCE_SET",
    entity: `Membership:${membership.id}`,
    meta: { memberId: membership.memberId, goodStanding: input.goodStanding, organizationId: membership.organizationId },
  });

  res.json(present(updated));
});

/* ------------------------------------------------------------------ */
/* POST /:id/turnover — end the membership (CLEARED + endedAt)          */
/* ------------------------------------------------------------------ */
router.post("/:id/turnover", requireRole("ADMIN", "PRESIDENT"), async (req, res) => {
  const caller = await requireCaller(req as never);
  if (!caller) return res.status(404).json({ error: "Caller profile not found" });

  const membership = await prisma.membership.findUnique({
    where: { id: param(req, "id") },
    include: { organization: { select: { name: true } } },
  });
  if (!membership) return res.status(404).json({ error: "Membership not found" });
  if (!canManage(caller, membership)) {
    return res.status(403).json({ error: "Only this organization's roster or the CSO Desk can turn members over." });
  }
  if (membership.status === "CLEARED" && membership.endedAt) {
    return res.status(409).json({ error: "This membership is already turned over." });
  }

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { status: "CLEARED", endedAt: new Date() },
    include: { organization: { select: { name: true } } },
  });

  await writeAudit(prisma, {
    userId: caller.id,
    action: "TURNOVER",
    entity: `Membership:${membership.id}`,
    meta: { memberId: membership.memberId, organizationId: membership.organizationId, statusBefore: membership.status },
  });

  res.json(present(updated));
});

/* ------------------------------------------------------------------ */
/* POST /:id/reactivate — bring a turned-over membership back to ACTIVE */
/* ------------------------------------------------------------------ */
router.post("/:id/reactivate", requireRole("ADMIN", "PRESIDENT"), async (req, res) => {
  const caller = await requireCaller(req as never);
  if (!caller) return res.status(404).json({ error: "Caller profile not found" });

  const membership = await prisma.membership.findUnique({
    where: { id: param(req, "id") },
    include: { organization: { select: { name: true } } },
  });
  if (!membership) return res.status(404).json({ error: "Membership not found" });
  if (!canManage(caller, membership)) {
    return res.status(403).json({ error: "Only this organization's roster or the CSO Desk can reactivate." });
  }
  if (membership.status === "ACTIVE" && !membership.endedAt) {
    return res.status(409).json({ error: "This membership is already active." });
  }

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { status: "ACTIVE", endedAt: null },
    include: { organization: { select: { name: true } } },
  });

  await writeAudit(prisma, {
    userId: caller.id,
    action: "MEMBERSHIP_REACTIVATE",
    entity: `Membership:${membership.id}`,
    meta: { memberId: membership.memberId, organizationId: membership.organizationId, statusBefore: membership.status },
  });

  res.json(present(updated));
});

export default router;
