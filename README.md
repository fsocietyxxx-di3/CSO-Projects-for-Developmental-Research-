# CSO Registry — CSO Management & Member Registry System

Capstone system for the **Civil Society Desk Office, City of Bacoor** — replaces scattered
Excel member lists with a registry where **CSO presidents encode their own members**
(RA 10173-friendly) while the **CSO Desk holds admin authority**. Core safeguards:
duplicate-membership detection, an assistance (ayuda) ledger with per-NGO allotments,
and one-click GAD/analytics reports.

> Full build plan: `/root/.opencode/plan/cso-registry-system-plan.md`

## Stack

| Layer | Tech |
|---|---|
| SPA | React 18 + TypeScript + Vite + TanStack Query + React Hook Form (Sprint 2 forms) + Zod + Recharts (Sprint 4) |
| UI | Tailwind CSS v4 + shadcn/ui (`components.json` ready — add more via `npx shadcn@latest add …`) |
| API | Node 20 + Express 5 + TypeScript |
| DB | Prisma + PostgreSQL (Supabase free tier) |
| Auth | Supabase Auth issues JWT (no self sign-up) → API verifies via JWKS + enforces RBAC |
| Deploy | Frontend: Vercel · API: Render (free) · keep-alive: UptimeRobot |

## Structure

```
apps/web        React SPA (+ proxy to API in dev)
apps/api        Express REST API · Prisma schema · seed with planted duplicates
packages/shared Zod contract shared by both apps (single source of truth)
render.yaml     Render Blueprint for the API
```

## Local setup

```bash
# 1) install everything (npm workspaces)
npm install

# 2) create .env files
cp apps/api/.env.example apps/api/.env      # fill from Supabase (checklist below)
cp apps/web/.env.example apps/web/.env      # fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY

# 3) push schema + seed demo data (fabricated people with planted duplicates)
npm run prisma:push -w apps/api
npm run prisma:seed -w apps/api
chmod +x apps/api/scripts/db-dump.sh        # weekly backup helper

# 4) run it — two terminals
npm run dev:api     # http://localhost:4000  (health: /api/v1/health)
npm run dev:web     # http://localhost:5173  (Vite proxies /api → :4000)
```

**No Supabase yet?** Set `DEV_BYPASS_AUTH=true` in `apps/api/.env` — the API injects a
fake ADMIN user locally so you can hit endpoints. Never in production.

## Supabase checklist (one-time)

1. Create project (region: **Singapore**).
2. → Settings → API: copy **Project URL**, **anon key** (→ `apps/web/.env`), **service_role**
   key (→ `apps/api/.env` SUPABASE_SERVICE_ROLE_KEY), **JWT secret** (only if legacy HS256).
3. → Database → Connection string: **Session pooler** URI → `apps/api/.env DATABASE_URL`.
4. → Authentication → Providers: leave Email on, **disable sign-ups**
   (Turn off "Allow new users to sign up" in Auth settings).
5. Verify JWKS exists: `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`.
6. First ADMIN account: follow **`docs/supabase-setup.md` Step 6** — a one-time
   `POST /api/v1/admin/users` call with `DEV_BYPASS_AUTH=true` (it also explains the
   SQL fallback). Presidents are then created from the SPA admin panel.

## Deploy checklist

**Render (API)** — Dashboard → Blueprints → New → connect repo (uses root `render.yaml`),
then fill the `sync:false` env vars. Health check: `/api/v1/health`.

**Vercel (SPA)** — Import repo → Root Directory = **`apps/web`** → add env vars
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (Render URL + `/api/v1`).
SPA rewrites come from `apps/web/vercel.json`.

**After deploy:** copy both Vercel domains (prod + previews) into Render's
`CORS_ORIGINS` (comma-separated, no trailing slashes).

**Ops:** UptimeRobot ping on `/api/v1/health` (keeps Render warm) · Supabase free projects
pause after ~1 week idle (login weekly) · add Render/Supabase URLs to
`apps/api` `.env` before testing admin provisioning.

## Sprint roadmap (equals build order)

1. ✅ **Sprint 1** — scaffold, auth (JWKS/RBAC), org registry, admin provisioning, deploys
2. ⬜ **Sprint 2** — member profiling + duplicate detection/flagging (the heart)
3. ⬜ **Sprint 3** — assistance ledger + allotments + next-eligible suggestion
4. ⬜ **Sprint 4** — dashboard/analytics + PDF/Excel exports
5. ⬜ **Sprint 5** — good-standing clearance workflow, audit trail, pilot migration, turnover

## Scripts cheat sheet

| Command | Where | What |
|---|---|---|
| `npm run dev:api` / `dev:web` | root | live servers |
| `npm run typecheck` | root | all workspaces |
| `npm run prisma:generate -w apps/api` | root | regenerate client after schema edit |
| `npm run prisma:push -w apps/api` | root | push schema to Supabase |
| `npm run prisma:seed -w apps/api` | root | demo data |
| `npm run db:backup -w apps/api` | root | manual pg_dump into `backups/` (git-ignored) |
