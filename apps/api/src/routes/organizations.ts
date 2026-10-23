import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { param } from "../lib/param.js";
import { requireRole } from "../middleware/auth.js";
import { organizationCreateSchema, organizationUpdateSchema } from "@cso-registry/shared";

const router = Router();

/** GET / — every authenticated user (desk admin sees all; presidents may browse). */
router.get("/", async (_req, res) => {
  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { memberships: { where: { status: "ACTIVE" } } },
      },
    },
  });

  res.json(
    orgs.map(({ _count, ...org }) => ({ ...org, activeMemberCount: _count.memberships })),
  );
});

router.get("/:id", async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: param(req, "id") },
    include: {
      memberships: { include: { member: true }, where: { status: "ACTIVE" } },
    },
  });
  if (!org) return res.status(404).json({ error: "Organization not found" });
  res.json(org);
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const input = organizationCreateSchema.parse(req.body);
  const org = await prisma.organization.create({
    data: {
      name: input.name,
      type: input.type,
      about: input.about,
      barangay: input.barangay,
      accreditationStatus: input.accreditationStatus,
      accreditationValidUntil: input.accreditationValidUntil ?? null,
      allotment: input.allotment,
    },
  });
  res.status(201).json(org);
});

router.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const input = organizationUpdateSchema.parse(req.body);
  const data: Record<string, unknown> = { ...input };
  if ("accreditationValidUntil" in input) {
    data.accreditationValidUntil = input.accreditationValidUntil ?? null;
  }
  const org = await prisma.organization.update({
    where: { id: param(req, "id") },
    data,
  });
  res.json(org);
});

/**
 * DELETE /:id — admin only, and only when empty: donor-funded partner lists are
 * audit-relevant, so orgs with memberships must be retired (PATCH status), not deleted.
 */
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const count = await prisma.membership.count({ where: { organizationId: param(req, "id") } });
  if (count > 0) {
    return res
      .status(409)
      .json({ error: "Organization has members — retire it (Re-encode / LAPSED) instead of deleting." });
  }
  await prisma.organization.delete({ where: { id: param(req, "id") } });
  res.status(204).send();
});

export default router;
