/**
 * Seed data — FABRICATED people on purpose (RA 10173): we never test with real
 * citizen data. The seed plants the exact duplicate patterns the system must catch:
 *  - one member belonging to two organizations (cross-org membership)
 *  - one family spread across two organizations (household grouping)
 *  - a member who received assistance twice from the same org (the "Si Eva" problem)
 */
import { PrismaClient, Gender, MembershipStatus, StandingStatus } from "@prisma/client";
import { faker } from "./faker";

const prisma = new PrismaClient();

async function main() {
  // --- admin + one president demo account -----------------------------------
  // NOTE: these are Prisma rows only — they must match auth users you create in
  // Supabase (see docs/supabase-setup.md). DEV_BYPASS_AUTH covers the admin case
  // for local dev until a real Supabase admin user exists.
  const orgs = await Promise.all([
    prisma.organization.create({
      data: {
        name: "Tabing Dagat Fisherfolk Demo Association",
        type: "NGO",
        about: "Demo organization #1 — fisherfolk advocacy (fictional data)",
        barangay: "Zapote",
        accreditationStatus: "ACCREDITED",
        accreditationValidUntil: new Date("2027-06-30"),
      },
    }),
    prisma.organization.create({
      data: {
        name: "Women of Riverside Demo Society",
        type: "NGO",
        about: "Demo organization #2 — women's welfare (fictional data)",
        barangay: "San Nicolas",
        accreditationStatus: "PENDING",
      },
    }),
  ]);
  const [fisherfolk, womens] = orgs;

  // --- persons ---------------------------------------------------------------
  const jose = await prisma.member.create({
    data: member("Jose", "Dela Cruz", 1975, "MALE", "14 Mabini St., Brgy. Zapote", "Zapote"),
  });
  const maria = await prisma.member.create({
    data: member("Maria", "Dela Cruz", 1978, "FEMALE", "14 Mabini St., Brgy. Zapote", "Zapote"),
  });
  const junior = await prisma.member.create({
    data: member("Jose Jr.", "Dela Cruz", 2005, "MALE", "14 Mabini St., Brgy. Zapote", "Zapote"),
  });
  const ana = await prisma.member.create({
    data: member("Ana", "Santos", 1990, "FEMALE", "7 Liwayway St., Brgy. San Nicolas", "San Nicolas"),
  });
  const pedro = await prisma.member.create({
    data: member("Pedro", "Reyes", 1952, "MALE", "2 Baybay Blvd., Brgy. Zapote", "Zapote"),
  });

  // --- memberships (with the planted duplicates) ------------------------------
  await Promise.all([
    prisma.membership.create({
      data: {
        memberId: jose.id,
        organizationId: fisherfolk.id,
        role: "President",
        status: MembershipStatus.ACTIVE,
        goodStanding: StandingStatus.GOOD_STANDING,
      },
    }),
    // ⚠️ duplicate pattern #1: same person in a second org
    prisma.membership.create({
      data: { memberId: jose.id, organizationId: womens.id, status: MembershipStatus.ACTIVE },
    }),
    prisma.membership.create({
      data: { memberId: maria.id, organizationId: womens.id, status: MembershipStatus.ACTIVE },
    }),
    // ⚠️ duplicate pattern #2: whole family enrolled in a second group
    prisma.membership.create({
      data: { memberId: maria.id, organizationId: fisherfolk.id, status: MembershipStatus.PENDING },
    }),
    prisma.membership.create({
      data: { memberId: junior.id, organizationId: fisherfolk.id, status: MembershipStatus.ACTIVE },
    }),
    prisma.membership.create({
      data: { memberId: ana.id, organizationId: womens.id, role: "Secretary", status: MembershipStatus.ACTIVE },
    }),
    prisma.membership.create({
      data: { memberId: pedro.id, organizationId: fisherfolk.id, status: MembershipStatus.ACTIVE },
    }),
  ]);

  // --- assistance ledger (with the planted repeat) ----------------------------
  const now = new Date();
  await Promise.all([
    prisma.assistance.create({
      data: {
        memberId: pedro.id,
        organizationId: fisherfolk.id,
        type: "AYUDA",
        items: "Rice 5kg, sardines, noodles",
        receivedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 90),
      },
    }),
    // 🚩 the audit case: ANOTHER batch, SAME org, SAME person — the "Si Eva" scenario
    prisma.assistance.create({
      data: {
        memberId: pedro.id,
        organizationId: fisherfolk.id,
        type: "AYUDA",
        items: "Rice 5kg, blankets",
        receivedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7),
      },
    }),
    // next-eligible surfaces: ana/junior never received → suggestion queue shows them
    prisma.assistance.create({
      data: {
        memberId: jose.id,
        organizationId: womens.id,
        type: "MEDICAL",
        amount: 1500,
        receivedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30),
      },
    }),
  ]);

  console.log("Seed complete: 2 orgs, 5 members, 7 memberships (2 planted duplicate patterns), 3 assistance records.");
}

function member(
  firstName: string,
  lastName: string,
  birthYear: number,
  gender: Gender,
  address: string,
  barangay: string,
) {
  return {
    firstName,
    lastName,
    birthdate: faker.birthdate(birthYear),
    gender,
    address,
    barangay,
    householdId: lastName === "Dela Cruz" ? "delacruz-mabini14" : undefined,
    consentAccepted: true,
  };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
