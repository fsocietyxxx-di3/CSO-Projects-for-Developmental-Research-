import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Undo2, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { STANDING_STATUSES } from "@cso-registry/shared";

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

interface MembershipRow {
  id: string;
  status: string;
  role?: string | null;
  goodStanding?: string | null;
  endedAt?: string | null;
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
  memberships: MembershipRow[];
  assistances: AssistanceRec[];
}

interface Me {
  role: "ADMIN" | "PRESIDENT";
  organization?: { id: string; name: string } | null;
}

const statusCls: Record<string, string> = {
  ACTIVE: "border-emerald-300 text-emerald-700 bg-emerald-50",
  PENDING: "border-amber-300 text-amber-700 bg-amber-50",
  CLEARED: "border-border text-muted-foreground bg-muted/40",
};

const standingCls: Record<string, string> = {
  GOOD_STANDING: "border-emerald-300 text-emerald-700 bg-emerald-50",
  WITH_CASES: "border-red-300 text-red-700 bg-red-50",
  PENDING_CLEARANCE: "border-amber-300 text-amber-700 bg-amber-50",
};

const standingLabel: Record<string, string> = {
  GOOD_STANDING: "good standing ✓",
  WITH_CASES: "with cases ⚠",
  PENDING_CLEARANCE: "clearance pending~",
};

const standingActionLabel: Record<string, string> = {
  GOOD_STANDING: "Good standing",
  WITH_CASES: "With cases",
  PENDING_CLEARANCE: "Clearance pending",
};

export function MemberProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const member = useQuery({
    queryKey: ["member", id],
    queryFn: () => apiFetch<MemberProfile>(`/members/${id}`),
  });
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<Me>("/me") });

  const [note, setNote] = useState<string | null>(null);
  const [clearancePick, setClearancePick] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function act(kind: string, membershipId: string, extra?: Record<string, unknown>) {
    const key = `${kind}-${membershipId}`;
    setBusyKey(key);
    setNote(null);
    try {
      const result = await apiFetch<MembershipRow>(`/memberships/${membershipId}/${kind}`, {
        method: "POST",
        body: JSON.stringify(extra ?? {}),
      });
      setNote(
        `${result.organizationName}: ${kind === "clearance" ? `clearance set → ${standingActionLabel[result.goodStanding ?? ""]}` : kind === "turnover" ? "membership turned over (CLEARED)" : "reactivated to ACTIVE"}`,
      );
      await queryClient.invalidateQueries({ queryKey: ["member", id] });
    } catch (e) {
      setNote(`⚠ ${(e as Error).message}`);
    } finally {
      setBusyKey(null);
    }
  }

  const isAdmin = me.data?.role === "ADMIN";
  const myOrgId = me.data?.organization?.id;

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
          <div className="space-y-2">
            {m.memberships.map((ms) => {
              const mine = isAdmin || ms.organization.id === myOrgId;
              return (
                <div key={ms.id} className="flex flex-wrap items-center gap-1.5 border rounded px-2 py-1.5">
                  <span className="text-sm font-medium">{ms.organization.name}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${statusCls[ms.status] ?? ""}`}>
                    {ms.status}
                  </span>
                  {ms.goodStanding && (
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${standingCls[ms.goodStanding] ?? ""}`}>
                      {standingLabel[ms.goodStanding]}
                    </span>
                  )}
                  {ms.endedAt && (
                    <span className="text-xs text-muted-foreground">
                      ended {new Date(ms.endedAt).toLocaleDateString()}
                    </span>
                  )}
                  {mine && (
                    <span className="ml-auto flex flex-wrap items-center gap-1">
                      {isAdmin && (
                        <>
                          <select
                            value={clearancePick[ms.id] ?? ""}
                            onChange={(e) => setClearancePick((s) => ({ ...s, [ms.id]: e.target.value }))}
                            className="rounded border border-input bg-transparent px-1 py-0.5 text-xs"
                          >
                            <option value="">Set clearance…</option>
                            {STANDING_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {standingActionLabel[s]}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!clearancePick[ms.id] || busyKey === `clearance-${ms.id}`}
                            onClick={() =>
                              void act("clearance", ms.id, { goodStanding: clearancePick[ms.id] })
                            }
                          >
                            <CheckCircle2 className="size-3" /> Set
                          </Button>
                        </>
                      )}
                      {ms.status === "CLEARED" || ms.endedAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyKey === `reactivate-${ms.id}`}
                          onClick={() => void act("reactivate", ms.id)}
                        >
                          <Undo2 className="size-3" /> Reactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyKey === `turnover-${ms.id}`}
                          onClick={() => void act("turnover", ms.id)}
                        >
                          <XCircle className="size-3" /> Turn over
                        </Button>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
            {m.memberships.length === 0 && (
              <span className="text-sm text-muted-foreground">No active memberships.</span>
            )}
          </div>
          {m.memberships.length > 1 && (
            <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Multiple memberships — this is the flag the duplicate check exists to surface.
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Clearance is named by the CSO Desk (verified standing); turnover/reactivation is
            the organization's own roster call. Both land in the audit trail.
          </p>
        </div>
      </div>

      {note && (
        <p className="text-sm border rounded-md px-3 py-2 bg-muted/30">{note}</p>
      )}

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
        Full audit trail at the CSO Desk's Audit screen ·
        <Link to="/members" className="underline"> members list</Link>
      </p>
    </div>
  );
}

export default MemberProfilePage;
