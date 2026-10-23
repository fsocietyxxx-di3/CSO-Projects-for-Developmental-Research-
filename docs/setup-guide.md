# Full Setup Timeline — From Zero to Client Deployment (CSO Registry)

This is the chronological story of the whole setup: **what happens, in what order,
and why that order**. Each stage depends on the previous one — nothing can be skipped.

```
ORDER: accounts → local dev → cloud deploy → real users
  Stage 1   accounts (GitHub → Supabase → Vercel → Render)
  Stage 2   local development (code runs on YOUR PC first)
  Stage 3   Supabase wiring (DB + auth behind the code)
  Stage 4   first cloud deploy ( Render API → Vercel SPA → CORS loop)
  Stage 5   go live with the client (real admin + pilot NGOs)
```

> Squad context: the code in `/root/new` is Sprint-1 complete and verified. Everything
> below is what the TEAM does, in order.

---

## Stage 1 — Create the accounts (day 1, ~1 hour)

You need 4 accounts. Create them in this order — later ones sign in via the earlier ones.

| # | Account | Why now | Sign-up method |
|---|---------|---------|----------------|
| 1 | **GitHub** | the code lives here; everything else pulls from it | github.com → Sign up |
| 2 | **Supabase** | your database + login service | supabase.com → "Sign up with GitHub" ← needs #1 |
| 3 | **Vercel** | hosts the React web app | vercel.com → "Continue with GitHub" ← needs #1 |
| 4 | **Render** | hosts the Express API | render.com → "Sign up with GitHub" ← needs #1 |

While in GitHub: create a repo named `cso-registry` (Private). Don't initialize with a
README (we already have one locally).

---

## Stage 2 — Local development (day 1–2)

Can't deploy a system you haven't run locally — this stage surfaces 90% of bugs for free.

### 2.1 Install the tools (one-time, on each dev's PC)
- **Node.js 20 LTS** → nodejs.org (or `winget install OpenJS.NodeJS.LTS`)
- **Git** → git-scm.com
- **VS Code** → code.visualstudio.com (extensions: ESLint, Prettier)

### 2.2 Get the code onto your PC
The scaffold currently lives in the agent sandbox (`/root/new`). Move it into GitHub:

```bash
# in the sandbox, once:
git remote add origin https://github.com/<your-org>/cso-registry.git
git push -u origin main
```

Then on each team PC:
```bash
git clone https://github.com/<your-org>/cso-registry.git
cd cso-registry
npm install          # npm works fine on normal PCs — yarn was only for this sandbox
```

### 2.3 Make your local `.env` files (the two secrets files)
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example  apps/web/.env
```
These stay **uncommitted** (git-ignored). Fill them in Stage 3.

### 2.4 Boot it
```bash
npm run dev:api     # terminal 1 → http://localhost:4000/api/v1/health
npm run dev:web     # terminal 2 → http://localhost:5173
```
No Supabase yet? You can already smoke-test: set `DEV_BYPASS_AUTH=true` in
`apps/api/.env` — the API fakes an admin login so you can click through the UI.

---

## Stage 3 — Wire Supabase (day 2, following `docs/supabase-setup.md`)

Full click-by-click guide is in **docs/supabase-setup.md**. In one paragraph: create the
project (region **Singapore**, save the DB password), copy 5 credentials (URL, anon key,
service_role, Session Pooler URI + password) into the two `.env` files, turn OFF
"Allow new users to sign up", verify the JWKS URL opens in a browser, then run:

```bash
npm run prisma:push -w apps/api   # creates the 6 tables in Supabase (Table Editor shows them)
npm run prisma:seed -w apps/api   # demo orgs + planted duplicates
```

Create the first ADMIN account (one-time, Step 6 of the doc):
`DEV_BYPASS_AUTH=true` → `npm run dev:api` → curl `POST /api/v1/admin/users` with
`role:"ADMIN"` → flip bypass back off. Then log into localhost:5173 as admin.

**Checkpoint: the system works locally end-to-end** (login, orgs table, admin panel).
Don't proceed to deploy until this is true.

---

## Stage 4 — First cloud deploy (day 2–3)

Now "localhost" becomes "a URL the client can reach". Order matters:
**API first (Render), then web (Vercel), then connect them (CORS).**

### 4.1 Render — the API
1. render.com → **New Blueprint Instance** → pick your GitHub repo → Render reads
   `render.yaml` and creates the service for you.
2. It will ask for the `sync:false` variables — paste the same values from
   `apps/api/.env` (DATABASE_URL pooler string, SUPABASE_URL, SERVICE_ROLE key…).
3. Wait for the deploy → green light. Verify: open
   `https://<your-api>.onrender.com/api/v1/health` → `{"ok":true}`.

### 4.2 Vercel — the web app
1. vercel.com → Add New → **Project** → import the same repo.
2. Critical setting: **Root Directory = `apps/web`** (the repo is a monorepo).
3. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_API_URL=https://<your-api>.onrender.com/api/v1`.
4. Deploy → you get a URL like `cso-registry.vercel.app`.

### 4.3 Connect them — CORS (the loop that bites everyone)
First visit to the Vercel URL will cryptically fail: the API rejects unknown origins.

1. Copy your Vercel URL(s).
2. Render Dashboard → cso-registry-api → Environment → edit
   `CORS_ORIGINS=http://localhost:5173,https://<your-vercel>.vercel.app`
   (comma-separated, no slash at the end).
3. Render auto-redeploys → try the site again. Log in with the admin account from Stage 3.

### 4.4 Keep-alive
- UptimeRobot (free account) → monitor → `https://<your-api>.onrender.com/api/v1/health`
  every 5 min → Render never sleeps during office hours.
- Supabase free projects pause after ~1 week idle → rotate a weekly login.

**Checkpoint: `https://<vercel-url>` opens from your PHONE, you can log in, org list
loads.** That's the system "in production" — Sprint 1 complete in the real sense.

---

## Stage 5 — Go live with the client (after Sprint 2–3 features land)

1. Create the client's real admin: SPA admin panel → create user for the CSO Desk
   Officer (email + role ADMIN). Bypass never again in production.
2. Create the 3–5 **president accounts** (role PRESIDENT + their organization).
   Honest password ceremony: hand the password to the president personally.
3. Presidents encode members from **their own guild** (consent model). Data flows to the
   CSO Desk dashboard automatically.
4. Run the seed migration for each pilot org from their Excel (Sprint 5 tooling —
   duplicate check runs on import, which is a great client moment: "your spreadsheet
   already contains 12 duplicates").
5. Weekly ops habit: `npm run db:backup -w apps/api` (dump script) — free tier has no
   auto backups.

---

## Why the order is what it is (dependency chain)

```
GitHub          ← everything deploys FROM here (code)
   │
Supabase        ← Stage 3 fills .env secrets   (DB must exist before cloud, else deploys fail at runtime)
   │
Render API      ← Stage 4.1 needs the GitHub code + Supabase creds
   │
Vercel SPA      ← Stage 4.2 needs a live API URL to fill VITE_API_URL
   │
CORS + Uptime   ← Stage 4.3/4.4: only meaningful when both exist
   │
Client users    ← Stage 5: only once the site is stable at a real URL
```

Rule of thumb you can give your teammates: **"Accounts → Local → Deploy → Users."**
You NEVER skip local — deploying an app you've never seen running is how you
waste client patience during demos.
