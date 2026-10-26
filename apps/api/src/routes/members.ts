/**
 * Sprint 2 — Member profiling + duplicate detection (the heart of the system).
 *
 * Encode flow, as the client described in the interview:
 *   president types a member -> system fires duplicate-check FIRST ->
 *   hits are shown (exact vs fuzzy) -> operator decides:
 *     "same person as a hit"  -> API creates ONLY a new membership (no duplicate row)
 *     "none of them / twins"  -> API creates a fresh member record
 */
import { Router } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  duplicateCheckInputSchema,
  memberEnrollSchema,
  type MemberHit,
} from "@cso-registry/shared";
import { prisma } from "../lib/prisma.js";
import { param } from "../lib/param.js";
import { requireRole } from "../middleware/auth.js";
import { normalizeName, sameDay, similarity } from "../lib/fuzzy.js";
import { writeAudit } from "../lib/audit.js";

const router = Router();

const SIMILARITY_THRESHOLD = 0.84; // ~2-char typo tolerance on a full name
const FUZZY_POOL_SIZE = 400; // pilot scale guard rail

type CandidateMember = Prisma.MemberGetPayload<{
  include: { memberships: { include: { organization: { select: { id: true; name: true } } } } };
}>;

/** Me → Prisma user (with org) — the resolver for "whose members am I allowed to manage?" */
async function dbUser(authId: string) {
  return prisma.user.findUnique({
    where: { authId },
    include: { organization: { select: { id: true, name: true } } },
  });
}

/** Org scope: presidents are pinned to their own org; admins may pass organizationId. */
async function resolveOrgScope(
  req: { user?: { role: "ADMIN" | "PRESIDENT"; authId: string } },
  bodyOrgId?: string,
): Promise<
  { ok: true; organizationId: string } | { ok: false; status: number; error: string }
> {
  const caller = await dbUser(req.user!.authId);
  if (!caller) return { ok: false, status: 404, error: "Caller profile not found" };

  if (caller.role === "ADMIN") {
    if (bodyOrgId) {
      const exists = await prisma.organization.findUnique({ where: { id: bodyOrgId } });
      if (!exists) return { ok: false, status: 404, error: "Organization not found" };
    }
    return { ok: true, organizationId: bodyOrgId ?? caller.organizationId ?? "" };
  }

  // President
  if (!caller.organizationId) {
    return { ok: false, status: 403, error: "No organization assigned to your account — ask the CSO Desk." };
  }
  if (bodyOrgId && bodyOrgId !== caller.organizationId) {
    return { ok: false, status: 403, error: "Presidents encode members of their own organization only." };
  }
  return { ok: true, organizationId: caller.organizationId };
}

function hitsFrom(
  pool: CandidateMember[],
  input: { firstName: string; lastName: string; birthdate: Date },
): MemberHit[] {
  const first = normalizeName(input.firstName);
  const last = normalizeName(input.lastName);
  const fullName = `${first} ${last}`;

  const hits: MemberHit[] = [];
  const seen = new Set<string>();

  for (const member of pool) {
    if (seen.has(member.id)) continue;

    const mFirst = normalizeName(member.firstName);
    const mLast = normalizeName(member.lastName);
    const mFull = `${mFirst} ${mLast}`;

    const nameMatch = similarity(fullName, mFull) >= SIMILARITY_THRESHOLD;
    const birthdayMatch = sameDay(member.birthdate, input.birthdate);

    if (!(birthdayMatch || nameMatch)) continue;

    const exact = birthdayMatch && nameMatch;
    // A birthdate match alone is *very* strong — exact.
    const strong = exact || birthdayMatch;

    seen.add(member.id);
    hits.push({
      memberId: member.id,
      fullName: `${member.firstName} ${member.lastName}`.trim(),
      birthdate: member.birthdate.toISOString(),
      barangay: member.barangay,
      organizationNames: member.memberships.map((m) => m.organization.name),
      matchType: strong ? "exact" : "soft",
    });
  }

  return hits.sort((a, b) => (a.matchType === b.matchType ? 0 : a.matchType === "exact" ? -1 : 1));
}

/* ------------------------------------------------------------------ */
/* POST /duplicate-check — MUST be registered before /:id              */
/* ------------------------------------------------------------------ */
router.post("/duplicate-check", requireRole("ADMIN", "PRESIDENT"), async (req, res) => {
  const input = duplicateCheckInputSchema.parse(req.body);

  // Candidate pool: surname OR exact birthdate OR same barangay (covers
  // typo'd surnames + relocated addresses alike). Never: name alone.
  const pool = await prisma.member.findMany({
    where: {
      OR: [
        { lastName: { equals: input.lastName.trim(), mode: "insensitive" } },
        { birthdate: input.birthdate },
        { barangay: { equals: input.barangay.trim(), mode: "insensitive" } },
      ],
    },
    take: FUZZY_POOL_SIZE,
    include: { memberships: { include: { organization: { select: { name: true } } } } },
  });

  res.json({ duplicates: hitsFrom(pool, input) });
});

