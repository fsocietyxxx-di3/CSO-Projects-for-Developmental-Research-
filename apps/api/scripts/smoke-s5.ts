/**
 * Sprint-5 smoke test — server with DEV_BYPASS_AUTH=true (SMOKE_BASE override-able).
 * The cross-sprint story, end to end on the seeded data:
 *   clear WITH_CASES (admin) → turnover → ayuda BLOCKED (S3 guard!) →
 *   reactivate → ayuda flows again → audit lens shows the whole trail.
 * Run: tsx scripts/smoke-s5.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = process.env.SMOKE_BASE ?? "http://localhost:4100/api/v1";

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

async function j(path: string, method: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: { raw: text } };
  }
}

async function main() {
  const me = await j("/me", "GET");
  const devUserId = me.body?.id as string;
  expect("bypass caller ready (admin)", me.status === 200 && !!devUserId, me.body);

  /* fixtures: Jose Jr. in Fisherfolk */
  const members = (await j("/members?orgId=", "GET")).body as {
    id: string; firstName: string; lastName: string; memberships: { id: string; organizationId: string; status: string }[];
  }[];
  const junior = members.find((m) => m.firstName === "Jose Jr.")!;
  const orgs = (await j("/organizations", "GET")).body as { id: string; name: string }[];
  const fisher = orgs.find((o) => o.name.includes("Fisherfolk"))!;
  const fisherMembership = junior.memberships.find((x) => x.organizationId === fisher.id)!;
  expect("junior's fisher membership located (ACTIVE)", !!fisherMembership && fisherMembership.status === "ACTIVE", fisherMembership);

  /* 1) ADMIN names the clearance (verified standing authority) */
  const clearance = await j(`/memberships/${fisherMembership.id}/clearance`, "POST", { goodStanding: "WITH_CASES" });
  expect("clearance WITH_CASES → 200", clearance.status === 200 && clearance.body?.goodStanding === "WITH_CASES", clearance.body);

  /* 2) TURNOVER — membership ends (CLEARED + endedAt) */
  const turnover = await j(`/memberships/${fisherMembership.id}/turnover`, "POST");
  expect(
    "turnover → CLEARED + endedAt set",
    turnover.status === 200 && turnover.body?.status === "CLEARED" && !!turnover.body?.endedAt,
    turnover.body,
  );

  /* 3) CROSS-SPRINT GUARD: ayuda on a CLEARED membership → blocked */
  const blockedAyuda = await j("/assistances", "POST", { memberId: junior.id, organizationId: fisher.id, type: "AYUDA" });
  expect(
    "ayuda on turned-over member → 409 (S5 guard meets S3 ledger)",
    blockedAyuda.status === 409 && String(blockedAyuda.body?.error || "").includes("turned over"),
    blockedAyuda.body,
  );

  /* 4) re-audit before reactivation: TURNOVER + CLEARANCE_SET already recorded */
  const auditMid = (await j("/audit?take=250", "GET")).body as { action: string; meta?: Record<string, unknown> }[];
  const midActions = auditMid.map((a) => a.action);
  expect("audit already shows CLEARANCE_SET + TURNOVER", midActions.includes("CLEARANCE_SET") && midActions.includes("TURNOVER"), [...new Set(midActions)]);

  /* 5) REACTIVATE (another org would re-derive standing from the profile chip) */
  const reactivate = await j(`/memberships/${fisherMembership.id}/reactivate`, "POST");
  expect(
    "reactivate → ACTIVE + endedAt null",
    reactivate.status === 200 && reactivate.body?.status === "ACTIVE" && reactivate.body?.endedAt === null,
    reactivate.body,
  );

  /* 6) ayuda flows again (first-time: mild verify of the returned ledger write) */
  const ayuda = await j("/assistances", "POST", { memberId: junior.id, organizationId: fisher.id, type: "AYUDA", items: "post-clearance pack" });
  expect("ayuda after reactivate → 201", ayuda.status === 201 && ayuda.body?.repeat === false, ayuda.body);

  /* 7) audit lens contains the full trail incl. this ASSISTANCE_RECORD */
  const audit = (await j("/audit?take=250", "GET")).body as { action: string }[];
  const actions = audit.map((a) => a.action);
  expect(
    "audit shows CLEARANCE_SET · TURNOVER · MEMBERSHIP_REACTIVATE · ASSISTANCE_RECORD",
    actions.includes("CLEARANCE_SET") && actions.includes("TURNOVER") && actions.includes("MEMBERSHIP_REACTIVATE") && actions.includes("ASSISTANCE_RECORD"),
    [...new Set(actions)],
  );

  /* 8) final summary still reconciles (junior distinct in fisher ledger) */
  const summary = (await j("/assistances/summary?orgId=" + fisher.id, "GET")).body?.[0];
  expect("fisher summary reconciles after lifecycle (2 distinct, 3 entries)", summary?.aidedDistinct === 2 && summary?.entries === 3, summary);

  /* -- cleanup: dev-recorded entries + dev caller row --------------------- */
  const wiped = await prisma.assistance.deleteMany({ where: { recordedByUserId: devUserId } });
  const uWiped = await prisma.user.deleteMany({ where: { authId: "dev-admin" } });
  console.log(`\ncleanup: ${wiped.count} test entries + ${uWiped.count} dev rows removed (demo keeps junior WITH_CASES badge on purpose)`);

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main()
  .catch((e) => { console.error("SMOKE CRASH", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
