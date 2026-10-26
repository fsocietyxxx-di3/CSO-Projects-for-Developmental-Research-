/**
 * Sprint 5 — the audit lens: who did what, since Sprint 1. Admin-only.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Audit trail</h1>
        <p className="text-sm text-muted-foreground">
          The audit trail is CSO Desk authority — ask the Desk if you believe a specific
          entry concerns your organization.
        </p>
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
        <h1 className="text-2xl font-semibold">Audit trail</h1>
        <p className="text-sm text-muted-foreground">
          Every meaningful action since Sprint 1 — encoding, clearances, turnover, ledger
          writes, overrides (with the override flag in meta).
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter action / who / entity / meta…"
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm w-72"
        />
        <Button size="sm" variant="outline" onClick={() => void audit.refetch()}>
          <ScrollText /> Refresh
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Who</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Meta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const href = linkFor(l.entity);
              return (
                <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30 align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    {l.user ? (
                      <span>
                        {l.user.name}
                        <span className="block text-xs text-muted-foreground">{l.user.email}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">system/removed</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{l.action}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {href ? (
                      <Link to={href} className="hover:underline">
                        {l.entity}
                      </Link>
                    ) : (
                      l.entity ?? "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <code className="text-[11px] text-muted-foreground break-all">
                      {l.meta ? JSON.stringify(l.meta).slice(0, 140) : "—"}
                    </code>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {audit.data?.length === 0 ? "Audit trail is empty." : "No entries match the filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Latest 250 entries · admin-only read model</p>
    </div>
  );
}

export default AuditPage;
