/**
 * Sprint 3 — the Ayuda Ledger view.
 *  · Per-org allotment snapshots with the visual Meter + repeat flags
 *  · Fair-rotation batch suggestion
 *  · Desktop ledger table / mobile record cards
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { HandHeart, Repeat2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { GovTable, GovTd, GovTh, TableFoot, TableShell } from "@/components/ui/table";
import { EmptyState, Meter, Skeleton } from "@/components/ui/skeleton";
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

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

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

  const isAdmin = me.data?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-gold-600">Ayuda ledger</p>
          <h1 className="mt-1 font-serif text-2xl font-bold md:text-3xl">Assistance ledger</h1>
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
      <section>
        <h2 className="eyebrow text-gold-600">Allotments in force</h2>
        <div className="mt-3 grid gap-3 sm:gap-4 sm:grid-cols-2">
          {summary.isPending && (
            <>
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </>
          )}
          {summary.data?.map((s) => (
            <div key={s.organizationId} className="gov-panel space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif text-[15px] font-semibold leading-tight">{s.organizationName}</h3>
                <span className="whitespace-nowrap font-mono text-xs text-stone-500">
                  {s.aidedDistinct}/{s.allotment} slots
                </span>
              </div>
              <Meter value={s.aidedDistinct} max={s.allotment} />
              <p className="text-xs text-muted-foreground">
                {s.entries} entries total · {s.unused} unused slot{s.unused === 1 ? "" : "s"}
              </p>
              {s.repeats.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {s.repeats.map((r) => (
                    <Link key={r.id} to={`/members/${r.id}`} className="transition-transform hover:scale-[1.03]">
                      <Badge variant={statusBadgeVariant.soft}>
                        <Repeat2 className="size-3" /> {r.name} ×{r.times}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBatchOrg((cur) => (cur === s.organizationId ? null : s.organizationId))}
                >
                  {batchOrg === s.organizationId ? "Hide batch" : "Next eligible batch →"}
                </Button>
              </div>
              {batchOrg === s.organizationId && (
                <div className="rounded-md border border-gov-100 bg-gov-50 p-3">
                  {batch.isPending && <p className="text-xs text-muted-foreground">Suggesting…</p>}
                  {batch.data && batch.data.next.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      All ACTIVE members have received — the pool is drained. Perfect rotation proof for the
                      defense demo.
                    </p>
                  )}
                  {batch.data && batch.data.next.length > 0 && (
                    <>
                      <p className="eyebrow mb-2 text-stone-500">
                        Tenure-first suggestion · {batch.data.totalEligible} eligible in pool
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {batch.data.next.map((p, i) => (
                          <Link key={p.id} to={`/members/${p.id}`} className="hover:opacity-80">
                            <Badge variant="navy">{i + 1}. {p.name}</Badge>
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
      </section>

      {isAdmin && (
        <div>
          <label htmlFor="ledger-org" className="gov-label">
            Ledger filter
          </label>
          <select
            id="ledger-org"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="gov-select sm:w-72"
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

      {ledger.isPending && (
        <div className="gov-panel space-y-3 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      )}

      {ledger.data && ledger.data.length === 0 && (
        <div className="gov-panel">
          <EmptyState
            icon={<HandHeart className="size-8" />}
            title="The ledger page is blank"
            hint="No assistance recorded yet — record the first ayuda entry to start the fair-rotation trail."
          />
        </div>
      )}

      {ledger.data && ledger.data.length > 0 && (
        <>
          {/* Desktop — ledger table */}
          <TableShell className="hidden sm:block">
            <GovTable>
              <thead>
                <tr>
                  <GovTh>Date</GovTh>
                  <GovTh>Member</GovTh>
                  <GovTh>Organization</GovTh>
                  <GovTh>Type</GovTh>
                  <GovTh right>Amount</GovTh>
                </tr>
              </thead>
              <tbody>
                {ledger.data.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-gov-50/70">
                    <GovTd className="whitespace-nowrap text-stone-500">
                      {new Date(r.receivedAt).toLocaleDateString()}
                    </GovTd>
                    <GovTd>
                      <Link
                        to={`/members/${r.memberId}`}
                        className="font-medium text-gov-800 underline-offset-4 hover:underline"
                      >
                        {r.member}
                      </Link>
                    </GovTd>
                    <GovTd>{r.organization.name}</GovTd>
                    <GovTd>
                      {r.type}
                      {r.items ? <span className="text-muted-foreground"> — {r.items}</span> : null}
                    </GovTd>
                    <GovTd right className="font-mono text-sm">
                      {r.amount != null ? peso(r.amount) : "—"}
                    </GovTd>
                  </tr>
                ))}
              </tbody>
            </GovTable>
            <TableFoot total={ledger.data.length} pageNote={orgId ? "filtered by org" : "all organizations"} />
          </TableShell>

          {/* Mobile — record cards */}
          <div className="space-y-2.5 sm:hidden">
            {ledger.data.map((r) => (
              <div key={r.id} className="gov-panel space-y-1.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/members/${r.memberId}`} className="font-serif text-[15px] font-semibold text-gov-900">
                    {r.member}
                  </Link>
                  <span className="whitespace-nowrap font-mono text-sm">
                    {r.amount != null ? peso(r.amount) : "—"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.receivedAt).toLocaleDateString()} · {r.organization.name}
                </p>
                <Badge variant={statusBadgeVariant[r.type] ?? "outline"}>{r.type}</Badge>
                {r.items && <p className="text-xs text-muted-foreground">Items: {r.items}</p>}
              </div>
            ))}
            <p className="text-center text-[11px] uppercase tracking-wide text-stone-400">
              {ledger.data.length} entr{ledger.data.length === 1 ? "y" : "ies"} on the ledger
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default AssistancesPage;
