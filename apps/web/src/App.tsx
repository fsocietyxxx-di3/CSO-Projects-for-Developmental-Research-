/**
 * Official application chrome (Batch 1) + session truth (D0):
 *  - sign-in is honest AND instant: the session is optimistically seeded from
 *    the JWT (app_metadata carries the role) so the dashboard paints right
 *    away while /me re-verifies in the background,
 *  - NEVER a white screen: seal splash while verifying, explicit error card
 *    with Retry when the session truly fails,
 *  - government chrome: utility bar, navy header + seal, formal footer,
 *    mobile drawer.
 */
import { useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, X, RefreshCw, ShieldAlert } from "lucide-react";
import { toast, Toaster } from "sonner";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Seal } from "@/components/gov/seal";
import { DashboardPage } from "@/pages/DashboardPage";
import { OrganizationsPage } from "@/pages/OrganizationsPage";
import { LoginPage } from "@/pages/LoginPage";
import { MembersPage } from "@/pages/MembersPage";
import { MemberEncodePage } from "@/pages/MemberEncodePage";
import { MemberProfilePage } from "@/pages/MemberProfilePage";
import { AssistancesPage } from "@/pages/AssistancesPage";
import { AssistanceRecordPage } from "@/pages/AssistanceRecordPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { AuditPage } from "@/pages/AuditPage";

interface Me {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "PRESIDENT";
  organization?: { id: string; name: string } | null;
}

function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<Me>("/me"),
    retry: false,
  });
}

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/members", label: "Members" },
  { to: "/assistances", label: "Ledger" },
  { to: "/reports", label: "Reports" },
];

/* ----------------------------- session states ---------------------------- */

function Splash({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <Seal className="size-24 animate-pulse" />
      <p className="eyebrow text-stone-500">{label}</p>
    </div>
  );
}

function SessionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="gov-panel w-full max-w-md p-6 text-center space-y-3">
        <Seal className="mx-auto size-16 opacity-80" />
        <h1 className="flex items-center justify-center gap-2 font-serif text-lg font-semibold text-red-800">
          <ShieldAlert className="size-5" /> Session could not be verified
        </h1>
        <p className="text-sm text-muted-foreground">
          {message} — the CSO Desk API may be waking up (free cloud tier). Nothing was lost; press Retry below.
        </p>
        <Button onClick={onRetry} className="w-full sm:w-auto">
          <RefreshCw /> Retry verification
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- the shell ------------------------------- */

