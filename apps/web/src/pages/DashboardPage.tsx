/**
 * The desk's landing page — formal greeting, live modules lift into their own
 * quadrant grid ("At a glance"), delayed modules stay honest about scope.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, ShieldAlert, HandHeart, BarChart3, Building2, ArrowRight, ScrollText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Me {
  name: string;
  role: "ADMIN" | "PRESIDENT";
  organization?: { name: string } | null;
}

const liveModules = [
  {
    to: "/members",
    icon: ShieldAlert,
    phase: "Sprint 2",
    title: "Members & Duplicate Detection",
    body: "Encode once — flagged forever if they already serve in another organization.",
  },
  {
    to: "/assistances",
    icon: HandHeart,
    phase: "Sprint 3",
    title: "Assistance Ledger & Allotments",
    body: "30-day window guard, per-NGO allotment, fair next-batch suggestion.",
  },
  {
    to: "/reports",
    icon: BarChart3,
    phase: "Sprint 4",
    title: "Reports & Analytics",
    body: "Org, barangay & GAD breakdowns with one-click Excel / PDF exports.",
  },
  {
    to: "/audit",
    icon: ScrollText,
    phase: "Sprint 5",
    title: "Clearances & Audit",
    body: "Turn members over with named clearance; every action on the record.",
  },
];

const roadmap = [
  { line: "Pilot cohort onboarding — 3 to 5 NGOs", done: false, note: "hand-off letter + manual" },
  { line: "UptimeRobot keep-alive on /health", done: false, note: "stops Render naps" },
  { line: "Weekly Supabase check-in", done: false, note: "paused free tier = the only outage" },
];

export function DashboardPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<Me>("/me") });
  const orgs = useQuery({
    queryKey: ["organizations"],
    queryFn: () =>
      apiFetch<{ id: string; activeMemberCount: number }[]>("/organizations"),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-gold-600">Civil Society Desk · Bacoor City</p>
          <h1 className="mt-1 font-serif text-2xl font-bold md:text-3xl">
            {me.data ? `Welcome, ${me.data.name}` : "Welcome"} {me.data?.role === "ADMIN" ? "— Desk authority" : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {me.data?.role === "ADMIN"
              ? "Full registry access: members, organizations, ledger, reports, audit."
              : `You preside over ${(me.data?.organization?.name ?? "your organization").toUpperCase()} — your members, your ledger.`}
          </p>
        </div>
        <Badge variant="navy" className="hidden sm:inline-flex">Pilot registry · live</Badge>
      </div>

      {/* At a glance (admin gets tallies) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Link to="/organizations" className="gov-panel group p-4 transition-colors hover:border-gold-500/60">
          <Building2 className="mb-3 size-5 text-gov-700" />
          <p className="text-2xl font-semibold">
            {orgs.data ? orgs.data.length : <Skeleton className="h-7 w-10" />}
          </p>
          <p className="text-xs text-muted-foreground">Registered orgs</p>
        </Link>
        <Link to="/members" className="gov-panel group p-4 transition-colors hover:border-gold-500/60">
          <Users className="mb-3 size-5 text-gov-700" />
          <p className="text-2xl font-semibold">—</p>
          <p className="text-xs text-muted-foreground">Members (Members tab)</p>
        </Link>
        <Link to="/assistances/new" className="gov-panel group p-4 transition-colors hover:border-gold-500/60">
          <HandHeart className="mb-3 size-5 text-gold-600" />
          <p className="text-2xl font-semibold">Record</p>
          <p className="text-xs text-muted-foreground">New ayuda entry</p>
        </Link>
        <Link to="/reports" className="gov-panel group p-4 transition-colors hover:border-gold-500/60">
          <BarChart3 className="mb-3 size-5 text-gov-700" />
          <p className="text-2xl font-semibold">GAD</p>
          <p className="text-xs text-muted-foreground">Analytics & exports</p>
        </Link>
      </div>

      {/* Modules */}
      <section>
        <h2 className="eyebrow text-gold-600">System modules</h2>
        <div className="mt-3 grid gap-3 sm:gap-4 sm:grid-cols-2">
          {liveModules.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="gov-panel group flex items-start gap-4 p-5 transition-all hover:border-gold-500/60 hover:shadow-md"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gov-800 text-gold-300">
                <m.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-[15px] font-semibold">{m.title}</h3>
                  <Badge variant="gold">{m.phase}</Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{m.body}</p>
              </div>
              <ArrowRight className="ml-auto size-4 shrink-0 self-center text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gold-600" />
            </Link>
          ))}
        </div>
      </section>

      {/* Housekeeping board — honest about what remains */}
      <section>
        <h2 className="eyebrow text-gold-600">On the desk</h2>
        <div className="gov-panel mt-3 divide-y divide-stone-100">
          {roadmap.map((r) => (
            <div key={r.line} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="size-1.5 rounded-full bg-gold-500" />
              <span className="font-medium">{r.line}</span>
              <Badge variant="outline" className="ml-auto hidden sm:inline-flex">{r.note}</Badge>
            </div>
          ))}
          <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            All five development sprints shipped — duplicate detection · ayuda ledger · reports · clearances.
          </div>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
