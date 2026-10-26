/**
 * Sprint 4 — Reports & Analytics: tiles, breakdown tables (org / barangay /
 * GAD gender / assistance type) and one-click Excel + PDF exports.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { apiBlob, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { ReportSummary } from "@cso-registry/shared";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

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

function useReport() {
  return useQuery({
    queryKey: ["reports-summary"],
    queryFn: () => apiFetch<ReportSummary>("/reports/summary"),
  });
}

export function ReportsPage() {
  const report = useReport();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports & analytics</h1>
        <p className="text-sm text-muted-foreground">
          {r
            ? `${r.scope === "ALL_ORGS" ? "All pilot organizations" : "Your organization"} · generated ${new Date(r.generatedAt).toLocaleString()}`
            : "Loading…"}
        </p>
      </div>

      {/* Tiles */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {[
          { label: "Members", value: r?.totals.members },
          { label: "Organizations", value: r?.totals.organizations },
          { label: "Assistance entries", value: r?.totals.entries },
          { label: "Total amount", value: r != null ? peso(r.totals.amountTotal) : undefined },
        ].map((t) => (
          <div key={t.label} className="border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="text-2xl font-semibold">{t.value ?? "—"}</p>
          </div>
        ))}
      </div>

      {/* Breakdown tables */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-medium mb-2">By organization</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5">Organization</th>
                <th className="py-1.5 text-right">Active</th>
                <th className="py-1.5 text-right">Entries</th>
                <th className="py-1.5 text-right">Recipients</th>
                <th className="py-1.5 text-right">Allotment</th>
              </tr>
            </thead>
            <tbody>
              {r?.byOrg.map((row) => (
                <tr key={row.name} className="border-b last:border-0">
                  <td className="py-1.5">{row.name}</td>
                  <td className="py-1.5 text-right">{row.activeMembers}</td>
                  <td className="py-1.5 text-right">{row.entries}</td>
                  <td className="py-1.5 text-right">{row.recipients}</td>
                  <td className="py-1.5 text-right">{row.allotment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-medium mb-2">GAD breakdown (by gender)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5">Gender</th>
                <th className="py-1.5 text-right">Members</th>
                <th className="py-1.5 text-right">Recipients</th>
                <th className="py-1.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {r?.byGender.map((row) => (
                <tr key={row.gender} className="border-b last:border-0">
                  <td className="py-1.5">{row.label}</td>
                  <td className="py-1.5 text-right">{row.members}</td>
                  <td className="py-1.5 text-right">{row.recipients}</td>
                  <td className="py-1.5 text-right">{peso(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            Gender-disaggregated counts and ayuda amounts — the GAD requirement line your
            client reports on annually.
          </p>
        </div>

        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-medium mb-2">By barangay</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5">Barangay</th>
                <th className="py-1.5 text-right">Members</th>
                <th className="py-1.5 text-right">Recipients</th>
              </tr>
            </thead>
            <tbody>
              {r?.byBarangay.map((row) => (
                <tr key={row.barangay} className="border-b last:border-0">
                  <td className="py-1.5">{row.barangay}</td>
                  <td className="py-1.5 text-right">{row.members}</td>
                  <td className="py-1.5 text-right">{row.recipients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-medium mb-2">Assistance by type</h2>
          {r?.byType.length === 0 && (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5">Type</th>
                <th className="py-1.5 text-right">Entries</th>
                <th className="py-1.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {r?.byType.map((row) => (
                <tr key={row.type} className="border-b last:border-0">
                  <td className="py-1.5">{row.type}</td>
                  <td className="py-1.5 text-right">{row.entries}</td>
                  <td className="py-1.5 text-right">{peso(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exports */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-medium">One-click exports</h2>
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
        {error && <p className="text-sm text-destructive">{error}</p>}
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
