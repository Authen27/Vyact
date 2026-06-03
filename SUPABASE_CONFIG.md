# Vyact × Supabase Configuration Checklist

> **Status (2026-06-01):** Aligned with the authoritative deploy flow in [`DEPLOY.md`](DEPLOY.md). Supabase client config (URL + publishable key) is **committed** in `react/.env.production` and `admin/.env.production`. The Supabase dashboard items below are still required and must be configured per environment.
>
> Supabase project: https://supabase.com/dashboard/project/dmxqkvploojokffuhxnz

## How this fits with DEPLOY.md

| Setting | Lives in | Owner |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | committed in `react/.env.production` and `admin/.env.production` | repo |
| Auth providers, redirect URLs, CORS, RLS, project keys | Supabase dashboard | Supabase admin |
| `SUPABASE_*` deploy secrets for `db-migrations` | GitHub Actions secrets | repo admin |

Never put the `service_role` key in a frontend env file or in the repo.

## 1. API configuration

Supabase dashboard → Settings → API

- [ ] Confirm **Project URL** matches `https://dmxqkvploojokffuhxnz.supabase.co`
- [ ] Confirm the **publishable** key matches the one committed in `react/.env.production` and `admin/.env.production`
- [ ] Do NOT distribute the `service_role` key

## 2. CORS configuration

Supabase dashboard → Settings → API → CORS

Allow the live production hosts and local dev:

- [ ] `https://vyact-twentyx.vercel.app`
- [ ] `https://vyact-admin.vercel.app`
- [ ] `http://localhost:5173`
- [ ] `http://localhost:5174`

Symptom of a missing entry: 403 / CORS errors in browser devtools.

## 3. Auth providers

Supabase dashboard → Authentication → Providers

- [ ] Email/Password enabled
- [ ] Google provider configured per the human step in [`docs/handoff-plans/todo.yaml`](docs/handoff-plans/todo.yaml) (`google_sso_provider_config`)

## 4. Auth redirect URLs

Supabase dashboard → Authentication → URL Configuration

- [ ] Site URL: `https://vyact-twentyx.vercel.app`
- [ ] Redirect URLs (one per line):
  - `https://vyact-twentyx.vercel.app/auth/verified`
  - `https://vyact-twentyx.vercel.app/auth/reset-password`
  - `https://vyact-admin.vercel.app/auth/verified`
  - `http://localhost:5173/auth/verified`
  - `http://localhost:5173/auth/reset-password`

Symptom of a missing entry: `Invalid redirect_uri` or a post-login redirect loop.

## 5. Database schema

Schema source of truth is `supabase/migrations/`. See [`db/MIGRATIONS.md`](db/MIGRATIONS.md) and [`OPERATIONS.md`](OPERATIONS.md).

- [ ] CI deploy job `db-migrations` runs `supabase db push --include-all` on every push to `main`
- [ ] For fresh environments, apply migrations in order with the Supabase MCP `apply_migration` tool

Expected core tables include: `profiles`, `households`, `memberships`, `transactions`, `budgets`, `goals`, `debts`, `assets`, `exchange_rates`, `activity_log`, `admin_roles`, `content_items`, `subscriptions`.

Verify in SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

## 6. Row Level Security

Symptom: 403 in the browser when the user is signed in.

- [ ] Confirm policies exist for the core tables:

```sql
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

- [ ] If a signed-in user sees no data, confirm they are present in `memberships` for at least one household
- [ ] After any DDL, run Supabase advisors (security and performance) and fix new warnings before release

## 7. GitHub Actions secrets

Required for the `db-migrations` job in `.github/workflows/deploy.yml`:

- [ ] `SUPABASE_ACCESS_TOKEN`
- [ ] `SUPABASE_PROJECT_REF`
- [ ] `SUPABASE_DB_PASSWORD`

The Vercel deploy jobs use `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_CONSUMER_PROJECT_ID`, and `VERCEL_ADMIN_PROJECT_ID`. There are no `VITE_SUPABASE_*` deploy secrets — the values come from the committed `.env.production` files.

## 8. Smoke tests after configuration changes

Local:

```bash
cd react && npm install && npm run dev   # http://localhost:5173
```

Production verification (see [`DEPLOY.md`](DEPLOY.md) § "Verify a deploy actually reached production"):

```bash
JS=$(curl -s https://vyact-twentyx.vercel.app/ | grep -oE '/assets/index-[^" ]+\.js' | head -1)
curl -s "https://vyact-twentyx.vercel.app$JS" | grep -c dmxqkvploojokffuhxnz
```

A count greater than zero means the live bundle is connected to the real Supabase project.

## 9. Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| App loads but shows seeded/dummy data | Build ran in local-only mode | Confirm `react/.env.production` is intact; no empty `VITE_SUPABASE_*` is being injected by CI |
| 403 on API calls | CORS or RLS gap | Recheck §2 and §6 |
| Auth redirect loop or `Invalid redirect_uri` | Missing redirect URL in Supabase | Add the exact URL in §4 |
| Magic link / reset email lands at wrong host | Site URL wrong | Update Site URL in §4 |
| User signs in but sees no household | Not yet a member | Create or join a household, or accept an invitation |

## 10. Reference files

- [`DEPLOY.md`](DEPLOY.md)
- [`OPERATIONS.md`](OPERATIONS.md)
- [`docs/HANDOFF.md`](docs/HANDOFF.md)
- [`db/MIGRATIONS.md`](db/MIGRATIONS.md)
- [`docs/AUTH_HARDENING.md`](docs/AUTH_HARDENING.md)
