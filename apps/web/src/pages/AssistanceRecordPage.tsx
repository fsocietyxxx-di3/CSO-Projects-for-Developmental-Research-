/**
 * Sprint 3 — record one assistance entry. The form itself carries the
 * duplicate-awareness: member picker shows prior entries inline, blocked
 * attempts surface the 30-day window / allotment-cap messages verbatim.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, HandHeart, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormActionBar } from "@/components/ui/action-bar";

interface Me {
  role: "ADMIN" | "PRESIDENT";
  organization?: { id: string; name: string } | null;
}

interface OrgRef {
  id: string;
  name: string;
}

interface MemberListItem {
  id: string;
  firstName: string;
  lastName: string;
  barangay: string;
  organizations: OrgRef[];
  assistanceCount: number;
}

const COMMON_TYPES = ["AYUDA", "MEDICAL", "BURIAL", "EDUCATION", "FOOD PACK", "LIVELIHOOD"];

function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="gov-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AssistanceRecordPage() {
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<Me>("/me") });
  const orgs = useQuery({ queryKey: ["organizations"], queryFn: () => apiFetch<OrgRef[]>("/organizations") });

  const isAdmin = me.data?.role === "ADMIN";
  const pinnedOrgId = me.data?.organization?.id ?? null;

  const [orgId, setOrgId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [type, setType] = useState("AYUDA");
  const [items, setItems] = useState("");
  const [amount, setAmount] = useState("");
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [override, setOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repeatNotice, setRepeatNotice] = useState<string | null>(null);

  const effectiveOrgId = isAdmin ? orgId : pinnedOrgId;

  const members = useQuery({
    queryKey: ["members", effectiveOrgId],
    queryFn: () => apiFetch<MemberListItem[]>(`/members?orgId=${effectiveOrgId}`),
    enabled: !!effectiveOrgId,
  });

  const orgMembers = (members.data ?? []).filter((m) =>
    m.organizations?.some((o) => o.id === effectiveOrgId),
  );
  const chosen = orgMembers.find((m) => m.id === memberId);

  async function submit() {
    setError(null);
    setRepeatNotice(null);
    if (!effectiveOrgId) return setError("Select the organization first.");
    if (!memberId) return setError("Select the member who received.");
    if (!type.trim()) return setError("Assistance type is required.");

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        memberId,
        type: type.trim(),
        receivedAt: `${receivedAt}T12:00:00+08:00`,
      };
      if (isAdmin) body.organizationId = effectiveOrgId;
      if (items.trim()) body.items = items.trim();
      if (amount !== "" && !Number.isNaN(Number(amount))) body.amount = Number(amount);
      if (override) body.override = true;

      const data = await apiFetch<{ repeat?: boolean } | undefined>("/assistances", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (data?.repeat) {
        setRepeatNotice(
          "Recorded — but this member is a REPEAT receiver (2nd+ entry from this org). The ledger flags audited repeats like this one.",
        );
        toast.warning("Repeat receiver on record", {
          description: "The ledger will badge this entry as a repeat. Record stands.",
        });
        setSubmitting(false);
        return;
      }
      toast.success("Entry recorded", {
        description: "One entry today is what makes the next duplicate attempt get stopped by the window guard.",
      });
      navigate("/assistances");
    } catch (e) {
      setError((e as Error).message);
      toast.error("Entry not recorded", { description: (e as Error).message });
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="eyebrow text-gold-600">Ayuda ledger · new entry</p>
        <h1 className="mt-1 font-serif text-2xl font-bold md:text-3xl">Record assistance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One entry today is what makes the <em>next</em> duplicate attempt get stopped by the window guard.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="gov-panel space-y-5 p-5 sm:p-6"
      >
        {/* Scope */}
        <fieldset className="space-y-4">
          <legend className="eyebrow text-gold-600">Assistance details</legend>
          {isAdmin ? (
            <Field label="Organization *" htmlFor="org">
              <select
                id="org"
                className="gov-select"
                value={orgId}
                onChange={(e) => {
                  setOrgId(e.target.value);
                  setMemberId("");
                }}
              >
                <option value="">Select organization…</option>
                {orgs.data?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <p className="text-sm text-muted-foreground">
              Recording for{" "}
              <span className="font-medium text-gov-900">{me.data?.organization?.name ?? "—"}</span>.
            </p>
          )}

          <div className="space-y-1">
            <Field label="Member who received *" htmlFor="member">
              <select
                id="member"
                className="gov-select"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                disabled={!effectiveOrgId}
              >
                <option value="">{effectiveOrgId ? "Select member…" : "Choose an organization first"}</option>
                {orgMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.lastName}, {m.firstName} — {m.barangay}
                    {m.assistanceCount > 0 ? ` (${m.assistanceCount} prior)` : ""}
                  </option>
                ))}
              </select>
            </Field>
            {chosen && chosen.assistanceCount > 0 && (
              <p className="flex items-start gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800" role="status">
                <Repeat2 className="mt-0.5 size-3.5 shrink-0" />
                This member already received {chosen.assistanceCount} entr
                {chosen.assistanceCount === 1 ? "y" : "ies"} across all orgs — recording is still your call,
                but the system will flag it.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type *" htmlFor="type">
              <input
                id="type"
                list="common-types"
                className="gov-input"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="AYUDA, MEDICAL…"
                autoComplete="off"
              />
              <datalist id="common-types">
                {COMMON_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
            <Field label="Date received *" htmlFor="receivedAt">
              <input
                id="receivedAt"
                type="date"
                className="gov-input"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Items (optional)" htmlFor="items">
              <input
                id="items"
                className="gov-input"
                value={items}
                onChange={(e) => setItems(e.target.value)}
                placeholder="rice + groceries, meds…"
                autoComplete="off"
              />
            </Field>
            <Field label="Amount, ₱ (optional)" htmlFor="amount">
              <input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                className="gov-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1500"
                inputMode="decimal"
              />
            </Field>
          </div>
        </fieldset>

        {isAdmin && (
          <label className="flex items-start gap-3 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-gov-800"
              checked={override}
              onChange={(e) => setOverride(e.target.checked)}
            />
            <span>
              <span className="font-medium">Allotment override</span>{" "}
              <Badge variant="outline">audited</Badge>{" "}
              — use only if the cap is already exhausted; the Desk reviews every override in the audit trail.
            </span>
          </label>
        )}

        {error && (
          <div
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              {error}
              {error.includes("within the last 30 days") && (
                <span className="mt-1 block text-xs text-red-700/80">
                  This is the window guard doing its job — the same member of this org already received within
                  30 days.
                </span>
              )}
            </div>
          </div>
        )}

        {repeatNotice && (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800" role="status">
            <p className="flex items-start gap-1.5">
              <Repeat2 className="mt-0.5 size-4 shrink-0" /> {repeatNotice}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate("/assistances")}>
                Go to ledger
              </Button>
              {memberId && (
                <Button size="sm" variant="ghost" onClick={() => navigate(`/members/${memberId}`)}>
                  View member
                </Button>
              )}
            </div>
          </div>
        )}

        <FormActionBar>
          <Button type="button" variant="ghost" onClick={() => navigate("/assistances")} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            <HandHeart /> {submitting ? "Recording…" : "Record entry"}
          </Button>
        </FormActionBar>
      </form>
    </div>
  );
}

export default AssistanceRecordPage;
