/**
 * Sprint 3 — Assistance (ayuda) ledger + per-NGO allotments + fair rotation.
 *
 * The three business rules (straight from the interview):
 *  1. WINDOW GUARD — same member + same org within 30 days → hard 409.
 *     ("Nabigyan na to sa kabila, nabigyan pa rin siya dito" ends here.)
 *  2. ALLOTMENT CAP — per-NGO slots ("may allotment kami per NGO na 20");
 *     measured in DISTINCT people aided, so repeats never burn double slots.
 *     Admin may pass override:true to exceed (audited: ASSISTANCE_ALLOT_OVERRIDE).
 *  3. FAIR ROTATION — next-eligible = members with zero entries, tenure-first.
 */
import { Router } from "express";
import { Prisma, type PrismaClient } from "@prisma/client";
import { assistanceRecordSchema, type AllotmentSummary, type MemberLite } from "@cso-registry/shared";
import { prisma } from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";

const router = Router();
const WINDOW_DAYS = 30;

type Caller = {
  id: string;
  role: "ADMIN" | "PRESIDENT";
  organizationId: string | null;
  authId: string;
};

type DbLike = Prisma.TransactionClient | PrismaClient;

async function requireCaller(
  req: { user?: { authId: string; role: "ADMIN" | "PRESIDENT" } },
): Promise<Caller | null> {
  const user = req.user!;
  const dbUser = await prisma.user.findUnique({ where: { authId: user.authId } });
  if (!dbUser) return null;
  return { id: dbUser.id, role: dbUser.role, organizationId: dbUser.organizationId, authId: user.authId };
}

/** One aggregation powering the cap + dashboards: distinct aided, repeats, row count. */
async function ledgerStats(db: DbLike, orgId: string) {
  const groups = await db.assistance.groupBy({
    by: ["memberId"],
    where: { organizationId: orgId },
    _count: { _all: true },
  });

  const aidedDistinct = groups.length;
  const entries = await db.assistance.count({ where: { organizationId: orgId } });

  const repeatIdByCount = groups
    .filter((g) => g._count._all > 1)
    .map((g) => ({ memberId: g.memberId, times: g._count._all }));

  const repeats: Array<MemberLite & { times: number }> = [];
  if (repeatIdByCount.length) {
    const members = await db.member.findMany({
      where: { id: { in: repeatIdByCount.map((r) => r.memberId) } },
      select: { id: true, firstName: true, lastName: true, barangay: true },
    });
    const timesByMember = new Map(repeatIdByCount.map((r) => [r.memberId, r.times] as const));
    for (const m of members) {
      repeats.push({
        id: m.id,
        name: `${m.lastName}, ${m.firstName}`,
        barangay: m.barangay,
        times: timesByMember.get(m.id) ?? 0,
      });
    }
    repeats.sort((a, b) => b.times - a.times);
  }
  return { aidedDistinct, entries, repeats };
}

