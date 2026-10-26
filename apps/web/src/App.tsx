import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { UserSummary } from "@cso-registry/shared";
import { DashboardPage } from "@/pages/DashboardPage";
import { OrganizationsPage } from "@/pages/OrganizationsPage";
import { LoginPage } from "@/pages/LoginPage";
import { MembersPage } from "@/pages/MembersPage";
import { MemberEncodePage } from "@/pages/MemberEncodePage";
import { MemberProfilePage } from "@/pages/MemberProfilePage";

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
    queryFn: () => apiFetch<Me & UserSummary>("/me"),
    retry: false,
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  const { data: me, isError, isLoading } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = useMutation({
    mutationFn: () => supabase.auth.signOut(),
    onSuccess: () => {
      queryClient.clear();
      navigate("/login");
    },
  });

  if (isLoading || isError) return null; // login gate below decides the real UI

  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="text-sm font-semibold">
            CSO Registry <span className="text-muted-foreground font-normal">· Bacoor CSO Desk</span>
          </Link>
          <nav className="ml-auto flex items-center gap-4 text-sm">
            <Link to="/" className="text-muted-foreground hover:text-foreground">Dashboard</Link>
            <Link to="/members" className="text-muted-foreground hover:text-foreground">Members</Link>
            <Link to="/organizations" className="text-muted-foreground hover:text-foreground">Organizations</Link>
            <span className="text-muted-foreground">{me?.email}</span>
            <Button variant="ghost" size="icon" title="Sign out" onClick={() => signOut.mutate()}>
              <LogOut />
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export default function App() {
  const me = useMe();

  if (me.isLoading) return null;

  const authed = !me.isError && !!me.data;

  return (
    <Routes>
      <Route
        path="/login"
        element={!authed ? <LoginPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="*"
        element={
          authed ? (
            <Shell>
              <Routes>
                <Route index element={<DashboardPage />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="members/new" element={<MemberEncodePage />} />
                <Route path="members/:id" element={<MemberProfilePage />} />
                <Route path="organizations" element={<OrganizationsPage />} />
                <Route path="*" element={<div className="text-muted-foreground">404 — page not found</div>} />
              </Routes>
            </Shell>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
