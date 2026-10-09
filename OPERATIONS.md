# Vyact Operations Runbook

Operational guide for schema changes, backups, staging restores, and production deploy verification.

## 1. Scope and ground rules

- Source of truth for database shape: `supabase/migrations/*.sql`
- Generated snapshot for review only: `db/schema.sql`
- Production deploy trigger: push to `main`
- Deploy pipeline: `.github/workflows/deploy.yml`
- Production database project ref: `dmxqkvploojokffuhxnz`

Rules:
- Never edit `db/schema.sql` by hand.
- Never apply destructive schema changes directly in production.
- Run the schema validator before and after any migration change.
- After DDL, run Supabase advisors (`security` and `performance`).

## 2. Migration workflow

### Create or edit a migration

1. Add an additive SQL migration under `supabase/migrations/`.
2. Regenerate the schema snapshot:

```bash
node scripts/db-migrations-check.mjs --fix
```

3. Re-run the validator:

```bash
node scripts/db-migrations-check.mjs
```

4. Review the generated `db/schema.sql` diff.
5. Apply the migration to staging first.
6. Run Supabase advisors after the migration lands.

### CI / production apply path

The deploy workflow runs this as the `db-migrations` job:

```bash
supabase db push --password "$SUPABASE_DB_PASSWORD" --include-all
```

Notes:
- `--include-all` is required because the repo contains a baseline plus later additive migrations.
- The `db-migrations` job **fails loudly** (since v10.20.5): a failed migration is a red Deploy run.
- The apps are deployed by Vercel's git integration, **not** by this workflow, and in parallel with it.
  A live app does not prove the migration was applied. Check the Deploy run as well (DEPLOY.md, W8d).

## 3. Backup before risky changes

Take a database backup before any migration batch, bulk import, or restore rehearsal.

### Plain SQL backup

```bash
pg_dump \
  --dbname "postgresql://postgres:<PASSWORD>@db.dmxqkvploojokffuhxnz.supabase.co:5432/postgres?sslmode=require" \
  --clean \
  --if-exists \
  --no-owner \
  --file "backups/vyact-prod-$(date -u +%Y%m%dT%H%M%SZ).sql"
```

### Custom-format backup

```bash
pg_dump \
  --dbname "postgresql://postgres:<PASSWORD>@db.dmxqkvploojokffuhxnz.supabase.co:5432/postgres?sslmode=require" \
  --format=custom \
  --no-owner \
  --file "backups/vyact-prod-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Guidance:
- Store backups outside the repo.
- Prefer custom-format backups for restore drills.
- Treat backups as sensitive plaintext unless separately encrypted.
- Never use `--no-privileges` (W8d, audit DB-OPS-12): it drops every GRANT/REVOKE, and the security model depends on the REVOKEs (anon cannot call the SECURITY DEFINER functions). A restore without them is an open database.

## 4. Restore to staging

Never rehearse restores against production. Restore into a staging or disposable Supabase/Postgres target.

### Restore a plain SQL backup

```bash
psql \
  "postgresql://postgres:<PASSWORD>@<STAGING_HOST>:5432/postgres?sslmode=require" \
  --file "backups/<backup-file>.sql"
```

### Restore a custom-format backup

```bash
pg_restore \
  --dbname "postgresql://postgres:<PASSWORD>@<STAGING_HOST>:5432/postgres?sslmode=require" \
  --clean \
  --if-exists \
  --no-owner \
  "backups/<backup-file>.dump"
```

After restore:
- Run `node scripts/db-migrations-check.mjs` in the repo.
- Apply any repo migrations missing from the restored database.
- Smoke-test consumer auth, household loading, admin auth, and one CRUD path per core entity.

## 5. Pre-deploy checklist

Run this before pushing to `main`:

```bash
node scripts/db-migrations-check.mjs --fix
node scripts/db-migrations-check.mjs
node scripts/automation-run.mjs
```

Checklist:
- Migration filenames are valid and `db/schema.sql` is regenerated.
- Consumer and admin quality gates are green.
- Required changelogs and version bumps are updated for the release.
- Production-only config is not being overridden by empty `VITE_SUPABASE_*` shell env vars.
- Any new DDL has had advisor review.
- A current backup exists for risky database changes.

## 6. Post-deploy checklist

Rewritten 9 Oct 2026 (W8d, audit OPS-09). The apps are published by Vercel's git integration, and
`.github/workflows/deploy.yml` runs only `db-migrations` and `deploy-edge-functions`. The old checklist
verified hosts on an orphaned account.

### Confirm the Deploy workflow

- Both jobs in the **Deploy** run on `main` are green: `db-migrations`, then `deploy-edge-functions`.
- If `db-migrations` failed, the release's schema did not ship. Fix it before closing the deploy.

### Confirm the consumer app is live

```bash
curl -s https://vyact.app/version.json
```

Expected result: the version you just released.

Then run the following, which should show the deployment as **Ready**:

```bash
npx vercel ls vyact --prod
```

**Canceled** means the build was skipped because nothing outside docs changed. **Error** means it failed; read it with `npx vercel inspect <url> --logs`.

### Confirm admin production is live

- Open `https://admin.vyact.app`. The sign-in screen shows the version from `admin/package.json`.
- Check that `npx vercel ls vyact-admin --prod` shows the newest deployment as **Ready**.
- Confirm admin-only routes still reject non-admin users.

## 7. Common failure modes

### `db/schema.sql` drift

Fix:

```bash
node scripts/db-migrations-check.mjs --fix
node scripts/db-migrations-check.mjs
```

### `supabase db push` auth failure in CI

- Refresh `SUPABASE_ACCESS_TOKEN`
- Confirm `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`
- Re-run the workflow after secrets are corrected

### App deploy succeeds but production shows local-only data

- Confirm `react/.env.production` and `admin/.env.production` still contain the public Supabase URL and publishable key
- Confirm CI is not injecting empty `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` values
- Rebuild and redeploy

## 8. Reference files

- `DEPLOY.md`
- `docs/HANDOFF.md`
- `db/MIGRATIONS.md`
- `docs/TEST_GOVERNANCE.md`
- `.github/workflows/deploy.yml`
