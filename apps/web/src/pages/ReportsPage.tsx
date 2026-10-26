/**
 * Sprint 4 — Reports & Analytics.
 *  · Five institutional charts (recharts, naval palette): per-org grouped
 *    bars, GAD donut, per-barangay bars, assistance-type bars, monthly
 *    ayuda area (+ entries line) derived client-side from `receivedAt`
 *  · The breakdown tables remain (they print; the charts persuade)
 *  · One-click Excel/PDF exports unchanged — scope-aware, self-timestamping
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { apiBlob, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { GovTable, GovTd, GovTh, TableShell } from "@/components/ui/table";
import { EmptyState, Skeleton } from "@/components/ui/skeleton";
import type {
  ReportSummary,
  ReportOrgRow,
  ReportBarangayRow,
  ReportGenderRow,
  ReportTypeRow,
} from "@cso-registry/shared";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

/* ---------------------- institutional chart styling ---------------------- */
const NAVY = "#102A43";
const STEEL = "#2A5079";
const LIGHT_STEEL = "#627D98";
const GOLD = "#C9A227";
const EMERALD = "#047857";
const TYPE_PALETTE = [NAVY, GOLD, STEEL, EMERALD, LIGHT_STEEL, "#B45309"];

const AXIS_TICK = { fontSize: 11, fill: "#78716C" };
const GRID_STROKE = "#E7E5E4";
const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E7E5E4",
    borderRadius: 8,
    boxShadow: "0 4px 14px rgba(16,42,67,0.08)",
    fontSize: 12,
    padding: "8px 10px",
  },
  itemStyle: { color: "#57534E", fontSize: 12 },
  labelStyle: { color: NAVY, fontWeight: 600, fontSize: 12 },
} as const;

const LEGEND_STYLE = { wrapperStyle: { fontSize: 11, color: "#78716C" } } as const;

