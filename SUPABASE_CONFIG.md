# FinFlow × Supabase Configuration Checklist

> **Status:** This checklist helps you configure Supabase for FinFlow deployment on Vercel.
> Your project: https://supabase.com/dashboard/project/dmxqkvploojokffuhxnz/settings/integrations

## 1. API Configuration ✓

**Location:** Supabase Dashboard → Settings → API

- [ ] Copy **Project URL** (e.g., `https://dmxqkvploojokffuhxnz.supabase.co`)
- [ ] Copy **anon public key** (starts with `eyJ...`)
- [ ] ⚠️ Do NOT use the `service_role` key in the frontend — it bypasses RLS

## 2. CORS Configuration ⚠️

**Problem:** If you see `403 Forbidden` or CORS errors, this section is likely wrong.

**Location:** Supabase Dashboard → Settings → API → CORS configuration

You need to allow your Vercel deployment domain:

- [ ] Go to Settings → API
- [ ] Under **CORS settings**, add your deployment:
  - For production: `https://your-finflow.vercel.app`
  - For preview/staging: `https://staging.vercel.app` or `https://preview-*.vercel.app`
  - For local dev: `http://localhost:5173` (or your dev port)
- [ ] Click "Save"

**Common mistake:** Forgetting to include `https://` prefix.

## 3. Auth Configuration ✓

**Location:** Supabase Dashboard → Authentication → Providers

- [ ] Ensure **Email/Password** is enabled (default)
- [ ] Optional: Enable OAuth (Google, GitHub, Apple) if you want social login

## 4. Auth Redirect URLs ⚠️

**Problem:** Auth redirects fail with "Invalid redirect_uri" or user stuck in redirect loop.

**Location:** Supabase Dashboard → Authentication → URL Configuration

Add all your deployment URLs under **Redirect URLs:**
- [ ] `http://localhost:5173/auth/verified` (local dev)
- [ ] `https://your-finflow.vercel.app/auth/verified` (production)
- [ ] `https://your-finflow.vercel.app/auth/reset-password` (password reset)

Format: One URL per line, include the **full path**.

## 5. Database Schema ✓

**Location:** Supabase Dashboard → SQL Editor

- [ ] Has schema been deployed? Run the SQL from `/db/schema.sql`:
  1. Go to SQL Editor
  2. Click "New query"
  3. Paste contents of `/db/schema.sql`
  4. Click "Run"
  5. Wait for success (watch for errors about extensions or existing tables)

**Tables should exist:**
- `profiles`
- `households`
- `memberships`
- `transactions`
- `budgets`
- `goals`
- `debts`
- `assets`
- `exchange_rates`
- `activity_log`

Verify: SQL Editor → "Explore all tables" should list these.

## 6. Row Level Security (RLS) Policies ⚠️

**Problem:** "403" errors in browser console even though user is authenticated.

**Location:** Supabase Dashboard → SQL Editor (verify policies exist)

Run this query to check:
```sql
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE tablename IN ('households', 'transactions', 'profiles', 'memberships')
ORDER BY tablename, policyname;
```

Should see 20+ policies. If none, re-run `/db/schema.sql`.

**Common RLS issues:**
1. User is not in `memberships` table → add them manually or via invitation
2. `role_in()` function returns NULL → user not a member of that household
3. Policy uses wrong auth function → verify schema.sql was applied correctly

## 7. Vercel Environment Variables ⚠️

**Location:** Vercel Dashboard → Project Settings → Environment Variables

These MUST be set BEFORE deployment:

| Name | Value | Environments |
|------|-------|--------------|
| `VITE_SUPABASE_URL` | Your Supabase URL | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Your anon key | Production, Preview, Development |
| `VITE_APP_URL` | `https://$VERCEL_DOMAIN` or your domain | Production only (optional) |

**Steps:**
1. [ ] Go to https://vercel.com → Your project → Settings → Environment Variables
2. [ ] Add the three variables above
3. [ ] **IMPORTANT:** Click "Save" — this queues a new build
4. [ ] Trigger redeployment:
   - Option A: Push a new commit to your repo
   - Option B: Go to Deployments → Click "Redeploy" on latest

**Why:** Vite env vars are baked into the JavaScript bundle at BUILD TIME. They're not injected at runtime like Node.js env vars.

## 8. Testing Cloud Features

**In Local Dev:**
```bash
cd react
npm install
npm run dev
# Open http://localhost:5173
# Try: Sign up, Create household, Add transaction
```

**On Vercel (after deployment):**
1. [ ] Open your deployed URL
2. [ ] Try to **Sign up** with new email
3. [ ] Check browser **DevTools Console** for errors:
   - If you see `"Cloud not configured"` → env vars not set, re-do step 7
   - If you see `403 Forbidden` → CORS or RLS issue, check steps 2 & 6
4. [ ] Try to **Create a household** (after login)
5. [ ] Try to **Add a transaction**

## 9. Debugging 403 Errors

**Quick checklist if you see 403 in console:**

1. [ ] Check Vercel env vars are set (not `.env.local`)
   ```bash
   # In Vercel dashboard, can you see VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY?
   ```
2. [ ] Check Supabase CORS includes your domain
   ```bash
   # Supabase dashboard → Settings → API → CORS
   # Should list https://your-finflow.vercel.app
   ```
3. [ ] Check Supabase logs
   ```bash
   # Supabase dashboard → Logs → API queries
   # Look for 403 errors with details
   ```
4. [ ] Check user exists in Supabase
   ```bash
   # Supabase dashboard → Authentication → Users
   # Is your test user listed?
   ```
5. [ ] Check RLS policies
   ```bash
   # Run as authenticated user (must be signed in):
   # SELECT * FROM households LIMIT 1
   # Should return results if you're in any household
   ```

## 10. Vercel Build Logs

**Location:** Vercel Dashboard → Project → Deployments → [Latest] → Build Logs

Check for:
- ✓ `VITE_SUPABASE_URL: ✓ set` (good)
- ✗ `VITE_SUPABASE_URL: ✗ missing` (problem — re-do step 7)
- Build errors related to TypeScript or missing deps

## Troubleshooting Summary

| Error | Cause | Fix |
|-------|-------|-----|
| "Cloud not configured" | Env vars not set or build happened before setting them | Re-add env vars in Vercel, redeploy |
| 403 Forbidden (API calls) | CORS or RLS policy blocking | Check CORS domain and RLS policies |
| Auth redirect loop | Redirect URL not in Supabase config | Add URL to Auth → URL Configuration |
| "Invalid redirect_uri" | Typo in redirect URL | Exact match, include full path |
| User can sign up but can't see data | Not in a household | Create household or accept invitation |
| Empty dashboard (no data) | Using old Supabase project | Verify you're using the right project |

## Next Steps

1. **Set env vars in Vercel** (if not done)
2. **Redeploy** — this triggers a new build with env vars included
3. **Test** — go through section 8
4. **Debug** — use section 9 if issues persist

Once deployed and working, users can:
- Sign up with email/password
- Create households
- Invite others via email
- Share budgets, goals, debts, assets with household members
- See real-time activity log of changes

---

**Questions?** Check `/DEPLOYMENT.md` or `/CLAUDE.md` for more context.
