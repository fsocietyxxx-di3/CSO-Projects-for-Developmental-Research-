/**
 * The government portal gate — split screen on desktop, stacked on phones.
 * Session-truth rules:
 *   1. the button honestly reports each phase (never a silent wait),
 *   2. on success the dashboard paints INSTANTLY (optimistic seed from the
 *      Supabase session, JWT app_metadata carries the role) while the real
 *      /me refines in the background,
 *   3. failures surface as explicit error text + toast — no limbo.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Seal } from "@/components/gov/seal";

type Phase = "idle" | "authenticating" | "entering";

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  const busy = phase !== "idle";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("authenticating");
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
        setPhase("idle");
        toast.error("Sign-in failed", { description: authError.message });
        return;
      }

      setPhase("entering");

      // Optimistic seed — role/name live in app_metadata (server-side truth,
      // immutable by users). The real /me re-verify lands in the background.
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (user) {
        const meta = (user.app_metadata ?? {}) as { role?: "ADMIN" | "PRESIDENT"; name?: string };
        queryClient.setQueryData(["me"], {
          id: user.id,
          authId: user.id,
          email: user.email ?? email,
          name: meta.name ?? user.email?.split("@")[0] ?? "User",
          role: meta.role === "ADMIN" ? "ADMIN" : "PRESIDENT",
        });
        void queryClient.refetchQueries({ queryKey: ["me"] });
      }

      toast.success("Signed in", { description: "Welcome back to the CSO Registry." });
      navigate("/", { replace: true });
    } catch (e) {
      setError((e as Error).message || "Network error — check your connection and retry.");
      setPhase("idle");
    }
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      {/* Left — the office (desktop) */}
      <aside className="relative hidden flex-col justify-between bg-gov-900 p-10 lg:flex">
        <div className="flex items-center gap-4">
          <Seal className="size-20" />
          <div>
            <p className="eyebrow text-gold-300">Republic of the Philippines</p>
            <h1 className="mt-1 font-serif text-2xl font-bold text-white">Civil Society Desk Office</h1>
            <p className="text-sm text-white/60">City Government of Bacoor</p>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <p className="border-l-2 border-gold-500 pl-4 font-serif text-xl italic leading-relaxed text-white/90">
            "One registry of civil society — so that every peso of assistance finds the
            right person, only once."
          </p>
          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-start gap-2"><Dot /> Member profiling with duplicate detection (RA 10173)</li>
            <li className="flex items-start gap-2"><Dot /> A 30-day ayuda window guard — double-receiving ends here</li>
            <li className="flex items-start gap-2"><Dot /> Clearances and audited turn-over between organizations</li>
          </ul>
        </div>
        <p className="text-[11px] text-white/40">
          Official platform of the CSO Desk · accounts are provisioned by the Desk admin only.
        </p>
      </aside>

      {/* Right / mobile — the sign-in */}
      <main className="flex flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 text-center lg:hidden">
          <Seal className="mx-auto size-20" />
          <h1 className="mt-3 font-serif text-xl font-bold">CSO Registry</h1>
          <p className="text-sm text-muted-foreground">Civil Society Desk Office — City of Bacoor</p>
        </div>

        <div className="w-full max-w-sm">
          <form onSubmit={onSubmit} className="gov-panel space-y-4 p-6 sm:p-8">
            <div className="hidden lg:block">
              <p className="eyebrow text-gold-600">Restricted access</p>
              <h2 className="mt-1 font-serif text-xl font-semibold">Sign in to continue</h2>
            </div>

            {phase === "entering" ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center" data-testid="entering">
                <Seal className="size-14 animate-pulse" />
                <p className="eyebrow text-stone-500">Preparing your desk…</p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label htmlFor="email" className="gov-label">Email address</label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="username email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@bacoor.gov.ph"
                    className="gov-input"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="password" className="gov-label">Password</label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="gov-input"
                  />
                </div>

                {error && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gov-800 py-2.5 text-sm font-semibold text-white shadow transition-colors hover:bg-gov-700 disabled:opacity-60"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {phase === "authenticating" ? "Signing in…" : "Sign in"}
                </button>
              </>
            )}

            <p className="border-t border-stone-100 pt-3 text-center text-xs text-muted-foreground">
              Accounts are created by the CSO Desk admin only — there is no self sign-up (RA 10173).
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

function Dot() {
  return <span className="mt-1.5 block size-1.5 shrink-0 rounded-full bg-gold-500" />;
}

export default LoginPage;
