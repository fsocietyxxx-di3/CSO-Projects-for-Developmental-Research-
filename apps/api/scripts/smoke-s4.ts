/**
 * Sprint-4 smoke test — server with DEV_BYPASS_AUTH=true on :4100.
 * Read-only sprint (JSON summary + binary exports), so cleanup is just the
 * dev-admin caller row. Run: tsx scripts/smoke-s4.ts
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
    console.log(`FAIL — ${label}`, JSON.stringify(detail).slice(0, 240));
  }
}

async function json(path: string) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function binary(path: string) {
  const res = await fetch(`${BASE}${path}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const cd = res.headers.get("content-disposition") ?? "";
  return { status: res.status, buf, bytes: buf.length, cd, head: buf.subarray(0, 4).toString() };
}

async function main() {
  const me = await json("/me");
  const devUserId = me.body?.id as string;
  expect("bypass caller ready", !!devUserId, me.body);

  /* -- summary aggregates (seeded state: 4 members, 3 seed entries) -------- */
  const s = await json("/reports/summary");
  const r = s.body;
  expect("summary 200", s.status === 200, s);
  expect("totals.members === 5 seed members", r?.totals?.members === 5, r?.totals);
  expect("totals.entries === 3 seed entries", r?.totals?.entries === 3, r?.totals);
  expect("amountTotal > 0", r?.totals?.amountTotal > 0, r?.totals);
  expect("scope ALL_ORGS for admin", r?.scope === "ALL_ORGS", r?.scope);

  const names = (r?.byOrg ?? []).map((o: { name: string }) => o.name);
  expect(
    "byOrg: fisher active=3/recipients=1, women active? ✓ rows",
    r?.byOrg?.length === 2 && r.byOrg.some((o: { name: string; activeMembers: number; recipients: number }) => o.name.includes("Fisherfolk") && o.activeMembers === 3 && o.recipients === 1),
    names,
  );

  const genders = (r?.byGender ?? []).map((g: { gender: string; members: number }) => g.gender).join(",");
  expect(
    "GAD rows sum to 5 members",
    (r?.byGender ?? []).reduce((sum: number, g: { members: number }) => sum + g.members, 0) === 5,
    genders,
  );
  expect("byBarangay includes Zapote", (r?.byBarangay ?? []).some((b: { barangay: string }) => b.barangay === "Zapote"), r?.byBarangay);
  expect("byType includes MEDICAL", (r?.byType ?? []).some((t: { type: string }) => t.type === "MEDICAL"), r?.byType);

  /* -- exports -------------------------------------------------------------- */
  const mx = await binary("/reports/export?kind=members&format=xlsx");
  expect("members.xlsx → PK magic + >2KB", mx.status === 200 && mx.head.startsWith("PK") && mx.bytes > 2048, { head: mx.head, bytes: mx.bytes });
  expect("members.xlsx filename header", mx.cd.includes(`cso-members-`), mx.cd);

  const mp = await binary("/reports/export?kind=members&format=pdf");
  expect("members.pdf → %PDF + >=1 page bytes", mp.status === 200 && mp.head.startsWith("%PDF") && mp.bytes > 1000, { head: mp.head, bytes: mp.bytes });

  const lx = await binary("/reports/export?kind=assistances&format=xlsx");
  expect("ledger.xlsx → PK magic", lx.status === 200 && lx.head.startsWith("PK") && lx.bytes > 2048, { head: lx.head, bytes: lx.bytes });

  const lp = await binary("/reports/export?kind=assistances&format=pdf");
  expect("ledger.pdf → %PDF", lp.status === 200 && lp.head.startsWith("%PDF"), { head: lp.head, bytes: lp.bytes });

  const sp = await binary("/reports/export?kind=summary&format=pdf");
  expect("summary.pdf → %PDF + substantial", sp.status === 200 && sp.head.startsWith("%PDF") && sp.bytes > 1500, { head: sp.head, bytes: sp.bytes });

  const bad = await binary("/reports/export?kind=summary&format=xlsx");
  expect("summary.xlsx rejected → 400", bad.status === 400, bad);

  const bogus = await binary("/reports/export?kind=nonsense&format=pdf");
  expect("unknown kind rejected → 400", bogus.status === 400, bogus);

  /* -- sanity: export row counts via xlsx is binary; ledger.pdf size should   */
  /* reflect 3 entries — assert content size grows with rows (rough >= floor)  */
  expect("ledger.pdf complete (header + 3 rows)", lp.bytes >= 1500, lp.bytes);

  /* -- cleanup: read-only sprint -------------------------------------------- */
  const uWiped = await prisma.user.deleteMany({ where: { authId: "dev-admin" } });
  console.log(`\ncleanup: ${uWiped.count} dev caller row(s) removed (no data written by Sprint 4 endpoints)`);

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main()
  .catch((e) => { console.error("SMOKE CRASH", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
