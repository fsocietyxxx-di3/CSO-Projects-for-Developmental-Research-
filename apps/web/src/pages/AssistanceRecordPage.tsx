/**
 * Sprint 3 — record one assistance entry. The form itself carries the
 * duplicate-awareness: member picker shows repeat badges, and blocked
 * attempts surface the 30-day window / allotment-cap messages verbatim.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Repeat2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
const inputCls = "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm";
const labelCls = "text-xs font-medium text-muted-foreground";

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
        setSubmitting(false);
        return;
      }
      navigate("/assistances");
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Record assistance</h1>
        <p className="text-sm text-muted-foreground">
          One entry today is what makes the <em>next</em> duplicate attempt get stopped by the window guard.
        </p>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        {isAdmin ? (
          <div className="space-y-1">
            <label className={labelCls} htmlFor="org">Organization *</label>
            <select
              id="org"
              className={inputCls}
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                setMemberId("");
              }}
            >
              <option value="">Select organization…</option>
              {orgs.data?.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            Organization: <span className="font-medium">{me.data?.organization?.name ?? "—"}</span>
          </div>
        )}

        <div className="space-y-1">
          <label className={labelCls} htmlFor="member">Member who received *</label>
          <select
            id="member"
            className={inputCls}
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            disabled={!effectiveOrgId}
          >
            <option value="">{effectiveOrgId ? "Select member…" : "Choose an organization first"}</option>
            {orgMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.lastName}, {m.firstName} — {m.barangay}
                {m.assistanceCount > 0 ? ` (⚠ ${m.assistanceCount} prior)` : ""}
              </option>
            ))}
          </select>
          {chosen && chosen.assistanceCount > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
              <Repeat2 className="size-3.5" />
              This member already received {chosen.assistanceCount} entr
              {chosen.assistanceCount === 1 ? "y" : "ies"} across all orgs — recording is still your call,
              but the system will flag it.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={labelCls} htmlFor="type">Type *</label>
            <input id="type" list="common-types" className={inputCls} value={type}
              onChange={(e) => setType(e.target.value)} placeholder="AYUDA, MEDICAL…" />
            <datalist id="common-types">
              {COMMON_TYPES.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="space-y-1">
            <label className={labelCls} htmlFor="receivedAt">Date received *</label>
            <input id="receivedAt" type="date" className={inputCls} value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={labelCls} htmlFor="items">Items (optional)</label>
            <input id="items" className={inputCls} value={items} onChange={(e) => setItems(e.target.value)}
              placeholder="rice + groceries, meds…" />
          </div>
          <div className="space-y-1">
            <label className={labelCls} htmlFor="amount">Amount, ₱ (optional)</label>
            <input id="amount" type="number" min="0" step="0.01" className={inputCls} value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="1500" />
          </div>
        </div>

        {isAdmin && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            Allotment override {`(audited — only if the cap is already exhausted)`}
          </label>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              {error}
              {error.includes("within the last 30 days") && (
                <span className="block text-xs mt-1 text-muted-foreground">
                  This is the window guard doing its job — the same member of this org already received within
                  30 days.
                </span>
              )}
            </div>
          </div>
        )}

        {repeatNotice && (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p className="flex items-center gap-1"><Repeat2 className="size-4" /> {repeatNotice}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate("/assistances")}>Go to ledger</Button>
              {memberId && (
                <Button size="sm" variant="ghost" onClick={() => navigate(`/members/${memberId}`)}>
                  View member
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Recording…" : "Record entry"}
          </Button>
          <Button variant="ghost" onClick={() => navigate("/assistances")}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

export default AssistanceRecordPage;
