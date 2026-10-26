/**
 * Organizations — the registry's member units. Desktop table / mobile cards;
 * accreditation states render through the formal Badge system. Admin-only
 * creation form kept (same mutation).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GovTable, GovTd, GovTh, TableFoot, TableShell } from "@/components/ui/table";
import { EmptyState, Skeleton } from "@/components/ui/skeleton";
import type { OrganizationSummary } from "@cso-registry/shared";
import { organizationCreateSchema } from "@cso-registry/shared";

interface Me {
  role: "ADMIN" | "PRESIDENT";
}

export function OrganizationsPage() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<Me>("/me") });
  const orgs = useQuery({
    queryKey: ["organizations"],
    queryFn: () => apiFetch<OrganizationSummary[]>("/organizations"),
  });

  const [name, setName] = useState("");
  const [barangay, setBarangay] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createOrg = useMutation({
    mutationFn: (input: unknown) =>
      apiFetch<OrganizationSummary>("/organizations", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setName("");
      setBarangay("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = organizationCreateSchema.safeParse({
      name,
      barangay: barangay || undefined,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues.map((i) => i.message).join("; "));
      return;
    }
    createOrg.mutate(parsed.data);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow text-gold-600">Pilot cohort</p>
        <h1 className="mt-1 font-serif text-2xl font-bold md:text-3xl">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Registered civil society organizations piloting the registry with the CSO Desk.
        </p>
      </div>

      {orgs.isError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          Failed to load organizations (API error) — retry from the menu if it persists.
        </p>
      )}

      {orgs.isPending && (
        <div className="gov-panel space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      )}

      {orgs.data && orgs.data.length === 0 && (
        <div className="gov-panel">
          <EmptyState
            icon={<Building2 className="size-8" />}
            title="No organizations registered yet"
            hint="The Desk admin registers the pilot cohort's organizations here first."
          />
        </div>
      )}

      {orgs.data && orgs.data.length > 0 && (
        <>
          {/* Desktop — registry table */}
          <TableShell className="hidden sm:block">
            <GovTable>
              <thead>
                <tr>
                  <GovTh>Name</GovTh>
                  <GovTh>Barangay</GovTh>
                  <GovTh>Accreditation</GovTh>
                  <GovTh right>Allotment</GovTh>
                  <GovTh right>Active members</GovTh>
                </tr>
              </thead>
              <tbody>
                {orgs.data.map((org) => (
                  <tr key={org.id} className="transition-colors hover:bg-gov-50/70">
                    <GovTd>
                      <span className="font-medium text-gov-900">{org.name}</span>
                      {org.type ? (
                        <span className="block text-[11px] uppercase tracking-wider text-stone-400">
                          {org.type}
                        </span>
                      ) : null}
                    </GovTd>
                    <GovTd>{org.barangay ?? "—"}</GovTd>
                    <GovTd>
                      <Badge variant={statusBadgeVariant[org.accreditationStatus] ?? "outline"}>
                        {org.accreditationStatus}
                      </Badge>
                    </GovTd>
                    <GovTd right className="font-mono text-sm">
                      {org.allotment}
                    </GovTd>
                    <GovTd right className="font-mono text-sm">
                      {org.activeMemberCount}
                    </GovTd>
                  </tr>
                ))}
              </tbody>
            </GovTable>
            <TableFoot total={orgs.data.length} pageNote="pilot cohort" />
          </TableShell>

          {/* Mobile — record cards */}
          <div className="space-y-2.5 sm:hidden">
            {orgs.data.map((org) => (
              <div key={org.id} className="gov-panel space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-serif text-[15px] font-semibold leading-snug text-gov-900">
                    {org.name}
                  </span>
                  <Badge variant={statusBadgeVariant[org.accreditationStatus] ?? "outline"}>
                    {org.accreditationStatus}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Barangay {org.barangay ?? "—"}
                  {org.type ? ` · ${org.type}` : ""}
                </p>
                <div className="flex gap-4 text-xs text-stone-600">
                  <span>
                    Allotment <strong className="font-mono">{org.allotment}</strong>
                  </span>
                  <span>
                    Active members <strong className="font-mono">{org.activeMemberCount}</strong>
                  </span>
                </div>
              </div>
            ))}
            <p className="text-center text-[11px] uppercase tracking-wide text-stone-400">
              {orgs.data.length} organization{orgs.data.length === 1 ? "" : "s"} registered
            </p>
          </div>
        </>
      )}

      {me.data?.role === "ADMIN" && (
        <form onSubmit={onCreate} className="gov-panel max-w-xl space-y-3 p-5 sm:p-6">
          <div>
            <p className="eyebrow text-gold-600">Desk action</p>
            <h2 className="mt-0.5 font-serif text-lg font-semibold">Add organization</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="org-name" className="gov-label">
                Organization name
              </label>
              <input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="gov-input"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="org-barangay" className="gov-label">
                Barangay (optional)
              </label>
              <input
                id="org-barangay"
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                className="gov-input"
                autoComplete="off"
              />
            </div>
          </div>
          {formError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {formError}
            </p>
          )}
          <Button type="submit" size="sm" disabled={createOrg.isPending}>
            {createOrg.isPending ? "Saving…" : "Create organization"}
          </Button>
        </form>
      )}
    </div>
  );
}

export default OrganizationsPage;