/* ------------------------------------------------------------------ */
/* POST / — record one assistance entry (the guarded write)             */
/* ------------------------------------------------------------------ */
router.post("/", requireRole("ADMIN", "PRESIDENT"), async (req, res) => {
  const input = assistanceRecordSchema.parse(req.body);
  const caller = await requireCaller(req as never);
  if (!caller) return res.status(404).json({ error: "Caller profile not found" });

  /* org resolution — presidents pinned, admins explicit */
  let orgId: string | null = null;
  if (caller.role === "PRESIDENT") {
    if (!caller.organizationId) {
      return res.status(403).json({ error: "No organization assigned to your account — ask the CSO Desk." });
    }
    if (input.organizationId && input.organizationId !== caller.organizationId) {
      return res.status(403).json({ error: "Presidents record assistance for their own organization only." });
    }
    orgId = caller.organizationId;
  } else {
    if (!input.organizationId) {
      return res.status(400).json({ error: "organizationId is required (admins are not org-bound)." });
    }
    const exists = await prisma.organization.findUnique({ where: { id: input.organizationId } });
    if (!exists) return res.status(404).json({ error: "Organization not found" });
    orgId = input.organizationId;
  }
  if (!orgId) return res.status(400).json({ error: "organizationId could not be resolved." });

  // member must belong to this org (any membership row — ACTIVE or PENDING)
  const membership = await prisma.membership.findUnique({
    where: { memberId_organizationId: { memberId: input.memberId, organizationId: orgId } },
  });
  if (!membership) {
    return res.status(409).json({
      error: "Member does not belong to this organization — assistance targets this org's own members.",
    });
  }

  const member = await prisma.member.findUnique({ where: { id: input.memberId } });
  if (!member) return res.status(404).json({ error: "Member not found" });

  const receivedAt = input.receivedAt ?? new Date();

  const outcome = await prisma.$transaction(async (tx) => {
    // 1) WINDOW GUARD (within 30 days)
    const windowCount = await tx.assistance.count({
      where: {
        memberId: input.memberId,
        organizationId: orgId as string,
        receivedAt: { gte: new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000) },
      },
    });
    if (windowCount > 0) return { verdict: "window-blocked" as const };

    // 2) REPEAT? (prior entry exists, older than the window)
    const priorCount = await tx.assistance.count({
      where: { memberId: input.memberId, organizationId: orgId as string },
    });
    const isRepeat = priorCount > 0;

    // 3) ALLOTMENT CAP (distinct people; repeats don't consume new slots)
    let override = false;
    if (!isRepeat) {
      const { aidedDistinct } = await ledgerStats(tx, orgId as string);
      const allotment = await tx.organization.findUnique({
        where: { id: orgId as string },
        select: { allotment: true },
      });
      const cap = allotment?.allotment ?? 0;
      if (aidedDistinct + 1 > cap) {
        if (caller.role === "ADMIN" && input.override) {
          override = true;
        } else {
          return { verdict: "cap-blocked" as const, cap, aidedDistinct };
        }
      }
    }

    const entry = await tx.assistance.create({
      data: {
        memberId: input.memberId,
        organizationId: orgId as string,
        type: input.type,
        items: input.items || null,
        amount: input.amount ?? null,
        receivedAt,
        recordedByUserId: caller.id,
      },
    });

    await writeAudit(tx, {
      userId: caller.id,
      action: override ? "ASSISTANCE_ALLOT_OVERRIDE" : isRepeat ? "ASSISTANCE_REPEAT" : "ASSISTANCE_RECORD",
      entity: `Assistance:${entry.id}`,
      meta: {
        memberId: input.memberId,
        organizationId: orgId,
        type: input.type,
        override,
      },
    });

    return { verdict: "ok" as const, entry, isRepeat, override };
  });

  if (outcome.verdict === "window-blocked") {
    return res.status(409).json({
      error: `Already received assistance from this organization within the last ${WINDOW_DAYS} days.`,
    });
  }
  if (outcome.verdict === "cap-blocked") {
    return res.status(409).json({
      error: `Allotment exhausted — ${outcome.aidedDistinct}/${outcome.cap} distinct members already aided. Admins may pass override:true (audited).`,
    });
  }

  return res.status(201).json({
    entry: outcome.entry,
    repeat: outcome.isRepeat,
    override: outcome.override,
    allotmentWindowDays: WINDOW_DAYS,
  });
});
/* ------------------------------------------------------------------ */
/* GET /?orgId&memberId — ledger listing (scoped)                      */
/* ------------------------------------------------------------------ */
router.get("/", requireRole("ADMIN", "PRESIDENT"), async (req, res) => {
  const caller = await requireCaller(req as never);
  if (!caller) return res.status(404).json({ error: "Caller profile not found" });

  const qOrg = typeof req.query.orgId === "string" ? req.query.orgId : undefined;
  const qMember = typeof req.query.memberId === "string" ? req.query.memberId : undefined;

  const where: Prisma.AssistanceWhereInput = {};
  if (caller.role === "PRESIDENT") {
    where.organizationId = caller.organizationId ?? "none";
  } else if (qOrg) {
    where.organizationId = qOrg;
  }
  if (qMember) where.memberId = qMember;

  const rows = await prisma.assistance.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    take: 250,
    include: {
      member: { select: { id: true, firstName: true, lastName: true, barangay: true } },
      organization: { select: { id: true, name: true } },
    },
  });

  res.json(
    rows.map((r) => ({
      id: r.id,
      receivedAt: r.receivedAt,
      type: r.type,
      items: r.items,
      amount: r.amount,
      memberId: r.member.id,
      member: `${r.member.lastName}, ${r.member.firstName}`,
      barangay: r.member.barangay,
      organization: r.organization,
    })),
  );
});

