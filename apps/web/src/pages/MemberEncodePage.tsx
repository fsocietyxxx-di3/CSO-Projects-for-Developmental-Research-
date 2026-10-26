import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  memberInputSchema,
  duplicateCheckInputSchema,
  GENDERS,
  type DuplicateCheckResult,
} from "@cso-registry/shared";
import { z } from "zod";

interface OrgRef {
  id: string;
  name: string;
}

interface Me {
  role: "ADMIN" | "PRESIDENT";
  organization?: { id: string; name: string } | null;
}

// Form schema = member fields + admin's optional org selector ("" becomes undefined).
const formSchema = memberInputSchema.extend({
  organizationId: z.string().uuid().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

const inputCls = "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm";
const labelCls = "text-xs font-medium text-muted-foreground";

export function MemberEncodePage() {
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<Me>("/me") });
  const orgs = useQuery({
    queryKey: ["organizations"],
    queryFn: () => apiFetch<OrgRef[]>("/organizations"),
  });

  const { register, handleSubmit, getValues, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gender: "FEMALE",
      // RHF typing sees the resolved literal (true); runtime starts unchecked.
      consentAccepted: false as unknown as true,
    },
  });

  const [phase, setPhase] = useState<"form" | "checking" | "deciding" | "saving">("form");
  const [hits, setHits] = useState<DuplicateCheckResult["duplicates"]>([]);
  const [error, setError] = useState<string | null>(null);

  const consent = watch("consentAccepted");

  async function onCheckStart() {
    setError(null);
    setPhase("checking");
    const values = getValues();
    try {
      const result = await apiFetch<DuplicateCheckResult>("/members/duplicate-check", {
        method: "POST",
        body: JSON.stringify(duplicateCheckInputSchema.parse(values)),
      });
      setHits(result.duplicates);
      setPhase("deciding");
    } catch (e) {
      setError((e as Error).message);
      setPhase("form");
    }
  }

  async function submitEnroll(existingMemberId?: string) {
    setPhase("saving");
    setError(null);
    const values = getValues();
    const { organizationId, ...memberFields } = values;
    const body: Record<string, unknown> = { ...memberFields };
    if (existingMemberId) body.existingMemberId = existingMemberId;
    if (me.data?.role === "ADMIN" && organizationId) body.organizationId = organizationId;
    try {
      const res = await apiFetch<{ id: string }>("/members", {
        method: "POST",
        body: JSON.stringify(body),
      });
      navigate(`/members/${res.id}`);
    } catch (e) {
      setError((e as Error).message);
      setPhase("deciding");
    }
  }

  const isAdmin = me.data?.role === "ADMIN";
  const chosenOrgId = watch("organizationId");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Encode member</h1>
        <p className="text-sm text-muted-foreground">
          Steps: fill-up → duplicate check → decide. The flag protects ayuda from
          double-receiving and catches family-wide duplicate enrollment.
        </p>
      </div>

      {phase === "form" || phase === "checking" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(onCheckStart)(e as never);
          }}
          className="border rounded-lg p-6 space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className={labelCls} htmlFor="lastName">Last name *</label>
              <input id="lastName" className={inputCls} {...register("lastName")} />
            </div>
            <div className="space-y-1">
              <label className={labelCls} htmlFor="firstName">First name *</label>
              <input id="firstName" className={inputCls} {...register("firstName")} />
            </div>
            <div className="space-y-1">
              <label className={labelCls} htmlFor="middleName">Middle name</label>
              <input id="middleName" className={inputCls} {...register("middleName")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className={labelCls} htmlFor="birthdate">Birthdate *</label>
              <input id="birthdate" type="date" className={inputCls} {...register("birthdate")} />
            </div>
            <div className="space-y-1">
              <label className={labelCls} htmlFor="gender">Gender *</label>
              <select id="gender" className={inputCls} {...register("gender")}>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g === "MALE" ? "Male" : g === "FEMALE" ? "Female" : "Other"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls} htmlFor="barangay">Barangay *</label>
              <input id="barangay" className={inputCls} {...register("barangay")} />
            </div>
          </div>

          <div className="space-y-1">
            <label className={labelCls} htmlFor="address">Address *</label>
            <input id="address" className={inputCls} {...register("address")} />
          </div>

          <div className="space-y-1 max-w-xs">
            <label className={labelCls} htmlFor="householdId">Household tag (optional)</label>
            <input id="householdId" placeholder="e.g. delacruz-mabini14" className={inputCls} {...register("householdId")} />
            <p className="text-xs text-muted-foreground">
              Groups a family — helps catch whole-family duplication like the
              <em> Dela Cruz </em> pattern.
            </p>
          </div>

          {isAdmin && (
            <div className="space-y-1 max-w-xs">
              <label className={labelCls} htmlFor="organizationId">Encode into organization (admin)</label>
              <select id="organizationId" className={inputCls} {...register("organizationId")}>
                <option value="">Select organization…</option>
                {orgs.data?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-start gap-3 border rounded-md p-3 bg-muted/30">
            <input type="checkbox" className="mt-0.5" {...register("consentAccepted")} />
            <span className="text-sm">
              The member consents to their profile being stored in the CSO Registry
              (RA 10173). Required before encoding.
            </span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={formState.isSubmitting || phase === "checking" || !consent}>
            {phase === "checking" ? "Checking duplicates…" : "Run duplicate check →"}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 border rounded-lg p-4 bg-muted/30">
            <ShieldAlert className="size-5 mt-0.5" />
            <div>
              <h2 className="font-medium">Duplicate check complete</h2>
              <p className="text-sm text-muted-foreground">
                {hits.length === 0
                  ? "No matches found in the pilot pool — you can encode this person as new."
                  : `${hits.length} candidate${hits.length > 1 ? "s" : ""} found. Decide for each:`}
              </p>
            </div>
          </div>

          {hits.map((hit) => (
            <div
              key={hit.memberId}
              className="border rounded-lg p-4 space-y-2 border-amber-300/60 bg-amber-50/40"
            >
              <div className="flex items-center gap-2">
                {hit.matchType === "exact" ? (
                  <AlertTriangle className="size-4 text-amber-600" />
                ) : (
                  <AlertTriangle className="size-4 text-muted-foreground" />
                )}
                <span className="font-medium">
                  {hit.fullName} · {hit.barangay}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs border ${
                    hit.matchType === "exact"
                      ? "border-amber-400 text-amber-700 bg-amber-100"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {hit.matchType === "exact" ? "exact (name+birthdate)" : "soft (fuzzy)"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Already in: {hit.organizationNames.join(", ") || "—"}
              </p>
              <Button size="sm" variant="outline" onClick={() => void submitEnroll(hit.memberId)}>
                <CheckCircle2 /> Same person — enroll to my organization
              </Button>
            </div>
          ))}

          <div className="border rounded-lg p-4 space-y-2">
            <p className="text-sm">
              {hits.length > 0
                ? "Not the same person? (e.g., cousins/tsinelas twins — no problem)"
                : "Ready to encode."}
            </p>
            <div className="flex gap-3">
              <Button
                size="sm"
                onClick={() => void submitEnroll()}
                disabled={isAdmin && !chosenOrgId}
                title={isAdmin && !chosenOrgId ? "Select the organization first" : undefined}
              >
                {hits.length > 0 ? "Encode as NEW person" : "Encode"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPhase("form")}>
                ← Back to edit
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {phase === "saving" && <p className="text-sm text-muted-foreground">Saving…</p>}
        </div>
      )}
    </div>
  );
}

export default MemberEncodePage;
