import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
      <h1 className="text-2xl font-semibold">Organizations</h1>

      {orgs.isError && (
        <p className="text-sm text-destructive">Failed to load organizations (API error).</p>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Barangay</th>
              <th className="px-4 py-3 font-medium">Accreditation</th>
              <th className="px-4 py-3 font-medium text-right">Allotment</th>
              <th className="px-4 py-3 font-medium text-right">Active members</th>
            </tr>
          </thead>
          <tbody>
            {orgs.data?.map((org) => (
              <tr key={org.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  {org.name}
                  {org.type ? <span className="text-muted-foreground"> · {org.type}</span> : null}
                </td>
                <td className="px-4 py-3">{org.barangay ?? "—"}</td>
                <td className="px-4 py-3">{org.accreditationStatus}</td>
                <td className="px-4 py-3 text-right">{org.allotment}</td>
                <td className="px-4 py-3 text-right">{org.activeMemberCount}</td>
              </tr>
            ))}
            {orgs.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No organizations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {me.data?.role === "ADMIN" && (
        <form onSubmit={onCreate} className="border rounded-lg p-6 space-y-3 max-w-xl">
          <h2 className="font-medium">Add organization</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Organization name"
              className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
            <input
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              placeholder="Barangay (optional)"
              className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <Button type="submit" size="sm" disabled={createOrg.isPending}>
            {createOrg.isPending ? "Saving…" : "Create"}
          </Button>
        </form>
      )}
    </div>
  );
}

export default OrganizationsPage;
