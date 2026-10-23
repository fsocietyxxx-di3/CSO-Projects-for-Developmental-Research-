# Supabase Setup — Beginner Walkthrough (CSO Registry)

You'll visit the Supabase dashboard **two times total**: once to create the project, once
to flip a handful of settings. Everything you copy lands in exactly two `.env` files
(`apps/api/.env`, `apps/web/.env`) that are **git-ignored — never commit them**.

---

## Step 0 — Pre-flight (10–30 min)

1. You will create your first admin user via our own API (Step 6), which requires
   `apps/api` to run locally and its `SUPABASE_SERVICE_ROLE_KEY` to be set.
2. Nothing else needs Supabase emails/SMTP — our admin-create route pre-confirms users.

## Step 1 — Create the project

1. Go to <https://supabase.com> → **Sign up with GitHub** (a PH school email works too).
2. On the dashboard, click **New project**.
3. Pick the Organization field you were given (**Singapore** is the closest
   region to the Philippines — lowest latency).
4. **Database Password**: generate a strong one, then save it in your password manager —
   several credentials below embed it.
5. Create and wait ~2 min for the project to boot.

> ⚠️ Free-tier note: projects **pause after ~1 week of inactivity** (restore button in the
> dashboard). Assign a weekly "caregiver" login rotation in your team.

## Step 2 — Project URL + API keys

**Dashboard → Project Settings → API** (or "API Keys" in some layouts). Copy these three:

| In the dashboard | Goes to |
|---|---|
| **Project URL** (`https://<ref>.supabase.co`) | `SUPABASE_URL` in `apps/api/.env` **and** `VITE_SUPABASE_URL` in `apps/web/.env` |
| **anon / public key** | `VITE_SUPABASE_ANON_KEY` in `apps/web/.env` (safe to expose—it's the SPA's public identity) |
| **service_role key** (secret, click to reveal) | `SUPABASE_SERVICE_ROLE_KEY` in `apps/api/.env` **ONLY** — full admin power, never in the SPA or git |

## Step 3 — Database connection string

**Dashboard → Project Settings → Database → Connection string.**

1. Pick **Session Pooler** mode (what we use on Render; it's also IPv4-friendly — Supabase
   direct connections are IPv6-only on the free tier).
2. Copy the URI, replace `[YOUR-PASSWORD]` with the Step-1 password, set the final
   database name to `postgres`.
3. → paste as `DATABASE_URL` in `apps/api/.env`.

Format check — it should look like:
`postgresql://postgres.<ref>:<password>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`

## Step 4 — Verify the JWKS endpoint

Our API verifies login tokens against Supabase's public signing keys. In your browser open:

```
https://<ref>.supabase.co/auth/v1/.well-known/jwks.json
```

If it returns a JSON with `"keys": [...]`, all good — **copy nothing**, the API builds this
URL from `SUPABASE_URL` automatically. (Leave `SUPABASE_JWT_SECRET` blank unless the API
later complains about HS256 tokens on an old project.)

## Step 5 — Disable open sign-up (RA 10173 privacy posture)

**Dashboard → Authentication → Sign In / Providers** (older dashboards: Authentication →
Settings). Find the toggle **"Allow new users to sign up"** → switch it **OFF** → Save.

Why: Presidents must never self-register. The CSO Desk admin creates their accounts
through our API, which is the consent trail the client asked for.

## Step 6 — Create the first ADMIN account

Runs once, locally. From `/root/new` in a terminal:

```bash
# a) make sure apps/api/.env has DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY set,
#    and temporarily: DEV_BYPASS_AUTH=true   ← admin-only local shortcut
npm run dev:api

# b) in a second terminal (adjust email/password/name):
curl -X POST http://localhost:4000/api/v1/admin/users \
  -H "Content-Type: application/json" \
  -d '{"email":"desk.admin@bacoor.gov.ph","password":"ChangeMe#2027","name":"CSO Desk Admin","role":"ADMIN"}'

# c) revert: DEV_BYPASS_AUTH=false in apps/api/.env, restart the dev servers
```

That single call creates the Supabase auth user **with `app_metadata.role = "ADMIN"`**
(what our JWT middleware trusts) + the matching app DB row. Log into the SPA with
those credentials. Later, presidents are created from the **Admin panel in the SPA**.

**Fallback only** (if the route is unavailable): Dashboard → SQL Editor →

```sql
UPDATE auth.users SET raw_app_meta_data = jsonb_set(
  coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', '"ADMIN"'
) WHERE email = 'your-admin@bacoor.gov.ph';
```

Then sign out/in once (existing tokens keep the old claims until refresh).

## Step 7 — Where your data will live

**Dashboard → Table Editor**: after you run `npm run prisma:push -w apps/api`, you'll see
`User, Organization, Member, Membership, Assistance, AuditLog`. Anything there is the same
data Prisma reads/writes. **Don't** enable RLS policies for the API paths — our Express API
is the trust boundary (it holds the service key server-side).

## Final sanity checklist

| Credential | Env var | File | Notes |
|---|---|---|---|
| Project URL | `SUPABASE_URL` | `apps/api/.env` | exact dashboard value |
| Project URL (same) | `VITE_SUPABASE_URL` | `apps/web/.env` | identical URL |
| anon key | `VITE_SUPABASE_ANON_KEY` | `apps/web/.env` | public by design |
| service_role key | `SUPABASE_SERVICE_ROLE_KEY` | `apps/api/.env` | **server-only secret** |
| Session Pooler URI | `DATABASE_URL` | `apps/api/.env` | password replaced in |
| JWKS | — (auto) | — | just `Step 4` browser check |
| Sign-ups off | dashboard toggle | — | Step 5 |
| First ADMIN | API route | — | Step 6, then flip bypass off |

After all green → `npm run prisma:push -w apps/api && npm run prisma:seed -w apps/api`,
start `npm run dev:api` + `npm run dev:web`, and log in at
<http://localhost:5173> with the admin credentials from Step 6.
