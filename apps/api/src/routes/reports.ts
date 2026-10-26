/**
 * Sprint 4 — Reports & Analytics + one-click exports.
 *
 * GET /summary            JSON aggregates (tiles + tables on the Reports screen)
 * GET /export?kind&format binary downloads:
 *    kind=members|assistances → format=xlsx (ExcelJS) | pdf (pdfkit)
 *    kind=summary             → format=pdf (totals, GAD breakdown, per-org)
 *
 * Scoping: admins see the whole pilot pool; presidents see their own org only.
 * PDFs say "PHP" instead of ₱ — Helvetica's WinAnsi encoding has no peso glyph.
 */
import { Router } from "express";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import {
  prisma,
} from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.js";
import type {
  ReportBarangayRow,
  ReportGenderRow,
  ReportOrgRow,
  ReportSummary,
  ReportTypeRow,
} from "@cso-registry/shared";

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

/** Org ids the caller may report on (admins: every org; presidents: their own). */
async function scopeOrgs(caller: Caller): Promise<{
  ids: string[];
  scope: "ALL_ORGS" | "OWN_ORG";
}> {
  if (caller.role === "ADMIN") {
    const all = await prisma.organization.findMany({ select: { id: true } });
    return { ids: all.map((o) => o.id), scope: "ALL_ORGS" };
  }
  return { ids: caller.organizationId ? [caller.organizationId] : [], scope: "OWN_ORG" };
}

const labelFor = (g: string) => (g === "MALE" ? "Male" : g === "FEMALE" ? "Female" : "Other");

/** Everything the JSON + PDF summary need, computed in one pass. */
async function buildSummary(orgIds: string[], scope: "ALL_ORGS" | "OWN_ORG"): Promise<ReportSummary> {
  const [members, entries, orgs] = await Promise.all([
    prisma.member.findMany({
      where: { memberships: { some: { organizationId: { in: orgIds } } } },
      select: {
        id: true,
        gender: true,
        barangay: true,
        memberships: { where: { organizationId: { in: orgIds } }, select: { organizationId: true, status: true } },
      },
    }),
    prisma.assistance.findMany({
      where: { organizationId: { in: orgIds } },
      select: { memberId: true, organizationId: true, type: true, amount: true, member: { select: { gender: true, barangay: true } } },
    }),
    prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true, allotment: true }, orderBy: { name: "asc" } }),
  ]);

  const memberById = new Map(members.map((m) => [m.id, m] as const));

  const byOrg: ReportOrgRow[] = orgs.map((o) => {
    const entriesHere = entries.filter((e) => e.organizationId === o.id);
    return {
      name: o.name,
      activeMembers: members.filter((m) =>
        m.memberships.some((ms) => ms.organizationId === o.id && ms.status === "ACTIVE"),
      ).length,
      entries: entriesHere.length,
      recipients: new Set(entriesHere.map((e) => e.memberId)).size,
      allotment: o.allotment,
    };
  });

  const barangayMap = new Map<string, ReportBarangayRow>();
  for (const m of members) {
    const row = barangayMap.get(m.barangay) ?? { barangay: m.barangay, members: 0, recipients: 0 };
    row.members += 1;
    barangayMap.set(m.barangay, row);
  }
  const aidedByBarangay = new Map<string, Set<string>>();
  for (const e of entries) {
    const b = e.member.barangay;
    const set = aidedByBarangay.get(b) ?? new Set<string>();
    set.add(e.memberId);
    aidedByBarangay.set(b, set);
  }
  for (const [b, set] of aidedByBarangay) {
    const row = barangayMap.get(b);
    if (row) row.recipients = set.size;
  }
  const byBarangay = [...barangayMap.values()].sort((a, b) => b.members - a.members || a.barangay.localeCompare(b.barangay));

  const byGender: ReportGenderRow[] = ["MALE", "FEMALE", "OTHER"].map((g) => {
    const entriesHere = entries.filter((e) => e.member.gender === g);
    return {
      gender: g,
      label: labelFor(g),
      members: members.filter((m) => m.gender === g).length,
      recipients: new Set(entriesHere.map((e) => e.memberId)).size,
      amount: entriesHere.reduce((sum, e) => sum + Number(e.amount ?? 0), 0),
    };
  });

  const typeMap = new Map<string, ReportTypeRow>();
  for (const e of entries) {
    const row = typeMap.get(e.type) ?? { type: e.type, entries: 0, amount: 0 };
    row.entries += 1;
    row.amount += Number(e.amount ?? 0);
    typeMap.set(e.type, row);
  }
  const byType = [...typeMap.values()].sort((a, b) => b.entries - a.entries);

  const recipients = new Set(entries.map((e) => e.memberId));
  const genderTotals = {
    members: byGender.reduce((s, r) => s + r.members, 0),
    recipients: byGender.reduce((s, r) => s + r.recipients, 0),
    amount: byGender.reduce((s, r) => s + r.amount, 0),
  };

  return {
    generatedAt: new Date().toISOString(),
    scope,
    totals: {
      members: genderTotals.members,
      organizations: orgs.length,
      entries: entries.length,
      recipients: recipients.size,
      amountTotal: Math.round(genderTotals.amount * 100) / 100,
    },
    byOrg,
    byBarangay,
    byGender: genderTotals.members > 0 ? byGender.filter((g) => g.members > 0) : byGender,
    byType,
  };
}

