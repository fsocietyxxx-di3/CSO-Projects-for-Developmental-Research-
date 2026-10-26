/**
 * Sprint 5 — the audit lens: who did what, since Sprint 1. Admin-only.
 * Desktop registry table / mobile record cards; live filter; refresh.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ScrollText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GovTable, GovTd, GovTh, TableFoot, TableShell } from "@/components/ui/table";
import { EmptyState, Skeleton } from "@/components/ui/skeleton";
import type { AuditEntry } from "@cso-registry/shared";

interface Me {
  role: "ADMIN" | "PRESIDENT";
}

const entityId = (entity: string | null): string =>
  entity?.split(":")[1] ?? "";

const linkFor = (entity: string | null): string | null => {
  if (!entity) return null;
  if (entity.startsWith("Member:")) return `/members/${entityId(entity)}`;
  return null;
};

export function AuditPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<Me>("/me") });
  const [q, setQ] = useState("");

  const audit = useQuery({
    queryKey: ["audit"],
    queryFn: () => apiFetch<AuditEntry[]>("/audit?take=250"),
  });

  if (me.data && me.data.role !== "ADMIN") {
    return (
      <div className="space-y-2">
        <p className="eyebrow text-gold-600">Restricted</p>
        <h1 className="font-serif text-2xl font-bold">Audit trail</h1>
        <div className="gov-panel mt-3 p-5 text-sm text-muted-foreground">
          The audit trail is CSO Desk authority — ask the Desk if you believe a specific
          entry concerns your organization.
        </div>
      </div>
    );
  }

  const rows = (audit.data ?? []).filter((l) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      l.action.toLowerCase().includes(needle) ||
      (l.entity ?? "").toLowerCase().includes(needle) ||
      (l.user?.name ?? "").toLowerCase().includes(needle) ||
      JSON.stringify(l.meta ?? {}).toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow text-gold-600">Chain of custody</p>
        <h1 className="mt-1 font-serif text-2xl font-bold md:text-3xl">Audit trail</h1>
        <p className="text-sm text-muted-foreground">
          Every meaningful action since Sprint 1 — encoding, clearances, turnover, ledger
          writes, overrides (with the override flag in meta).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter action / who / entity / meta…"
          aria-label="Filter audit entries"
          className="gov-input w-full sm:w-80"
        />
        <Button size="sm" variant="outline" onClick={() => void audit.refetch()}>
          <RefreshCw /> Refresh
        </Button>
      </div>

      {audit.isPending && (
        <div className="gov-panel space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      )}

      {audit.data && rows.length === 0 && (
        <div className="gov-panel">
          <EmptyState
            icon={<ScrollText className="size-8" />}
            title={audit.data.length === 0 ? "Audit trail is empty" : "No entries match the filter"}
            hint={
              audit.data.length === 0
                ? "Actions will appear here as the Desk encodes members, records ayuda, and sets clearances."
                : "Loosen the filter — it matches action, actor, entity, and meta JSON."
            }
          />
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Desktop — registry table */}
          <TableShell className="hidden sm:block">
            <GovTable>
              <thead>
                <tr>
                  <GovTh>When</GovTh>
                  <GovTh>Who</GovTh>
                  <GovTh>Action</GovTh>
                  <GovTh>Entity</GovTh>
                  <GovTh>Meta</GovTh>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const href = linkFor(l.entity);
                  return (
                    <tr key={l.id} className="align-top transition-colors hover:bg-gov-50/70">
                      <GovTd className="whitespace-nowrap text-xs text-stone-500">
                        {new Date(l.createdAt).toLocaleString()}
                      </GovTd>
                      <GovTd>
                        {l.user ? (
                          <span>
                            {l.user.name}
                            <span className="block text-xs text-muted-foreground">{l.user.email}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">system/removed</span>
                        )}
                      </GovTd>
                      <GovTd>
                        <Badge variant="outline" className="font-mono normal-case">
                          {l.action}
                        </Badge>
                      </GovTd>
                      <GovTd className="font-mono text-xs">
                        {href ? (
                          <Link to={href} className="text-gov-800 underline-offset-4 hover:underline">
                            {l.entity}
                          </Link>
                        ) : (
                          l.entity ?? "—"
                        )}
                      </GovTd>
                      <GovTd>
                        <code className="break-all text-[11px] text-muted-foreground">
                          {l.meta ? JSON.stringify(l.meta).slice(0, 140) : "—"}
                        </code>
                      </GovTd>
                    </tr>
                  );
                })}
              </tbody>
            </GovTable>
            <TableFoot total={rows.length} pageNote={`latest 250 · admin read model`} />
          </TableShell>

          {/* Mobile — record cards */}
          <div className="space-y-2.5 sm:hidden">
            {rows.map((l) => {
              const href = linkFor(l.entity);
              return (
                <div key={l.id} className="gov-panel space-y-1.5 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="font-mono normal-case">
                      {l.action}
                    </Badge>
                    <span className="whitespace-nowrap text-[11px] text-stone-500">
                      {new Date(l.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium">
                    {l.user?.name ?? <span className="text-muted-foreground">system/removed</span>}
                  </p>
                  {l.entity && (
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {href ? (
                        <Link to={href} className="text-gov-800 underline">
                          {l.entity}
                        </Link>
                      ) : (
                        l.entity
                      )}
                    </p>
                  )}
                  {l.meta && (
                    <code className="line-clamp-2 block break-all text-[11px] text-muted-foreground">
                      {JSON.stringify(l.meta)}
                    </code>
                  )}
                </div>
              );
            })}
            <p className="text-center text-[11px] uppercase tracking-wide text-stone-400">
              {rows.length} entr{rows.length === 1 ? "y" : "ies"} shown
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default AuditPage;
