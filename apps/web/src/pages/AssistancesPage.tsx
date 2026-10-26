/**
 * Sprint 3 — the Ayuda Ledger view: per-org allotment snapshots (with repeat
 * flags) + fair-rotation batch suggestion + the ledger table itself.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { HandHeart, Repeat2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { AllotmentSummary, NextEligibleResult } from "@cso-registry/shared";

interface Me {
  role: "ADMIN" | "PRESIDENT";
}

interface LedgerRow {
  id: string;
  receivedAt: string;
  type: string;
  items?: string | null;
  amount?: number | null;
  memberId: string;
  member: string;
  barangay: string;
  organization: { id: string; name: string };
}

const pct = (aided: number, allotment: number) =>
  allotment > 0 ? Math.min(100, Math.round((aided / allotment) * 100)) : 0;

export function AssistancesPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<Me>("/me") });
  const summary = useQuery({
    queryKey: ["assistances-summary"],
    queryFn: () => apiFetch<AllotmentSummary[]>("/assistances/summary"),
  });
  const [orgId, setOrgId] = useState("");
  const [batchOrg, setBatchOrg] = useState<string | null>(null);
  const batch = useQuery({
    queryKey: ["next-eligible", batchOrg],
    queryFn: () =>
      apiFetch<NextEligibleResult>(`/assistances/next-eligible?orgId=${batchOrg}&count=10`),
    enabled: !!batchOrg,
  });

  const ledger = useQuery({
    queryKey: ["assistances", orgId],
    queryFn: () =>
      apiFetch<LedgerRow[]>(`/assistances${orgId ? `?orgId=${orgId}` : ""}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Assistance ledger</h1>
          <p className="text-sm text-muted-foreground">
            30-day window guard · per-NGO allotment caps (distinct people) · fair next-batch suggestion.
          </p>
        </div>
        <Link to="/assistances/new">
          <Button size="sm">
            <HandHeart /> Record assistance
          </Button>
        </Link>
      </div>

      {/* Per-org allotment snapshots */}
      <div className="grid gap-4 sm:grid-cols-2">
        {summary.data?.map((s) => (
          <div key={s.organizationId} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium leading-tight">{s.organizationName}</h2>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {s.aidedDistinct}/{s.allotment} slots
              </span>
            </div>
            <div className="h-2 rounded bg-muted overflow-hidden">
              <div
                className={`h-full ${pct(s.aidedDistinct, s.allotment) >= 90 ? "bg-amber-500" : "bg-emerald-600"}`}
                style={{ width: `${pct(s.aidedDistinct, s.allotment)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {s.entries} entries total · {s.unused} unused slot{s.unused === 1 ? "" : "s"}
            </p>
            {s.repeats.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {s.repeats.map((r) => (
                  <Link
                    key={r.id}
                    to={`/members/${r.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:underline"
                  >
                    <Repeat2 className="size-3" /> {r.name} ×{r.times}
                  </Link>
                ))}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBatchOrg((cur) => (cur === s.organizationId ? null : s.organizationId))}
            >
              {batchOrg === s.organizationId ? "Hide batch" : "Next eligible batch →"}
            </Button>
            {batchOrg === s.organizationId && (
              <div className="border rounded p-3 bg-muted/30">
                {batch.isLoading && <p className="text-xs text-muted-foreground">Suggesting…</p>}
                {batch.data && batch.data.next.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    All ACTIVE members have received — the pool is drained. Perfect rotation proof for the
                    defense demo.
                  </p>
                )}
                {batch.data && batch.data.next.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">
                      Tenure-first suggestion · {batch.data.totalEligible} eligible in pool
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {batch.data.next.map((p, i) => (
                        <Link
                          key={p.id}
                          to={`/members/${p.id}`}
                          className="rounded-full border bg-background px-2 py-0.5 text-xs hover:underline"
                        >
                          {i + 1}. {p.name}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {me.data?.role === "ADMIN" && (
        <div>
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          >
            <option value="">All organizations</option>
            {summary.data?.map((s) => (
              <option key={s.organizationId} value={s.organizationId}>
                {s.organizationName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Org</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {ledger.data?.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 whitespace-nowrap">
                  {new Date(r.receivedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link to={`/members/${r.memberId}`} className="font-medium hover:underline">
                    {r.member}
                  </Link>
                </td>
                <td className="px-4 py-3">{r.organization.name}</td>
                <td className="px-4 py-3">
                  {r.type}
                  {r.items ? <span className="text-muted-foreground"> — {r.items}</span> : null}
                </td>
                <td className="px-4 py-3 text-right">{r.amount != null ? `₱${r.amount}` : "—"}</td>
              </tr>
            ))}
            {ledger.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No assistance recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AssistancesPage;