/* ------------------------------------------------------------------ */
/* GET /summary                                                        */
/* ------------------------------------------------------------------ */
router.get("/summary", requireRole("ADMIN", "PRESIDENT"), async (req, res) => {
  const caller = await requireCaller(req as never);
  if (!caller) return res.status(404).json({ error: "Caller profile not found" });
  const { ids, scope } = await scopeOrgs(caller);
  res.json(await buildSummary(ids, scope));
});

/* ------------------------------------------------------------------ */
/* Exports                                                             */
/* ------------------------------------------------------------------ */

interface MemberExportRow {
  lastName: string;
  firstName: string;
  middleName: string | null;
  gender: string;
  birthdate: Date;
  barangay: string;
  address: string;
  householdId: string | null;
  consentAccepted: boolean;
  orgs: string;
}

async function memberRows(orgIds: string[]): Promise<MemberExportRow[]> {
  const members = await prisma.member.findMany({
    where: orgIds.length ? { memberships: { some: { organizationId: { in: orgIds } } } } : undefined,
    include: {
      memberships: {
        where: orgIds.length ? { organizationId: { in: orgIds } } : undefined,
        include: { organization: { select: { name: true } } },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return members.map((m) => ({
    lastName: m.lastName,
    firstName: m.firstName,
    middleName: m.middleName,
    gender: labelFor(m.gender),
    birthdate: m.birthdate,
    barangay: m.barangay,
    address: m.address,
    householdId: m.householdId,
    consentAccepted: m.consentAccepted,
    orgs: m.memberships.map((x) => x.organization.name).join(", "),
  }));
}

interface LedgerExportRow {
  receivedAt: Date;
  member: string;
  barangay: string;
  org: string;
  type: string;
  items: string | null;
  amount: number | null;
  recordedBy: string;
}

async function ledgerRows(orgIds: string[]): Promise<LedgerExportRow[]> {
  const entries = await prisma.assistance.findMany({
    where: orgIds.length ? { organizationId: { in: orgIds } } : undefined,
    orderBy: { receivedAt: "asc" },
    include: {
      member: { select: { firstName: true, lastName: true, barangay: true } },
      organization: { select: { name: true } },
      recordedBy: { select: { name: true } },
    },
  });
  return entries.map((e) => ({
    receivedAt: e.receivedAt,
    member: `${e.member.lastName}, ${e.member.firstName}`,
    barangay: e.member.barangay,
    org: e.organization.name,
    type: e.type,
    items: e.items,
    amount: e.amount,
    recordedBy: e.recordedBy?.name ?? "system",
  }));
}

const stamp = () => new Date().toISOString().slice(0, 10);

function styleHeader(ws: ExcelJS.Worksheet, colCount: number) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF37474F" } };
  row.alignment = { vertical: "middle" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colCount } };
}

async function xlsxMembers(rows: MemberExportRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Members");
  ws.columns = [
    { header: "Last name", key: "lastName", width: 18 },
    { header: "First name", key: "firstName", width: 16 },
    { header: "Middle name", key: "middleName", width: 14 },
    { header: "Gender", key: "gender", width: 10 },
    { header: "Birthdate", key: "birthdate", width: 12 },
    { header: "Barangay", key: "barangay", width: 14 },
    { header: "Address", key: "address", width: 30 },
    { header: "Household", key: "householdId", width: 18 },
    { header: "Consent (RA 10173)", key: "consentAccepted", width: 16 },
    { header: "Organizations", key: "orgs", width: 34 },
  ];
  for (const r of rows) ws.addRow({ ...r, birthdate: r.birthdate.toISOString().slice(0, 10) });
  ws.getColumn("consentAccepted").numFmt = "@"; // show TRUE/FALSE as text
  styleHeader(ws, 10);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function xlsxLedger(rows: LedgerExportRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Assistance Ledger");
  ws.columns = [
    { header: "Date", key: "receivedAt", width: 12 },
    { header: "Member", key: "member", width: 24 },
    { header: "Barangay", key: "barangay", width: 14 },
    { header: "Organization", key: "org", width: 30 },
    { header: "Type", key: "type", width: 12 },
    { header: "Items", key: "items", width: 28 },
    { header: "Amount (PHP)", key: "amount", width: 14, style: { numFmt: "#,##0.00" } },
    { header: "Recorded by", key: "recordedBy", width: 18 },
  ];
  for (const r of rows) ws.addRow({ ...r, receivedAt: r.receivedAt.toISOString().slice(0, 10) });
  styleHeader(ws, 8);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/* ------------------------------- PDF -------------------------------- */

const makeDoc = () => new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
type PdfDoc = ReturnType<typeof makeDoc>;

function pdfBuffer(build: (doc: ReturnType<typeof makeDoc>) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = makeDoc();
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      build(doc);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

interface Col {
  header: string;
  width: number;
  cell: (r: never) => string;
}

function table(
  doc: ReturnType<typeof makeDoc>,
  cols: Col[],
  rows: unknown[],
  opts: { title?: string; caption?: string } = {},
) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  if (opts.title) {
    doc.moveDown(1).font("Helvetica-Bold").fontSize(12).text(opts.title, left, doc.y);
  }
  if (opts.caption) {
    doc.fontSize(8).fillColor("#555").text(opts.caption, { width: right - left });
  }
  doc.moveDown(0.5);

  const headerY = () => {
    const y = doc.y;
    doc.fillColor("#e0e0e0").rect(left, y, right - left, 18).fill();
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(9);
    let x = left + 4;
    for (const c of cols) {
      doc.text(c.header, x, y + 5, { width: c.width - 8, lineBreak: false });
      x += c.width;
    }
    doc.y = y + 20;
    doc.font("Helvetica").fontSize(9);
  };

  headerY();

  const rowY = (r: unknown) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
      headerY();
    }
    const y = doc.y;
    let x = left + 4;
    doc.fontSize(9);
    for (const c of cols) {
      doc.text(String(c.cell(r as never)), x, y, { width: c.width - 8, lineBreak: false, ellipsis: true });
      x += c.width;
    }
    doc.y = y + 16;
  };
  for (const r of rows) rowY(r);
  doc.moveDown(1);
}

async function pdfMembers(rows: MemberExportRow[]): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.font("Helvetica-Bold").fontSize(16).text("CSO Registry — Member Directory");
    doc.fontSize(9).fillColor("#555").text(`Generated ${new Date().toLocaleString()} · Bacoor City CSO Desk`).fillColor("#000");
    doc.moveDown(1);
    table(
      doc,
      [
        { header: "Last name", width: 95, cell: (r: MemberExportRow) => r.lastName },
        { header: "First name", width: 85, cell: (r: MemberExportRow) => r.firstName },
        { header: "Gender", width: 50, cell: (r: MemberExportRow) => r.gender },
        { header: "Birthdate", width: 68, cell: (r: MemberExportRow) => r.birthdate.toISOString().slice(0, 10) },
        { header: "Barangay", width: 80, cell: (r: MemberExportRow) => r.barangay },
        { header: "Consent", width: 45, cell: (r: MemberExportRow) => (r.consentAccepted ? "Yes" : "NO") },
        { header: "Organizations", width: 135, cell: (r: MemberExportRow) => r.orgs },
      ],
      rows,
      { caption: `${rows.length} member record(s). Data believed confidential under RA 10173 — handle per CSO Desk policy.` },
    );
  });
}

