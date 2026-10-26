/** Sprint-2 smoke test — run: tsx smoke.tmp.ts (server with bypass on :4100) */
const BASE = "http://localhost:4100/api/v1";
const j = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { status: res.status, body: { raw: text } };
  }
};

const ok = (label: string, cond: boolean, detail: unknown) =>
  console.log(`${cond ? "PASS" : "FAIL"} — ${label}`, cond ? "" : detail);

async function main() {
  // warm /me (creates the bypass caller row)
  await j("/me");

  // org ids
  const orgs = (await j("/organizations")).body as { id: string; name: string }[];
  const fisherId = orgs.find((o) => o.name.includes("Fisherfolk"))!.id;
  const womenId = orgs.find((o) => o.name.includes("Women"))!.id;

  // list members → find Pedro
  const members = (await j("/members")).body as {
    id: string;
    firstName: string;
    lastName: string;
    birthdate: string;
    barangay: string;
    organizations: { name: string }[];
  }[];
  const pedro = members.find((m) => m.firstName === "Pedro")!;
  ok("list: Pedro present", !!pedro, members.map((m) => m.firstName));

  // duplicate-check on Pedro — EXACT hit
  const dc = await j("/members/duplicate-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Pedro",
      lastName: "Reyes",
      birthdate: pedro.birthdate.slice(0, 10),
      barangay: pedro.barangay,
    }),
  });
  const hit = ((dc.body as { duplicates: { memberId: string; matchType: string }[] }).duplicates ?? [])
    .find((d) => d.memberId === pedro.id);
  ok("duplicate-check: EXACT hit on Pedro", hit?.matchType === "exact", dc.body);

  // A) enroll Pedro into Women org via existingMemberId
  const enroll = await j("/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Pedro",
      lastName: "Reyes",
      birthdate: pedro.birthdate.slice(0, 10),
      gender: "MALE",
      address: pedro.barangay,
      barangay: pedro.barangay,
      consentAccepted: true,
      existingMemberId: pedro.id,
      organizationId: womenId,
    }),
  });
  ok("enroll existing → 201", enroll.status === 201, enroll.body);
  const membershipsAfter = (enroll.body as { memberships?: { organization: { name: string } }[] })
    .memberships?.map((m) => m.organization.name);
  ok(
    "Pedro now spans BOTH orgs",
    membershipsAfter?.includes("Women of Riverside Demo Society") &&
      membershipsAfter?.includes("Tabing Dagat Fisherfolk Demo Association"),
    membershipsAfter,
  );

  // B) same but WRONG birthdate → guard 409
  const badEnroll = await j("/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Pedro",
      lastName: "Reyes",
      birthdate: "1952-04-02",
      gender: "MALE",
      address: "x",
      barangay: pedro.barangay,
      consentAccepted: true,
      existingMemberId: pedro.id,
      organizationId: womenId,
    }),
  });
  ok("wrong-birthdate enroll → 409 guard", badEnroll.status === 409, badEnroll);

  // C) encode brand-new person (admin MUST pass organizationId — UI enforces via select)
  const create = await j("/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Smoke",
      lastName: "Del_ab001",
      birthdate: "1999-05-05",
      gender: "MALE",
      address: "9 Test Ave.",
      barangay: "Zapote",
      consentAccepted: true,
      organizationId: womenId,
    }),
  });
  ok("encode new (with admin org) → 201", create.status === 201, create.body);
  const newId = (create.body as { id: string }).id;

  // D) duplicate-check surfaces the new person (self-hit, exact)
  const selfCheck = await j("/members/duplicate-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Smoke",
      lastName: "Del_ab001",
      birthdate: "1999-05-05",
      barangay: "Zapote",
    }),
  });
  const selfHit = (selfCheck.body as { duplicates: { memberId: string; matchType: string }[] })
    .duplicates?.find((d) => d.memberId === newId);
  ok("re-check finds new person as EXACT", selfHit?.matchType === "exact", selfCheck.body);

  // E) one-final enroll to fisherfolk (second org for same Smoke) — should also 201
  const second = await j("/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Smoke",
      lastName: "Del_ab001",
      birthdate: "1999-05-05",
      gender: "MALE",
      address: "9 Test Ave.",
      barangay: "Zapote",
      consentAccepted: true,
      existingMemberId: newId,
      organizationId: fisherId,
    }),
  });
  ok("second-org enroll for same person → 201", second.status === 201, second.body);

  console.log("\n--- cleanup needed rows: Smoke Delaperla member + dev-admin caller ---");
  console.log(JSON.stringify({ smokeId: newId, pedroId: pedro.id }, null, 0));
}

main().catch((e) => {
  console.error("SMOKE CRASH", e);
  process.exit(1);
});
