import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, ShieldAlert, HandHeart, BarChart3, Building2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { OrganizationSummary } from "@cso-registry/shared";

interface Me {
  name: string;
  role: "ADMIN" | "PRESIDENT";
  organization?: { name: string } | null;
}

const MODULES = [
  {
    icon: ShieldAlert,
    title: "Member Profiling & Duplicate Detection",
    sprint: "Sprint 2",
    description:
      "Encode members once — the system flags anyone who already belongs to another organization (exact name+birthdate+barangay match, fuzzy fallback for admin review).",
  },
  {
    icon: HandHeart,
    title: "Assistance Ledger & Allotments",
    sprint: "Sprint 3",
    description:
      "Ayuda history per member, per-NGO allotment tracking, and the next-eligible-batch suggestion so no one receives twice before others receive once.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    sprint: "Sprint 4",
    description:
      "Counts per organization, barangay, and gender (GAD) with one-click PDF/Excel export.",
  },
  {
    icon: Users,
    title: "Good-Standing Clearances",
    sprint: "Sprint 5",
    description:
      "Member transfers between organizations carry a verified clearance status from the previous organization.",
  },
];

export function DashboardPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<Me>("/me") });
  const orgs = useQuery({
    queryKey: ["organizations"],
    queryFn: () => apiFetch<OrganizationSummary[]>("/organizations"),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {me.data?.name ?? "…"}</h1>
        <p className="text-muted-foreground text-sm">
          {me.data?.role === "ADMIN"
            ? "You have full CSO Desk authority."
            : `You are managing ${(me.data?.organization?.name ?? "your organization").toUpperCase()}.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/organizations" className="border rounded-lg p-6 hover:bg-muted transition-colors">
          <Building2 className="size-5 mb-3" />
          <h2 className="font-medium">Organizations</h2>
          <p className="text-sm text-muted-foreground">
            {orgs.data
              ? `${orgs.data.length} registered · live in Sprint 1`
              : "Loading…"}
          </p>
        </Link>
        <Link to="/members" className="border rounded-lg p-6 hover:bg-muted transition-colors">
          <ShieldAlert className="size-5 mb-3" />
          <div className="flex items-center gap-2">
            <h2 className="font-medium">Member Profiling & Duplicate Detection</h2>
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              live — Sprint 2
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Encode members once — the system flags anyone already in another org
            (name+birthdate exact match, fuzzy fallback for admin review).
          </p>
        </Link>
        <Link to="/assistances" className="border rounded-lg p-6 hover:bg-muted transition-colors">
          <HandHeart className="size-5 mb-3" />
          <div className="flex items-center gap-2">
            <h2 className="font-medium">Assistance Ledger & Allotments</h2>
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              live — Sprint 3
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            The anti-"Si Eva" engine: 30-day window guard, per-NGO allotment caps on
            distinct people, and the fair next-batch suggestion.
          </p>
        </Link>
        <Link to="/reports" className="border rounded-lg p-6 hover:bg-muted transition-colors">
          <BarChart3 className="size-5 mb-3" />
          <div className="flex items-center gap-2">
            <h2 className="font-medium">Reports & Analytics</h2>
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              live — Sprint 4
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Org, barangay & GAD breakdowns plus one-click Excel and PDF exports for
            the monthly meeting binder.
          </p>
        </Link>
        {MODULES.filter(
          (mod) =>
            !mod.title.startsWith("Member Profiling") &&
            !mod.title.startsWith("Assistance Ledger") &&
            !mod.title.startsWith("Reports"),
        ).map((m) => (
          <div key={m.title} className="border rounded-lg p-6 opacity-80">
            <m.icon className="size-5 mb-3" />
            <div className="flex items-center gap-2">
              <h2 className="font-medium">{m.title}</h2>
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                {m.sprint}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{m.description}</p>
          </div>
        ))}
      </div>

      <Button variant="outline" disabled>
        Sprint 5 capabilities appear here next — good-standing clearances, audit lens & turnover.
      </Button>
    </div>
  );
}

export default DashboardPage;