async function pdfLedger(rows: LedgerExportRow[]): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.font("Helvetica-Bold").fontSize(16).text("CSO Registry — Assistance Ledger");
    doc.fontSize(9).fillColor("#555").text(`Generated ${new Date().toLocaleString()} · 30-day window rule per NGO · amounts in PHP`).fillColor("#000");
    doc.moveDown(1);
    table(
      doc,
      [
        { header: "Date", width: 62, cell: (r: LedgerExportRow) => r.receivedAt.toISOString().slice(0, 10) },
        { header: "Member", width: 130, cell: (r: LedgerExportRow) => r.member },
        { header: "Barangay", width: 75, cell: (r: LedgerExportRow) => r.barangay },
        { header: "Organization", width: 150, cell: (r: LedgerExportRow) => r.org },
        { header: "Type", width: 70, cell: (r: LedgerExportRow) => r.type },
        { header: "PHP", width: 63, cell: (r: LedgerExportRow) => (r.amount != null ? r.amount.toFixed(2) : "—") },
      ],
      rows,
      { caption: `${rows.length} ledger entr(ies), oldest first.` },
    );
  });
}

async function pdfSummary(summary: ReportSummary): Promise<Buffer> {
  return pdfBuffer((doc) => {
    doc.font("Helvetica-Bold").fontSize(16).text("CSO Registry — Analytics Summary");
    doc
      .fontSize(9)
      .fillColor("#555")
      .text(`Generated ${new Date().toLocaleString()} · scope: ${summary.scope === "ALL_ORGS" ? "all pilot organizations" : "own organization"} · Bacoor City CSO Desk`)
      .fillColor("#000");
    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(12).text("Totals");
    doc.fontSize(9);
    doc
      .text(`Members: ${summary.totals.members}`)
      .text(`Organizations: ${summary.totals.organizations}`)
      .text(`Assistance entries: ${summary.totals.entries}`)
      .text(`Distinct recipients: ${summary.totals.recipients}`)
      .text(`Total amount: PHP ${summary.totals.amountTotal.toFixed(2)}`);
    doc.moveDown(1);

    table(
      doc,
      [
        { header: "Gender", width: 90, cell: (r: ReportGenderRow) => r.label },
        { header: "Members", width: 90, cell: (r: ReportGenderRow) => String(r.members) },
        { header: "Recipients", width: 90, cell: (r: ReportGenderRow) => String(r.recipients) },
        { header: "PHP", width: 90, cell: (r: ReportGenderRow) => r.amount.toFixed(2) },
      ],
      summary.byGender,
      { title: "GAD breakdown (members, recipients, amounts by gender)" },
    );

    table(
      doc,
      [
        { header: "Organization", width: 220, cell: (r: ReportOrgRow) => r.name },
        { header: "Active", width: 60, cell: (r: ReportOrgRow) => String(r.activeMembers) },
        { header: "Entries", width: 60, cell: (r: ReportOrgRow) => String(r.entries) },
        { header: "Recipients", width: 70, cell: (r: ReportOrgRow) => String(r.recipients) },
        { header: "Allotment", width: 60, cell: (r: ReportOrgRow) => String(r.allotment) },
      ],
      summary.byOrg,
      { title: "By organization" },
    );

    table(
      doc,
      [
        { header: "Barangay", width: 200, cell: (r: ReportBarangayRow) => r.barangay },
        { header: "Members", width: 90, cell: (r: ReportBarangayRow) => String(r.members) },
        { header: "Recipients", width: 90, cell: (r: ReportBarangayRow) => String(r.recipients) },
      ],
      summary.byBarangay,
      { title: "By barangay" },
    );

    table(
      doc,
      [
        { header: "Type", width: 200, cell: (r: ReportTypeRow) => r.type },
        { header: "Entries", width: 90, cell: (r: ReportTypeRow) => String(r.entries) },
        { header: "PHP", width: 90, cell: (r: ReportTypeRow) => r.amount.toFixed(2) },
      ],
      summary.byType,
      { title: "Assistance by type" },
    );
  });
}

