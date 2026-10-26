import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface OrgRef {
  id: string;
  name: string;
}

interface AssistanceRec {
  id: string;
  type: string;
  items?: string | null;
  amount?: number | null;
  receivedAt: string;
  organization: OrgRef;
}

interface MemberProfile {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  birthdate: string;
  gender: string;
  address: string;
  barangay: string;
  householdId?: string | null;
  consentAccepted: boolean;
  memberships: { id: string; status: string; role?: string | null; goodStanding?: string | null; organization: OrgRef }[];
  assistances: AssistanceRec[];
}

export function MemberProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const member = useQuery({
    queryKey: ["member", id],
    queryFn: () => apiFetch<MemberProfile>(`/members/${id}`),
  });

  if (member.isLoading) return null;
  if (member.isError || !member.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Member not found (or outside your scope).</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/members")}>
          ← Back to members
        </Button>
      </div>
    );
  }

  const m = member.data;
  const fullName = `${m.firstName} ${m.middleName ?? ""} ${m.lastName}`.replace(/\s+/g, " ").trim();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(m.birthdate).toLocaleDateString()} · {m.gender} · {m.barangay}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/members")}>
          ← Members
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-medium mb-2">Profile</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Address</dt>
              <dd className="text-right">{m.address}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Barangay</dt>
              <dd>{m.barangay}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Household tag</dt>
              <dd>{m.householdId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">RA 10173 consent</dt>
              <dd>{m.consentAccepted ? "recorded ✓" : "missing"}</dd>
            </div>
          </dl>
        </div>

        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-medium mb-2">Cross-organization memberships</h2>
          <div className="flex flex-wrap gap-2">
            {m.memberships.map((ms) => (
              <span
                key={ms.id}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
              >
                {ms.organization.name}
                <span className="text-muted-foreground">({ms.status})</span>
              </span>
            ))}
            {m.memberships.length === 0 && (
              <span className="text-sm text-muted-foreground">No active memberships.</span>
            )}
          </div>
          {m.memberships.length > 1 && (
            <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Multiple memberships — this is the flag the duplicate check exists to surface.
            </p>
          )}
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-medium mb-2">Assistance history (ayuda ledger)</h2>
        {m.assistances.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No assistance recorded yet — the ledger UI lands in Sprint 3, entries will appear here.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Org</th>
                <th className="py-2">Type</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {m.assistances.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2">{new Date(a.receivedAt).toLocaleDateString()}</td>
                  <td className="py-2">{a.organization.name}</td>
                  <td className="py-2">
                    {a.type}
                    {a.items ? <span className="text-muted-foreground"> — {a.items}</span> : null}
                  </td>
                  <td className="py-2 text-right">{a.amount != null ? `₱${a.amount}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Good-standing clearance workflow arrives in Sprint 5 ·
        <Link to="/members" className="underline"> members list</Link>
      </p>
    </div>
  );
}

export default MemberProfilePage;
