/**
 * Sprint 2 — encode a member. The form carries the process honestly:
 * fill-up → duplicate check → decide. Flags render through the Badge
 * system; primary actions pin to the thumb on phones (FormActionBar).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronLeft, ShieldAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { FormActionBar } from "@/components/ui/action-bar";
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
      toast.success("Member encoded", { description: "The case file opens below. Duplicate detection stays on." });
      navigate(`/members/${res.id}`);
    } catch (e) {
      setError((e as Error).message);
      setPhase("deciding");
    }
  }

  const isAdmin = me.data?.role === "ADMIN";
  const chosenOrgId = watch("organizationId");
  const working = phase === "checking" || phase === "saving";

  if (phase === "form" || phase === "checking") {
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <p className="eyebrow text-gold-600">Member registry · new case file</p>
          <h1 className="mt-1 font-serif text-2xl font-bold md:text-3xl">Encode member</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <Badge variant="navy">1 · Fill up</Badge>
            <Badge variant="outline">2 · Duplicate check</Badge>
            <Badge variant="outline">3 · Decide</Badge>
            <span className="pl-1">The flag protects ayuda from double-receiving.</span>
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(onCheckStart)(e as never);
          }}
          className="gov-panel space-y-5 p-5 sm:p-6"
        >
          {/* Person */}
          <fieldset className="space-y-4">
            <legend className="eyebrow text-gold-600">Person</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Last name *" htmlFor="lastName">
                <input id="lastName" className="gov-input" autoComplete="off" {...register("lastName")} />
              </Field>
              <Field label="First name *" htmlFor="firstName">
                <input id="firstName" className="gov-input" autoComplete="off" {...register("firstName")} />
              </Field>
              <Field label="Middle name" htmlFor="middleName">
                <input id="middleName" className="gov-input" autoComplete="off" {...register("middleName")} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Birthdate *" htmlFor="birthdate">
                <input id="birthdate" type="date" className="gov-input" {...register("birthdate")} />
              </Field>
              <Field label="Gender *" htmlFor="gender">
                <select id="gender" className="gov-select" {...register("gender")}>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g === "MALE" ? "Male" : g === "FEMALE" ? "Female" : "Other"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Barangay *" htmlFor="barangay">
                <input id="barangay" className="gov-input" autoComplete="off" {...register("barangay")} />
              </Field>
            </div>

            <Field label="Address *" htmlFor="address">
              <input id="address" className="gov-input" autoComplete="off" {...register("address")} />
            </Field>

            <Field
              label="Household tag (optional)"
              htmlFor="householdId"
              hint="Groups a family — helps catch whole-family duplication like the Dela Cruz pattern."
            >
              <input
                id="householdId"
                placeholder="e.g. delacruz-mabini14"
                className="gov-input"
                autoComplete="off"
                {...register("householdId")}
              />
            </Field>
          </fieldset>

          {/* Enrollment */}
          <fieldset className="space-y-4 border-t border-stone-200 pt-4">
            <legend className="eyebrow text-gold-600">Enrollment</legend>
            {isAdmin ? (
              <Field label="Encode into organization" htmlFor="organizationId">
                <select id="organizationId" className="gov-select" {...register("organizationId")}>
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
                This member will be encoded into{" "}
                <span className="font-medium text-gov-900">{me.data?.organization?.name ?? "your organization"}</span>.
              </p>
            )}

            <label className="flex items-start gap-3 rounded-md border border-gov-100 bg-gov-50 p-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-gov-800"
                {...register("consentAccepted")}
              />
              <span className="text-sm">
                <span className="font-medium">RA 10173 consent.</span> The member consents to their
                profile being stored in the CSO Registry. Required before encoding.
              </span>
            </label>
          </fieldset>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}

          <FormActionBar>
            <Button type="submit" disabled={working || !consent}>
              {phase === "checking" ? "Checking duplicates…" : "Run duplicate check →"}
            </Button>
          </FormActionBar>
        </form>
      </div>
    );
  }

  // Phase: deciding / saving
  return (
    <div className="max-w-3xl space-y-4 sm:space-y-5">
      <div>
        <p className="eyebrow text-gold-600">Step 3 · Decision</p>
        <h1 className="mt-1 font-serif text-2xl font-bold md:text-3xl">Duplicate check complete</h1>
        <p className="text-sm text-muted-foreground">
          {hits.length === 0
            ? "No matches found in the pilot pool — you can encode this person as new."
            : `${hits.length} candidate${hits.length > 1 ? "s" : ""} found. Decide for each, or confirm a new person.`}
        </p>
      </div>

      {hits.map((hit) => (
        <div
          key={hit.memberId}
          className="gov-panel space-y-3 border-amber-300/70 bg-amber-50/40 p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className={`size-4 ${hit.matchType === "exact" ? "text-amber-600" : "text-stone-400"}`} />
            <span className="font-medium text-gov-900">
              {hit.fullName} · {hit.barangay}
            </span>
            <Badge variant={hit.matchType === "exact" ? statusBadgeVariant.exact : "outline"}>
              {hit.matchType === "exact" ? "exact · name+birthdate" : "soft · fuzzy"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Already in: {hit.organizationNames.join(", ") || "—"}
          </p>
          <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => void submitEnroll(hit.memberId)}>
            <CheckCircle2 /> Same person — enroll to my organization
          </Button>
        </div>
      ))}

      <div className="gov-panel space-y-2 p-4">
        <p className="text-sm">
          {hits.length > 0 ? "Not the same person? (e.g., cousins — no problem)" : "Ready to encode."}
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {phase === "saving" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldAlert className="size-4" /> Saving the case file…
        </p>
      )}

      <FormActionBar>
        <Button variant="ghost" onClick={() => setPhase("form")} disabled={phase === "saving"}>
          <ChevronLeft /> Back to edit
        </Button>
        <Button
          onClick={() => void submitEnroll()}
          disabled={phase === "saving" || (isAdmin && !chosenOrgId)}
          title={isAdmin && !chosenOrgId ? "Select the organization first" : undefined}
        >
          <UserPlus /> {hits.length > 0 ? "Encode as NEW person" : "Encode"}
        </Button>
      </FormActionBar>
    </div>
  );
}

export default MemberEncodePage;