/* ------------------------------------------------------------------ */
/* GET /export?kind=members|assistances|summary&format=xlsx|pdf        */
/* ------------------------------------------------------------------ */
router.get("/export", requireRole("ADMIN", "PRESIDENT"), async (req, res) => {
  const caller = await requireCaller(req as never);
  if (!caller) return res.status(404).json({ error: "Caller profile not found" });

  const kind = String(req.query.kind ?? "");
  const format = String(req.query.format ?? "");
  if (!["members", "assistances", "summary"].includes(kind) || !["xlsx", "pdf"].includes(format)) {
    return res.status(400).json({ error: "kind ∈ {members, assistances, summary}; format ∈ {xlsx, pdf} (summary: pdf only)" });
  }
  if (kind === "summary" && format !== "pdf") {
    return res.status(400).json({ error: "summary exports ship as PDF (Excel users: copy the on-screen tables)." });
  }
  if (kind !== "summary" && caller.role !== "ADMIN" && !caller.organizationId) {
    return res.status(403).json({ error: "No organization assigned — ask the CSO Desk." });
  }

  const { ids } = await scopeOrgs(caller);

  if (kind === "members" && format === "xlsx") {
    const buf = await xlsxMembers(await memberRows(ids));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="cso-members-${stamp()}.xlsx"`);
    return res.send(buf);
  }
  if (kind === "assistances" && format === "xlsx") {
    const buf = await xlsxLedger(await ledgerRows(ids));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="cso-ledger-${stamp()}.xlsx"`);
    return res.send(buf);
  }
  if (kind === "members" && format === "pdf") {
    const buf = await pdfMembers(await memberRows(ids));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="cso-members-${stamp()}.pdf"`);
    return res.send(buf);
  }
  if (kind === "assistances" && format === "pdf") {
    const buf = await pdfLedger(await ledgerRows(ids));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="cso-ledger-${stamp()}.pdf"`);
    return res.send(buf);
  }

  // summary pdf
  const { ids: sIds, scope } = await scopeOrgs(caller);
  const summary = await buildSummary(sIds, scope);
  const buf = await pdfSummary(summary);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="cso-summary-${stamp()}.pdf"`);
  return res.send(buf);
});

export default router;