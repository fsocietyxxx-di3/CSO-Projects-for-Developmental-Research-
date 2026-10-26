/**
 * Sprint 2 — the roster register.
 *  · Desktop  : formal register table (uppercase headers, hairline rows)
 *  · Below sm : every row collapses into a record card — thumb-first,
 *               zero horizontal scrolling on phones
 *  · Loading never blanks (skeleton rows), empty states are designed.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GovTable, GovTd, GovTh, TableFoot, TableShell } from "@/components/ui/table";
import { EmptyState, Skeleton } from "@/components/ui/skeleton";

interface OrgRef {
  id: string;
  name: string;
}

interface MemberListItem {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  gender: string;
  barangay: string;
  organizations: OrgRef[];
  assistanceCount: number;
}

interface Me {
  role: "ADMIN" | "PRESIDENT";
}

function fullName(m: MemberListItem) {
  return `${m.lastName}, ${m.firstName}${m.middleName ? ` ${m.middleName}` : ""}`;
}

export function MembersPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<Me>("/me") });
  const orgs = useQuery({
    queryKey: ["organizations"],
    queryFn: () => apiFetch<OrgRef[]>("/organizations"),
  });
  const [q, setQ] = useState("");
  const [orgId, setOrgId] = useState("");

  const members = useQuery({
    queryKey: ["members", q, orgId],
    queryFn: () =>
      apiFetch<MemberListItem[]>(`/members?${new URLSearchParams({
        ...(q ? { q } : {}),
        ...(me.data?.role === "ADMIN" && orgId ? { orgId } : {}),
      })}`),
  });

  const isAdmin = me.data?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-gold-600">Member registry</p>
          <h1 className="mt-1 font-serif text-2xl font-bold md:text-3xl">Members</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "CSO Desk view — every pilot organization's members."
              : "Your organization's members."}
          </p>
        </div>
        <Link to="/members/new">
          <Button size="sm">
            <UserPlus /> Encode member
          </Button>
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name…"
            aria-label="Search members by name"
            className="gov-input w-full pl-9 sm:w-72"
          />
        </div>
        {isAdmin && (
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            aria-label="Filter by organization"
            className="gov-select w-full sm:w-auto"
          >
            <option value="">All organizations</option>
            {orgs.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {members.isError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          Failed to load members — the registry API may be waking up. Use retry on the query.
        </p>
      )}

      {members.isPending && (
        <div className="gov-panel space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      )}

      {members.data && members.data.length === 0 && (
        <div className="gov-panel">
          <EmptyState
            icon={<Users className="size-8" />}
            title="No members on the register"
            hint={isAdmin ? "Encode the first member of the pilot cohort." : "Encode your first member — duplicates are flagged automatically."}
            action={
              <Link to="/members/new">
                <Button size="sm">
                  <UserPlus /> Encode member
                </Button>
              </Link>
            }
          />
        </div>
      )}

      {members.data && members.data.length > 0 && (
        <>
          {/* Desktop — register table */}
          <TableShell className="hidden sm:block">
            <GovTable>
              <thead>
                <tr>
                  <GovTh>Name</GovTh>
                  <GovTh>Barangay</GovTh>
                  <GovTh>Organizations</GovTh>
                  <GovTh right>Assistance entries</GovTh>
                </tr>
              </thead>
              <tbody>
                {members.data.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-gov-50/70">
                    <GovTd>
                      <Link
                        to={`/members/${m.id}`}
                        className="font-medium text-gov-800 underline-offset-4 hover:underline"
                      >
                        {fullName(m)}
                      </Link>
                      <span className="block text-[11px] uppercase tracking-wider text-stone-400">
                        {m.gender}
                      </span>
                    </GovTd>
                    <GovTd>{m.barangay}</GovTd>
                    <GovTd>
                      <span className="flex flex-wrap gap-1">
                        {m.organizations.map((o) => (
                          <Badge key={o.id} variant="outline">
                            {o.name}
                          </Badge>
                        ))}
                      </span>
                    </GovTd>
                    <GovTd right className="font-mono text-sm">
                      {m.assistanceCount}
                    </GovTd>
                  </tr>
                ))}
              </tbody>
            </GovTable>
            <TableFoot total={members.data.length} pageNote={isAdmin ? "desk-wide view" : "org-roster view"} />
          </TableShell>

          {/* Mobile — record cards */}
          <div className="space-y-2.5 sm:hidden">
            {members.data.map((m) => (
              <Link key={m.id} to={`/members/${m.id}`} className="gov-panel block space-y-2 p-4 active:border-gold-500/60">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-serif text-[15px] font-semibold leading-snug text-gov-900">
                    {fullName(m)}
                  </span>
                  <Badge variant="info">{m.assistanceCount} aid</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Barangay {m.barangay}</p>
                <div className="flex flex-wrap gap-1">
                  {m.organizations.map((o) => (
                    <Badge key={o.id} variant="outline">
                      {o.name}
                    </Badge>
                  ))}
                </div>
              </Link>
            ))}
            <p className="text-center text-[11px] uppercase tracking-wide text-stone-400">
              {members.data.length} member{members.data.length === 1 ? "" : "s"} on the register
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default MembersPage;
