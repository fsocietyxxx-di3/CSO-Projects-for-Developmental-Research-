import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {me.data?.role === "ADMIN"
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

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name…"
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm w-64"
        />
        {me.data?.role === "ADMIN" && (
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
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
        <p className="text-sm text-destructive">Failed to load members.</p>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Barangay</th>
              <th className="px-4 py-3 font-medium">Organizations</th>
              <th className="px-4 py-3 font-medium text-right">Assistance entries</th>
            </tr>
          </thead>
          <tbody>
            {members.data?.map((m) => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link to={`/members/${m.id}`} className="font-medium hover:underline">
                    {m.lastName}, {m.firstName}
                    {m.middleName ? ` ${m.middleName}` : ""}
                  </Link>
                </td>
                <td className="px-4 py-3">{m.barangay}</td>
                <td className="px-4 py-3 space-x-1">
                  {m.organizations.map((o) => (
                    <span
                      key={o.id}
                      className="inline-block rounded-full border px-2 py-0.5 text-xs"
                    >
                      {o.name}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-3 text-right">{m.assistanceCount}</td>
              </tr>
            ))}
            {members.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No members yet — encode the first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MembersPage;
