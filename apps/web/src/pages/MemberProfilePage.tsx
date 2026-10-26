/**
 * Sprint 2 + 5 — the member case file.
 *  · Profile & cross-organization memberships render through the Badge system
 *  · Roster actions (clearance / turnover / reactivate) install in designed
 *    dialogs — irreversible steps spell out their consequences before the
 *    Desk commits them — with toast feedback, never a silent wait
 *  · Handlers unchanged: POST /memberships/:id/{clearance,turnover,reactivate}
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { ConfirmFooter, Dialog } from "@/components/ui/dialog";
import { EmptyState, Skeleton } from "@/components/ui/skeleton";
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

interface MembershipActionRow extends MembershipRow {
  organizationName: string;
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

const standingActionLabel: Record<string, string> = {
  GOOD_STANDING: "Good standing",
  WITH_CASES: "With cases",
  PENDING_CLEARANCE: "Clearance pending",
};

const standingHint: Record<string, string> = {
  GOOD_STANDING: "Verified clear record — eligible for full engagement and re-engagement elsewhere.",
  WITH_CASES: "Cases on record — flags every other organization that pulls this file.",
  PENDING_CLEARANCE: "Awaiting the Desk's verification — treat as unresolved.",
};

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

export function MemberProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const member = useQuery({
    queryKey: ["member", id],
    queryFn: () => apiFetch<MemberProfile>(`/members/${id}`),
  });
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<Me>("/me") });

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [turnoverFor, setTurnoverFor] = useState<MembershipRow | null>(null);
  const [reactivateFor, setReactivateFor] = useState<MembershipRow | null>(null);
  const [clearanceFor, setClearanceFor] = useState<MembershipRow | null>(null);
  const [clearancePick, setClearancePick] = useState("");

  const act = async (
    kind: string,
    membershipId: string,
    extra?: Record<string, unknown>,
  ): Promise<boolean> => {
    const key = `${kind}-${membershipId}`;
    setBusyKey(key);
    try {
      const result = await apiFetch<MembershipActionRow>(
        `/memberships/${membershipId}/${kind}`,
        { method: "POST", body: JSON.stringify(extra ?? {}) },
      );
      const message =
        kind === "clearance"
          ? `${result.organizationName} — clearance recorded: ${standingActionLabel[result.goodStanding ?? ""] ?? result.goodStanding}`
          : kind === "turnover"
            ? `${result.organizationName} — membership turned over (CLEARED).`
            : `${result.organizationName} — membership reactivated (ACTIVE).`;
      toast.success(
        kind === "clearance" ? "Clearance set" : kind === "turnover" ? "Turned over" : "Reactivated",
        { description: message },
      );
      await queryClient.invalidateQueries({ queryKey: ["member", id] });
      return true;
    } catch (e) {
      toast.error("Action failed", { description: (e as Error).message });
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const isAdmin = me.data?.role === "ADMIN";
  const myOrgId = me.data?.organization?.id;

  if (member.isPending) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-44 w-full rounded-lg" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (member.isError || !member.data) {
    return (
      <div className="max-w-3xl space-y-4">
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          Member not found (or outside your scope).
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/members")}>
          <ArrowLeft /> Back to members
        </Button>
      </div>
    );
  }

  const m = member.data;
  const fullName = `${m.firstName} ${m.middleName ?? ""} ${m.lastName}`.replace(/\s+/g, " ").trim();

  // Gentle defaults when opening the dialogs.
  const openTurnover = (ms: MembershipRow) => setTurnoverFor(ms);
  const openReactivate = (ms: MembershipRow) => setReactivateFor(ms);
  const openClearance = (ms: MembershipRow) => {
    setClearancePick("");
    setClearanceFor(ms);
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Case-file header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-gold-600">Member case file</p>
          <h1 className="mt-1 break-words font-serif text-2xl font-bold md:text-3xl">{fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(m.birthdate).toLocaleDateString()} · {m.gender} · Barangay {m.barangay}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/members")}>
          <ArrowLeft /> Members
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Profile */}
        <div className="gov-panel p-4 sm:p-5">
          <h2 className="eyebrow text-gold-600">Profile</h2>
          <dl className="mt-2 space-y-2 text-sm">
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
              <dd className="font-mono text-xs">{m.householdId ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">RA 10173 consent</dt>
              <dd>
                <Badge variant={m.consentAccepted ? "success" : "danger"}>
                  {m.consentAccepted ? "Recorded" : "Missing"}
                </Badge>
              </dd>
            </div>
          </dl>
        </div>

        {/* Memberships */}
        <div className="gov-panel p-4 sm:p-5">
          <h2 className="eyebrow text-gold-600">Cross-organization memberships</h2>
          <div className="mt-2 space-y-2">
            {m.memberships.map((ms) => {
              const mine = isAdmin || ms.organization.id === myOrgId;
              return (
                <div key={ms.id} className="rounded-md border border-stone-200 bg-stone-50/60 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-gov-900">{ms.organization.name}</span>
                    <Badge variant={statusBadgeVariant[ms.status] ?? "outline"}>{ms.status}</Badge>
                    {ms.goodStanding && (
                      <Badge variant={statusBadgeVariant[ms.goodStanding] ?? "outline"}>
                        {standingActionLabel[ms.goodStanding] ?? ms.goodStanding}
                      </Badge>
                    )}
                    {ms.endedAt && (
                      <span className="text-xs text-muted-foreground">
                        ended {new Date(ms.endedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {mine && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {isAdmin && (
                        <Button size="sm" variant="outline" onClick={() => openClearance(ms)}>
                          <CheckCircle2 className="size-3" /> Set clearance
                        </Button>
                      )}
                      {ms.status === "CLEARED" || ms.endedAt ? (
                        <Button size="sm" variant="outline" onClick={() => openReactivate(ms)}>
                          <Undo2 className="size-3" /> Reactivate
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openTurnover(ms)}>
                          Turn over
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {m.memberships.length === 0 && (
              <p className="text-sm text-muted-foreground">No active memberships.</p>
            )}
          </div>
          {m.memberships.length > 1 && (
            <p className="mt-2 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800" role="status">
              <Badge variant={statusBadgeVariant.soft}>Multiple</Badge>
              This is the exact flag the duplicate check exists to surface.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Clearance is named by the CSO Desk (verified standing); turnover/reactivation is
            the organization's own roster call. Both land in the audit trail.
          </p>
        </div>
      </div>

      {/* Assistance history */}
      <div className="gov-panel p-4 sm:p-5">
        <h2 className="eyebrow text-gold-600">Assistance history</h2>
        {m.assistances.length === 0 ? (
          <EmptyState
            title="No assistance recorded yet"
            hint="Entries appear here the moment an organization records ayuda for this member."
          />
        ) : (
          <>
            {/* Desktop */}
            <table className="mt-2 hidden w-full text-sm sm:table">
              <thead>
                <tr>
                  <th className="border-b border-stone-200 pb-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Date
                  </th>
                  <th className="border-b border-stone-200 pb-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Org
                  </th>
                  <th className="border-b border-stone-200 pb-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Type
                  </th>
                  <th className="border-b border-stone-200 pb-1.5 text-right text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {m.assistances.map((a) => (
                  <tr key={a.id}>
                    <td className="border-b border-stone-100 py-2 whitespace-nowrap text-stone-500">
                      {new Date(a.receivedAt).toLocaleDateString()}
                    </td>
                    <td className="border-b border-stone-100 py-2">{a.organization.name}</td>
                    <td className="border-b border-stone-100 py-2">
                      {a.type}
                      {a.items ? <span className="text-muted-foreground"> — {a.items}</span> : null}
                    </td>
                    <td className="border-b border-stone-100 py-2 text-right font-mono">
                      {a.amount != null ? peso(a.amount) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile */}
            <ul className="mt-2 space-y-2 sm:hidden">
              {m.assistances.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 border-b border-stone-100 pb-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{a.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.receivedAt).toLocaleDateString()} · {a.organization.name}
                      {a.items ? ` — ${a.items}` : ""}
                    </p>
                  </div>
                  <span className="whitespace-nowrap font-mono">
                    {a.amount != null ? peso(a.amount) : "—"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] uppercase tracking-wide text-stone-400 sm:hidden">
              {m.assistances.length} entr{m.assistances.length === 1 ? "y" : "ies"} lifetime
            </p>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Full audit trail at the CSO Desk's Audit screen ·
        <Link to="/members" className="underline"> members list</Link>
      </p>

      {/* -------- Dialogs: the irreversible roster actions -------- */}

      <Dialog
        open={!!turnoverFor}
        onClose={() => setTurnoverFor(null)}
        title="Turn this membership over?"
        destructive
        description={
          turnoverFor
            ? `This ends ${fullName}'s membership in ${turnoverFor.organization.name}.`
            : undefined
        }
        footer={
          <ConfirmFooter
            confirmLabel="Turn over"
            destructive
            pending={!!turnoverFor && busyKey === `turnover-${turnoverFor.id}`}
            onCancel={() => setTurnoverFor(null)}
            onConfirm={() => {
              const ms = turnoverFor;
              if (!ms) return;
              void act("turnover", ms.id).then((ok) => {
                if (ok) setTurnoverFor(null);
              });
            }}
          />
        }
      >
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-stone-700">
          <li>The membership status becomes <Badge variant="neutral">CLEARED</Badge> — dated today.</li>
          <li>The person leaves your roster; their past assistance history stays on the record.</li>
          <li>The action is written to the audit trail under your account.</li>
          <li>The Desk may then issue a named clearance, and the person can be engaged by another registered organization.</li>
        </ul>
      </Dialog>

      <Dialog
        open={!!reactivateFor}
        onClose={() => setReactivateFor(null)}
        title="Reactivate this membership?"
        description={
          reactivateFor
            ? `Returns ${fullName} to the ACTIVE roster of ${reactivateFor.organization.name}.`
            : undefined
        }
        footer={
          <ConfirmFooter
            confirmLabel="Reactivate"
            pending={!!reactivateFor && busyKey === `reactivate-${reactivateFor.id}`}
            onCancel={() => setReactivateFor(null)}
            onConfirm={() => {
              const ms = reactivateFor;
              if (!ms) return;
              void act("reactivate", ms.id).then((ok) => {
                if (ok) setReactivateFor(null);
              });
            }}
          />
        }
      >
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-stone-700">
          <li>Status returns to <Badge variant="success">ACTIVE</Badge> — they are again part of your roster.</li>
          <li>They re-enter the fairness pool for the next assistance batches.</li>
          <li>Recorded in the audit trail under your account.</li>
        </ul>
      </Dialog>

      <Dialog
        open={!!clearanceFor}
        onClose={() => setClearanceFor(null)}
        title="Set the named clearance"
        description={
          clearanceFor
            ? `The Desk's verified standing for ${fullName} in ${clearanceFor.organization.name}.`
            : undefined
        }
        footer={
          <ConfirmFooter
            confirmLabel={clearancePick ? `Set: ${standingActionLabel[clearancePick]}` : "Set clearance"}
            disable={!clearancePick}
            pending={!!clearanceFor && busyKey === `clearance-${clearanceFor.id}`}
            onCancel={() => setClearanceFor(null)}
            onConfirm={() => {
              const ms = clearanceFor;
              if (!ms || !clearancePick) return;
              void act("clearance", ms.id, { goodStanding: clearancePick }).then((ok) => {
                if (ok) setClearanceFor(null);
              });
            }}
          />
        }
      >
        <div className="space-y-1">
          <label htmlFor="clearance-pick" className="gov-label">
            Verified standing
          </label>
          <select
            id="clearance-pick"
            value={clearancePick}
            onChange={(e) => setClearancePick(e.target.value)}
            className="gov-select w-full"
          >
            <option value="">Choose standing…</option>
            {STANDING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {standingActionLabel[s]}
              </option>
            ))}
          </select>
        </div>
        {clearancePick && (
          <p className="mt-2 rounded-md bg-gov-50 px-3 py-2 text-xs text-gov-700">
            {standingHint[clearancePick]}
          </p>
        )}
      </Dialog>
    </div>
  );
}

export default MemberProfilePage;