function Shell({ children, me }: { children: React.ReactNode; me: Me }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drawer, setDrawer] = useState(false);

  const signOut = useMutation({
    mutationFn: () => supabase.auth.signOut(),
    onSuccess: () => {
      queryClient.clear();
      navigate("/login");
    },
  });

  const isAdmin = me.role === "ADMIN";
  const initials = (me.name || me.email || "?")    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const activeCls = (isActive: boolean) =>
    `rounded px-1 py-0.5 text-sm transition-colors ${isActive ? "text-white font-medium border-b-2 border-gold-500" : "text-white/70 hover:text-white"}`;
  const drawerLinkCls = (isActive: boolean) =>
    `block border-l-2 px-4 py-2.5 text-sm ${isActive ? "border-gold-500 bg-gov-700/60 text-white" : "border-transparent text-white/75 hover:bg-gov-700 hover:text-white"}`;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Utility bar */}
      <div className="bg-gov-950 text-white/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-1">
          <p className="eyebrow text-gold-300">Republic of the Philippines</p>
          <p className="eyebrow hidden sm:block text-white/60">City Government of Bacoor · Civil Society Desk Office</p>
        </div>
      </div>

      {/* Main header */}
      <header className="sticky top-0 z-40 border-b-2 border-gold-500 bg-gov-800">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <button
            className="rounded-md p-2 text-white/80 hover:bg-gov-700 md:hidden"
            aria-label="Open navigation menu"
            onClick={() => setDrawer(true)}
          >
            <Menu className="size-5" />
          </button>

          <Link to="/" className="flex items-center gap-3" aria-label="CSO Registry home">
            <Seal className="size-11 shrink-0" />
            <span className="leading-tight">
              <span className="block font-serif text-lg font-bold tracking-wide text-white">CSO REGISTRY</span>
              <span className="block text-[10px] uppercase tracking-[0.22em] text-white/60">
                Member Registry &amp; Assistance System
              </span>
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-5 md:flex" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => activeCls(isActive)}>
                {item.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to="/audit" className={({ isActive }) => activeCls(isActive)}>
                Audit
              </NavLink>
            )}
            <div className="flex items-center gap-2 border-l border-white/15 pl-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold-500 font-semibold text-gov-900">
                {initials}
              </span>
              <span className="hidden lg:block leading-tight">
                <span className="block max-w-[9rem] truncate text-xs font-medium text-white">{me.name}</span>
                <span className="block text-[10px] uppercase tracking-wider text-gold-300">
                  {isAdmin ? "CSO Desk" : me.organization?.name ?? "President"}
                </span>
              </span>
              <button
                onClick={() => signOut.mutate()}
                aria-label="Sign out"
                title="Sign out"
                className="rounded p-2 text-white/70 hover:bg-gov-700 hover:text-white"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </nav>

          <button
            className="ml-auto rounded-md p-2 text-white/80 hover:bg-gov-700 md:hidden"
            aria-label="Sign out"
            onClick={() => signOut.mutate()}
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button aria-label="Close menu" className="absolute inset-0 bg-gov-950/55" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-gov-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="flex items-center gap-2">
                <Seal className="size-8" />
                <span className="font-serif text-sm font-bold text-white">CSO Registry</span>
              </span>
              <button aria-label="Close menu" className="rounded p-2 text-white/70 hover:bg-gov-700" onClick={() => setDrawer(false)}>
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 py-2" aria-label="Mobile">
              <NavLink to="/" end onClick={() => setDrawer(false)} className={({ isActive }) => drawerLinkCls(isActive)}>
                Dashboard
              </NavLink>
              <NavLink to="/members" onClick={() => setDrawer(false)} className={({ isActive }) => drawerLinkCls(isActive)}>
                Members
              </NavLink>
              <NavLink to="/assistances" onClick={() => setDrawer(false)} className={({ isActive }) => drawerLinkCls(isActive)}>
                Ledger
              </NavLink>
              <NavLink to="/reports" onClick={() => setDrawer(false)} className={({ isActive }) => drawerLinkCls(isActive)}>
                Reports
              </NavLink>
              {isAdmin && (
                <NavLink to="/audit" onClick={() => setDrawer(false)} className={({ isActive }) => drawerLinkCls(isActive)}>
                  Audit
                </NavLink>
              )}
              <NavLink to="/organizations" onClick={() => setDrawer(false)} className={({ isActive }) => drawerLinkCls(isActive)}>
                Organizations
              </NavLink>
            </nav>
            <div className="border-t border-white/10 px-4 py-3">
              <p className="text-xs text-white/70">{me.email}</p>
              <p className="eyebrow mt-1 text-gold-300">{isAdmin ? "CSO Desk" : me.organization?.name ?? "President"}</p>
            </div>
          </aside>
        </div>
      )}

      {/* Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>

      {/* Formal footer */}
      <footer className="border-t-2 border-gold-500 bg-gov-900 text-white/70">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 pb-8 md:flex md:items-center md:justify-between md:space-y-0">
          <div>
            <p className="font-serif text-sm font-semibold text-white">Civil Society Desk Office — City of Bacoor</p>
            <p className="text-xs">
              CSO Registry · Management &amp; Member Registry System · Official pilot platform for registered CSOs under the City Government.
            </p>
          </div>
          <div className="flex flex-col gap-1 text-xs md:items-end">
            <span>RA 10173 — consent-based record keeping</span>
            <span>Contact: csodesk@bacoor.gov.ph · © 2026</span>
            <span className="text-white/40">Build {import.meta.env.VITE_BUILD_HINT ?? "pilot"}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* --------------------------------- app ---------------------------------- */

export default function App() {
  const me = useMe();

  if (me.isPending) return <Splash label="Verifying your session with the CSO Desk…" />;

  const authed = !me.isError && !!me.data;

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        <Route path="/login" element={!authed ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route
          path="*"
          element={
            authed && me.data ? (
              <Shell me={me.data}>
                <Routes>
                  <Route index element={<DashboardPage />} />
                  <Route path="members" element={<MembersPage />} />
                  <Route path="members/new" element={<MemberEncodePage />} />
                  <Route path="members/:id" element={<MemberProfilePage />} />
                  <Route path="assistances" element={<AssistancesPage />} />
                  <Route path="assistances/new" element={<AssistanceRecordPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="audit" element={<AuditPage />} />
                  <Route path="organizations" element={<OrganizationsPage />} />
                  <Route path="*" element={<EmptyRoute />} />
                </Routes>
              </Shell>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </>
  );
}

function EmptyRoute() {
  return <p className="text-muted-foreground">404 — page not found</p>;
}