/* ------------------------------------------------------------------ */
/* GET /summary?orgId — allotment snapshot (one org or ALL orgs)        */
/* ------------------------------------------------------------------ */
router.get("/summary", requireRole("ADMIN", "PRESIDENT"), async (req, res) => {
  const caller = await requireCaller(req as never);
  if (!caller) return res.status(404).json({ error: "Caller profile not found" });

  const qOrg = typeof req.query.orgId === "string" ? req.query.orgId : undefined;

  let orgIds: string[] = [];
  if (caller.role === "PRESIDENT") {
    if (!caller.organizationId) return res.json([]);
    orgIds = qOrg && qOrg !== caller.organizationId ? [] : [caller.organizationId];
  } else {
    const all = await prisma.organization.findMany({ select: { id: true }, orderBy: { name: "asc" } });
    orgIds = qOrg ? all.filter((o) => o.id === qOrg).map((o) => o.id) : all.map((o) => o.id);
  }

  const summaries: AllotmentSummary[] = [];
  for (const id of orgIds) {
    const org = await prisma.organization.findUnique({ where: { id }, select: { name: true, allotment: true } });
    if (!org) continue;
    const stats = await ledgerStats(prisma, id);
    summaries.push({
      organizationId: id,
      organizationName: org.name,
      allotment: org.allotment,
      aidedDistinct: stats.aidedDistinct,
      entries: stats.entries,
      repeats: stats.repeats,
      unused: Math.max(0, org.allotment - stats.aidedDistinct),
    });
  }

  res.json(summaries);
});

/* ------------------------------------------------------------------ */
/* GET /next-eligible?orgId&count — fair-rotation suggestion            */
/* ------------------------------------------------------------------ */
router.get("/next-eligible", requireRole("ADMIN", "PRESIDENT"), async (req, res) => {
  const caller = await requireCaller(req as never);
  if (!caller) return res.status(404).json({ error: "Caller profile not found" });

  const qOrg = typeof req.query.orgId === "string" ? req.query.orgId : undefined;
  const count = Math.min(Number(req.query.count ?? 10) || 10, 50);

  let orgId: string | null = null;
  if (caller.role === "PRESIDENT") {
    orgId = caller.organizationId;
  } else if (qOrg) {
    orgId = qOrg;
  }
  if (!count || !orgId) {
    return res.status(400).json({ error: "orgId + count are required for org-bound suggestions." });
  }

  // ACTIVE members of the org with their tenure
  const pool = await prisma.membership.findMany({
    where: { organizationId: orgId, status: "ACTIVE" },
    select: {
      joinedAt: true,
      member: { select: { id: true, firstName: true, lastName: true, barangay: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  const aided = await prisma.assistance.groupBy({
    by: ["memberId"],
    where: { organizationId: orgId },
  });
  const aidedSet = new Set(aided.map((g) => g.memberId));

  const eligible = pool
    .map((p) => ({
      memberId: p.member.id,
      name: `${p.member.lastName}, ${p.member.firstName}`,
      barangay: p.member.barangay,
      joinedAt: p.joinedAt,
    }))
    .filter((p) => !aidedSet.has(p.memberId));

  res.json({
    organizationId: orgId,
    count: Math.min(count, eligible.length),
    totalEligible: eligible.length,
    next: eligible.slice(0, count).map((p) => ({
      id: p.memberId,
      name: p.name,
      barangay: p.barangay,
      joinedAt: p.joinedAt.toISOString(),
    })),
  });
});

export default router;