const pesoTick = (n: number) =>
  n >= 1000 ? `₱${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `₱${n}`;

function ChartPanel({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`gov-panel p-4 sm:p-5 ${className ?? ""}`}>
      <h3 className="eyebrow text-gold-600">{title}</h3>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3 h-64 w-full">{children}</div>
    </div>
  );
}

function saveBlob({ blob, filename }: { blob: Blob; filename: string | null }, fallback: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? fallback;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface LedgerRow {
  id: string;
  receivedAt: string;
  type: string;
  amount?: number | null;
}

export function ReportsPage() {
  const report = useQuery({
    queryKey: ["reports-summary"],
    queryFn: () => apiFetch<ReportSummary>("/reports/summary"),
  });
  /* Monthly trend — derived client-side from the ledger listing (scope-aware). */
  const ledger = useQuery({
    queryKey: ["assistances", ""],
    queryFn: () => apiFetch<LedgerRow[]>("/assistances"),
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(kind: string, format: string, fallback: string) {
    const key = `${kind}-${format}`;
    setBusy(key);
    setError(null);
    try {
      const b = await apiBlob(`/reports/export?kind=${kind}&format=${format}`);
      saveBlob(b, fallback);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const r = report.data;

  const monthly = useMemo(() => {
    const map = new Map<string, { entries: number; amount: number }>();
    for (const e of ledger.data ?? []) {
      const d = new Date(e.receivedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = map.get(key) ?? { entries: 0, amount: 0 };
      cur.entries += 1;
      cur.amount += e.amount ?? 0;
      map.set(key, cur);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        month: new Date(`${key}-01T12:00:00+08:00`).toLocaleDateString("en-PH", {
          month: "short",
          year: "2-digit",
        }),
        entries: v.entries,
        amount: v.amount,
      }));
  }, [ledger.data]);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow text-gold-600">GAD & pilot reporting</p>
        <h1 className="mt-1 font-serif text-2xl font-bold md:text-3xl">Reports &amp; analytics</h1>
        <p className="text-sm text-muted-foreground">
          {r
            ? `${r.scope === "ALL_ORGS" ? "All pilot organizations" : "Your organization"} · generated ${new Date(r.generatedAt).toLocaleString()}`
            : "Loading…"}
        </p>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
        {[
          { label: "Members", value: r?.totals.members },
          { label: "Organizations", value: r?.totals.organizations },
          { label: "Assistance entries", value: r?.totals.entries },
          { label: "Total amount", value: r != null ? peso(r.totals.amountTotal) : undefined },
        ].map((t) => (
          <div key={t.label} className="gov-panel p-4">
            <p className="eyebrow text-stone-400">{t.label}</p>
            <p className="mt-1 text-xl font-semibold sm:text-2xl">{t.value ?? "—"}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Reach by organization" hint="Ledger entries vs distinct recipients — fairness, per unit.">
          {r && r.byOrg.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.byOrg} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={0} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(16,42,67,0.04)" }} />
                <Legend iconType="circle" iconSize={8} {...LEGEND_STYLE} />
                <Bar dataKey="entries" name="Entries" fill={NAVY} radius={[3, 3, 0, 0]} maxBarSize={34} />
                <Bar dataKey="recipients" name="Recipients" fill={GOLD} radius={[3, 3, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          ) : r ? (
            <EmptyState title="No organizations on file yet" />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </ChartPanel>

        <ChartPanel title="GAD breakdown" hint="Members by gender — the annual GAD reporting line.">
          {r && r.byGender.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={r.byGender}
                  dataKey="members"
                  nameKey="label"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  {r.byGender.map((row: ReportGenderRow, i: number) => (
                    <Cell key={row.gender} fill={[NAVY, GOLD, LIGHT_STEEL][i % 3]} />
                  ))}
                </Pie>
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(value, name, item) => {
                    const row = item?.payload as ReportGenderRow | undefined;
                    return [
                      `${value} members · ${row?.recipients ?? 0} recipients`,
                      String(name),
                    ];
                  }}
                />
                <Legend iconType="circle" iconSize={8} {...LEGEND_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : r ? (
            <EmptyState title="No membership data yet" />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </ChartPanel>

        <ChartPanel title="Coverage by barangay" hint="Members on the roster vs those who received ayuda.">
          {r && r.byBarangay.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.byBarangay} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="barangay" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(16,42,67,0.04)" }} />
                <Legend iconType="circle" iconSize={8} {...LEGEND_STYLE} />
                <Bar dataKey="members" name="Members" fill={LIGHT_STEEL} radius={[3, 3, 0, 0]} maxBarSize={42} />
                <Bar dataKey="recipients" name="Recipients" fill={GOLD} radius={[3, 3, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          ) : r ? (
            <EmptyState title="No barangay data yet" />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </ChartPanel>

        <ChartPanel title="Assistance by type" hint="What the pool has been delivering.">
          {r && r.byType.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.byType} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="type" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  cursor={{ fill: "rgba(16,42,67,0.04)" }}
                  formatter={(value, name) => {
                    if (name === "amount") return [peso(Number(value)), "Amount"];
                    return [value, "Entries"];
                  }}
                />
                <Bar
                  dataKey="entries"
                  name="Entries"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={42}
                >
                  {r.byType.map((row: ReportTypeRow, i: number) => (
                    <Cell key={row.type} fill={TYPE_PALETTE[i % TYPE_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : r ? (
            <EmptyState
              title="No entries yet"
              hint="The ledger page is blank — charts fill in as ayuda is recorded."
            />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </ChartPanel>

        <ChartPanel
          title="Monthly ayuda trend"
          hint="Amount disbursed (area) and entries recorded (line), straight from receivedAt."
          className="lg:col-span-2"
        >
          {monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                <YAxis
                  yAxisId="amt"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={pesoTick}
                />
                <YAxis
                  yAxisId="cnt"
                  orientation="right"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: "rgba(16,42,67,0.04)" }} />
                <Legend iconType="circle" iconSize={8} {...LEGEND_STYLE} />
                <Area
                  yAxisId="amt"
                  type="monotone"
                  dataKey="amount"
                  name="Amount (₱)"
                  stroke={NAVY}
                  strokeWidth={2}
                  fill={NAVY}
                  fillOpacity={0.1}
                />
                <Line
                  yAxisId="cnt"
                  type="monotone"
                  dataKey="entries"
                  name="Entries"
                  stroke={GOLD}
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: GOLD }}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : ledger.data ? (
            <EmptyState
              title="No entries yet"
              hint="Record the first ayuda entry and the trend line starts here."
            />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </ChartPanel>
      </div>

      {/* Breakdown tables (kept — they print into the meeting binder) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <TableShell>
          <div className="px-4 pt-3">
            <h2 className="eyebrow text-gold-600">By organization</h2>
          </div>
          <GovTable className="mt-2">
            <thead>
              <tr>
                <GovTh>Organization</GovTh>
                <GovTh right>Active</GovTh>
                <GovTh right>Entries</GovTh>
                <GovTh right>Recipients</GovTh>
                <GovTh right>Allotment</GovTh>
              </tr>
            </thead>
            <tbody>
              {r?.byOrg.map((row: ReportOrgRow) => (
                <tr key={row.name} className="transition-colors hover:bg-gov-50/70">
                  <GovTd>{row.name}</GovTd>
                  <GovTd right className="font-mono text-sm">{row.activeMembers}</GovTd>
                  <GovTd right className="font-mono text-sm">{row.entries}</GovTd>
                  <GovTd right className="font-mono text-sm">{row.recipients}</GovTd>
                  <GovTd right className="font-mono text-sm">{row.allotment}</GovTd>
                </tr>
              ))}
            </tbody>
          </GovTable>
          <div className="h-2" />
        </TableShell>

        <TableShell>
          <div className="px-4 pt-3">
            <h2 className="eyebrow text-gold-600">GAD breakdown (by gender)</h2>
          </div>
          <GovTable className="mt-2">
            <thead>
              <tr>
                <GovTh>Gender</GovTh>
                <GovTh right>Members</GovTh>
                <GovTh right>Recipients</GovTh>
                <GovTh right>Amount</GovTh>
              </tr>
            </thead>
            <tbody>
              {r?.byGender.map((row: ReportGenderRow) => (
                <tr key={row.gender} className="transition-colors hover:bg-gov-50/70">
                  <GovTd>{row.label}</GovTd>
                  <GovTd right className="font-mono text-sm">{row.members}</GovTd>
                  <GovTd right className="font-mono text-sm">{row.recipients}</GovTd>
                  <GovTd right className="font-mono text-sm">{peso(row.amount)}</GovTd>
                </tr>
              ))}
            </tbody>
          </GovTable>
          <p className="px-4 pb-3 pt-2 text-xs text-muted-foreground">
            Gender-disaggregated counts and ayuda amounts — the GAD requirement line your
            client reports on annually.
          </p>
        </TableShell>

        <TableShell>
          <div className="px-4 pt-3">
            <h2 className="eyebrow text-gold-600">By barangay</h2>
          </div>
          <GovTable className="mt-2">
            <thead>
              <tr>
                <GovTh>Barangay</GovTh>
                <GovTh right>Members</GovTh>
                <GovTh right>Recipients</GovTh>
              </tr>
            </thead>
            <tbody>
              {r?.byBarangay.map((row: ReportBarangayRow) => (
                <tr key={row.barangay} className="transition-colors hover:bg-gov-50/70">
                  <GovTd>{row.barangay}</GovTd>
                  <GovTd right className="font-mono text-sm">{row.members}</GovTd>
                  <GovTd right className="font-mono text-sm">{row.recipients}</GovTd>
                </tr>
              ))}
            </tbody>
          </GovTable>
          <div className="h-2" />
        </TableShell>

        <TableShell>
          <div className="px-4 pt-3">
            <h2 className="eyebrow text-gold-600">Assistance by type</h2>
          </div>
          <GovTable className="mt-2">
            <thead>
              <tr>
                <GovTh>Type</GovTh>
                <GovTh right>Entries</GovTh>
                <GovTh right>Amount</GovTh>
              </tr>
            </thead>
            <tbody>
              {r?.byType.map((row: ReportTypeRow) => (
                <tr key={row.type} className="transition-colors hover:bg-gov-50/70">
                  <GovTd>{row.type}</GovTd>
                  <GovTd right className="font-mono text-sm">{row.entries}</GovTd>
                  <GovTd right className="font-mono text-sm">{peso(row.amount)}</GovTd>
                </tr>
              ))}
            </tbody>
          </GovTable>
          <div className="h-2" />
        </TableShell>
      </div>

      {/* Exports */}
      <div className="gov-panel space-y-3 p-4 sm:p-5">
        <h2 className="eyebrow text-gold-600">One-click exports</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy === "members-xlsx"} onClick={() => void download("members", "xlsx", "cso-members.xlsx")}>
            {busy === "members-xlsx" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Members .xlsx
          </Button>
          <Button size="sm" variant="outline" disabled={busy === "members-pdf"} onClick={() => void download("members", "pdf", "cso-members.pdf")}>
            {busy === "members-pdf" ? <Loader2 className="animate-spin" /> : <FileDown />} Members .pdf
          </Button>
          <Button size="sm" variant="outline" disabled={busy === "assistances-xlsx"} onClick={() => void download("assistances", "xlsx", "cso-ledger.xlsx")}>
            {busy === "assistances-xlsx" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Ledger .xlsx
          </Button>
          <Button size="sm" variant="outline" disabled={busy === "assistances-pdf"} onClick={() => void download("assistances", "pdf", "cso-ledger.pdf")}>
            {busy === "assistances-pdf" ? <Loader2 className="animate-spin" /> : <FileDown />} Ledger .pdf
          </Button>
          <Button size="sm" disabled={busy === "summary-pdf"} onClick={() => void download("summary", "pdf", "cso-summary.pdf")}>
            {busy === "summary-pdf" ? <Loader2 className="animate-spin" /> : <FileDown />} Summary .pdf (all sections)
          </Button>
        </div>
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Exports respect your scope: presidents get their organization's rows only; the
          CSO Desk gets the full pilot pool. PDF exports timestamp themselves for the
          meeting binder.
        </p>
      </div>
    </div>
  );
}

export default ReportsPage;