/* ------------------------------------------------------------------ */
/* GET / — list members (president: own org; admin: all, filterable)   */
/* ------------------------------------------------------------------ */
router.get("/", requireRole("ADMIN", "PRESIDENT"), async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const orgFilter = typeof req.query.orgId === "string" ? req.query.orgId : undefined;
  const caller = await dbUser(req.user!.authId);
  if (!caller) return res.status(404).json({ error: "Caller profile not found" });

  const orgScope =
    caller.role === "ADMIN"
      ? orgFilter
        ? { organizationId: orgFilter }
        : {}
      : { organizationId: caller.organizationId ?? "none" };

  const search = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
          { middleName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const membershipsWhere = { ...orgScope } as Prisma.MembershipWhereInput;
  const members = await prisma.member.findMany({
    where: { memberships: { some: membershipsWhere }, ...(q ? search : {}) },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 250,
    include: {
      memberships: { include: { organization: { select: { id: true, name: true } } } },
      _count: { select: { assistances: true } },
    },
  });

  res.json(
    members.map(({ _count, ...m }) => ({
      ...m,
      organizations: m.memberships.map((ms) => ms.organization),
      assistanceCount: _count.assistances,
    })),
  );
});

/* ------------------------------------------------------------------ */
/* POST / — encode NEW person or enroll an EXISTING one to this org    */
/* ------------------------------------------------------------------ */
router.post("/", requireRole("ADMIN", "PRESIDENT"), async (req, res) => {
  const input = memberEnrollSchema.parse(req.body);

  const scope = await resolveOrgScope(req, input.organizationId);
  if (!scope.ok) return res.status(scope.status).json({ error: scope.error });
  if (!scope.organizationId) {
    return res.status(400).json({ error: "organizationId is required" });
  }

  const enrollExisting = input.existingMemberId
    ? await prisma.member.findUnique({
        where: { id: input.existingMemberId },
        include: { memberships: true },
      })
    : null;

  if (input.existingMemberId && !enrollExisting) {
    return res.status(404).json({ error: "existingMemberId does not match any member record" });
  }

  if (enrollExisting) {
    // Enroll-as-same-person guard: must be exact (name + birthdate).
    const nameOk =
      normalizeName(enrollExisting.firstName) === normalizeName(input.firstName) &&
      normalizeName(enrollExisting.lastName) === normalizeName(input.lastName);
    const birthOk = sameDay(enrollExisting.birthdate, input.birthdate);
    if (!nameOk || !birthOk) {
      return res.status(409).json({
        error:
          "existingMemberId does not match the entered name + birthdate — confirm via the duplicate panel, or encode as a NEW person.",
      });
    }
  }

  try {
    const member = await prisma.$transaction(async (tx) => {
      const memberId = enrollExisting?.id;

      if (!memberId) {
        const created = await tx.member.create({
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            middleName: input.middleName || null,
            birthdate: input.birthdate,
            gender: input.gender,
            address: input.address,
            barangay: input.barangay,
            householdId: input.householdId || null,
            consentAccepted: true,
          },
        });

        await tx.membership.create({
          data: { memberId: created.id, organizationId: scope.organizationId, status: "ACTIVE" },
        });
        return created;
      }

      await tx.membership.create({
        data: { memberId, organizationId: scope.organizationId, status: "ACTIVE" },
      });
      return enrollExisting;
    });

    const acter = await dbUser(req.user!.authId);
    await writeAudit(prisma, {
      userId: acter?.id,
      action: enrollExisting ? "MEMBER_ENROLL_EXISTING" : "MEMBER_ENCODE",
      entity: `Member:${member.id}`,
      meta: { organizationId: scope.organizationId, name: `${member.firstName} ${member.lastName}` },
    });

    const full = await prisma.member.findUnique({
      where: { id: member.id },
      include: { memberships: { include: { organization: { select: { id: true, name: true } } } } },
    });
    return res.status(201).json(full);
  } catch (err) {
    // Already-enrolled-to-this-org guard (schema @@unique([memberId, organizationId]))
    const pErr = err as Prisma.PrismaClientKnownRequestError;
    if (pErr.code === "P2002") {
      return res.status(409).json({ error: "Member already belongs to this organization." });
    }
    throw err;
  }
});

/* ------------------------------------------------------------------ */
/* GET /:id — full cross-org profile                                   */
/* ------------------------------------------------------------------ */
router.get("/:id", requireRole("ADMIN", "PRESIDENT"), async (req, res) => {
  const id = param(req, "id");
  const caller = await dbUser(req.user!.authId);
  if (!caller) return res.status(404).json({ error: "Caller profile not found" });

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      memberships: { include: { organization: { select: { id: true, name: true } } } },
      assistances: { include: { organization: { select: { id: true, name: true } } }, orderBy: { receivedAt: "desc" } },
    },
  });
  if (!member) return res.status(404).json({ error: "Member not found" });

  if (caller.role !== "ADMIN") {
    const sharesOrg = member.memberships.some(
      (m) => m.organizationId && m.organizationId === caller.organizationId,
    );
    if (!sharesOrg) return res.status(403).json({ error: "Member is outside your organization scope." });
  }

  res.json(member);
});

export default router;
