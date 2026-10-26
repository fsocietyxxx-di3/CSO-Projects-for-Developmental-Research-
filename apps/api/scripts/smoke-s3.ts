/**
 * Sprint-3 smoke test — server MUST be running with DEV_BYPASS_AUTH=true on :4100.
 * Run: tsx scripts/smoke-s3.ts
 *
 * Uses ONLY the seeded demo members; self-cleans (bypass-recorded entries + dev-admin
 * user) so the production dataset stays presentation-clean. Seeds have recordedByUserId
 * = NULL — the dev-marker delete never touches them.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "http://localhost:4100/api/v1";
const D = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * D).toISOString();

let passed = 0;
let failed = 0;
function expect(label: string, cond: boolean, detail: unknown = "") {
  if (cond) {
    passed++;
    console.log(`PASS — ${label}`);
  } else {
    failed++;
    console.log(`FAIL — ${label}`, JSON.stringify(detail).slice(0, 300));
  }
}

async function j(path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: { raw: text } };
  }
}
const post = (path: string, body: unknown) =>
  j(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function main() {
  /* -- warm bypass caller ------------------------------------------------ */
  const me = await j("/me");
  const devUserId = me.body.id as string;
  expect("bypass caller ready", !!devUserId, me.body);

  /* -- fixtures ---------------------------------------------------------- */
  const orgs = (await j("/organizations")).body as { id: string; name: string; allotment: number }[];
  const fisher = orgs.find((o) => o.name.includes("Fisherfolk"))!;
  const women = orgs.find((o) => o.name.includes("Women"))!;
  expect("org fixtures (allotment 20)", fisher.allotment === 20 && women.allotment === 20, orgs);

  const members = (await j("/members")).body as {
    id: string; firstName: string; lastName: string; organizations: { id: string }[];
  }[];
  const jose = members.find((m) => m.firstName === "Jose")!; // Dela Cruz (not Jr.)
  const junior = members.find((m) => m.firstName === "Jose Jr.")!;
  const pedro = members.find((m) => m.firstName === "Pedro")!;
  const maria = members.find((m) => m.firstName === "Maria")!;
  expect(
    "member fixtures",
    !!jose && !!junior && !!pedro && !!maria && !!maria.organizations?.some((o) => o.id === women.id),
    members.map((m) => `${m.firstName} ${m.lastName}`),
  );

  const outsider = members.find((m) => !m.organizations?.some?.((o: unknown) => true)) ?? null;

  /* -- pre-state: fisher ledger seeded with Pedro's 2 entries -------------- */
  const preSummary = (await j("/assistances/summary?orgId=" + fisher.id)).body;
  expect(
    "seed state: Pedro aided once-distinct, 2 entries, flagged repeat",
    preSummary?.[0]?.aidedDistinct === 1 && preSummary?.[0]?.entries === 2 && preSummary?.[0]?.repeats?.[0]?.times === 2,
    preSummary,
  );

  /* -- 1) WINDOW GUARD: Pedro seeded 7 days ago --------------------------- */
  const wBlocked = await post("/assistances", {
    memberId: pedro.id, organizationId: fisher.id, type: "AYUDA",
  });
  expect("window guard → 409 (Pedro, 7d ago seed)", wBlocked.status === 409, wBlocked.body);

  /* -- 2) Jose: first entry 40d back → clean ------------------------------ */
  const jose1 = await post("/assistances", {
    memberId: jose.id, organizationId: fisher.id, type: "MEDICAL", items: "maintenance meds", receivedAt: ago(40),
  });
  expect("Jose 40d back → 201 first-time", jose1.status === 201 && jose1.body?.repeat === false, jose1.body);

  /* -- 3) Jose second (older) entry → REPEAT flag, no slot burned --------- */
  const jose2 = await post("/assistances", {
    memberId: jose.id, organizationId: fisher.id, type: "BURIAL", receivedAt: ago(41),
  });
  expect("Jose 41d back → 201 repeat=true", jose2.status === 201 && jose2.body?.repeat === true, jose2.body);

  /* -- 4) Junior first entry today ---------------------------------------- */
  const junior1 = await post("/assistances", {
    memberId: junior.id, organizationId: fisher.id, type: "AYUDA", items: "rice + groceries", amount: 1500,
  });
  expect("Junior today → 201 first-time", junior1.status === 201 && junior1.body?.repeat === false, junior1.body);

  /* -- 5) Junior again immediately → window 409 --------------------------- */
  const junior2 = await post("/assistances", {
    memberId: junior.id, organizationId: fisher.id, type: "AYUDA",
  });
  expect("2nd same-member → hard window 409", junior2.status === 409, junior2.body);

  /* -- 6) outsider to fisher → membership 409 ----------------------------- */
  if (outsider) {
    const out = await post("/assistances", {
      memberId: outsider.id, organizationId: fisher.id, type: "AYUDA",
    });
    expect("non-member → 409 does-not-belong", out.status === 409, out.body);
  } else {
    console.log("SKIP — every seeded member belongs to Fisherfolk");
  }

  /* -- 7) ALLOTMENT CAP: women → 0 free slots ------------------------------- */
  const patch1 = await j(`/organizations/${women.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allotment: 0 }),
  });
  expect("admin PATCH allotment → 0", patch1.status === 200, patch1.body);

  const capBlocked = await post("/assistances", {
    memberId: maria.id, organizationId: women.id, type: "AYUDA",
  });
  expect(
    "cap exhausted → 409 (0 free slots)",
    capBlocked.status === 409 && String(capBlocked.body?.error || "").includes("Allotment exhausted"),
    capBlocked.body,
  );

  /* -- 8) ADMIN override:true → allowed, audited --------------------------- */
  const overridden = await post("/assistances", {
    memberId: maria.id, organizationId: women.id, type: "AYUDA", override: true,
  });
  expect("override:true → 201 with override flag", overridden.status === 201 && overridden.body?.override === true, overridden.body);

  const patchBack = await j(`/organizations/${women.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allotment: 20 }),
  });
  expect("allotment restored to 20", patchBack.status === 200 && patchBack.body?.allotment === 20, patchBack.body);

  /* -- 9) FAIR ROTATION fisher: pool drained (all aided / Maria PENDING) --- */
  const fisherNext = (await j("/assistances/next-eligible?orgId=" + fisher.id + "&count=10")).body;
  expect(
    "fisher pool drained → totalEligible 0",
    fisherNext?.totalEligible === 0 && fisherNext?.next?.length === 0,
    fisherNext,
  );

  const womenNext = (await j("/assistances/next-eligible?orgId=" + women.id + "&count=10")).body;
  expect(
    "women pool has eligible + tenure-ordered",
    womenNext?.totalEligible >= 1 && new Date(womenNext?.next?.[0]?.joinedAt).getTime() <= new Date(womenNext?.next?.[1]?.joinedAt ?? 0).getTime(),
    womenNext,
  );

  /* -- 10) post-state summary --------------------------------------------- */
  const sum = (await j("/assistances/summary?orgId=" + fisher.id)).body?.[0];
  expect(
    "final fisher summary: 3 distinct / 5 entries / Pedro+Jose repeat",
    sum?.aidedDistinct === 3 && sum?.entries === 5 && sum?.repeats?.some((r: any) => r.name?.startsWith("Reyes")) && sum?.repeats?.some((r: any) => r.name?.startsWith("Dela Cruz")),
    sum,
  );

  const list = (await j("/assistances?orgId=" + fisher.id)).body;
  expect("ledger listing scoped to fisher", Array.isArray(list) && list.length === 5 && list[0]?.organization?.name?.includes("Fisherfolk"), list?.length);

  /* -- SELF-CLEANUP -------------------------------------------------------- */
  const wiped = await prisma.assistance.deleteMany({ where: { recordedByUserId: devUserId } });
  const uWiped = await prisma.user.deleteMany({ where: { authId: "dev-admin" } });
  console.log(`\ncleanup: ${wiped.count} test entries deleted · ${uWiped.count} dev caller rows deleted (seed rows untouched: recordedByUserId IS NULL)`);

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main()
  .catch((e) => { console.error("SMOKE CRASH", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
