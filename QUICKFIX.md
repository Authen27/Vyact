# Quick Fix: FinFlow 403/Database Errors on Vercel

## Problem
Your FinFlow app works locally but gets **403 Forbidden** or **database connection errors** when deployed to Vercel.

## Root Cause
Vite environment variables (`VITE_SUPABASE_*`) are bundled into your JavaScript at **BUILD TIME**, not injected at runtime like Node.js env vars. If they're not set before Vercel builds, they won't be available in production.

---

## ✅ Action Plan (5 minutes)

### 1. Get Your Supabase Credentials
Go to: https://supabase.com/dashboard/project/dmxqkvploojokffuhxnz/settings/integrations

- Copy **Project URL** (starts with `https://`)
- Copy **Anon Public Key** (starts with `eyJ`)

### 2. Add to Vercel (CRITICAL)
Go to: https://vercel.com/dashboard → Your FinFlow project → Settings → Environment Variables

Add these variables (select all environments):

```
VITE_SUPABASE_URL        = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY   = eyJ...your-anon-key...
VITE_APP_URL             = (leave empty - auto-detected)
```

**Click "Save"** — this queues a new build.

### 3. Configure Supabase CORS
Go to: https://supabase.com/dashboard → Project → Settings → API

Find **CORS settings** → Add your Vercel domain:
```
https://your-finflow.vercel.app
```

### 4. Configure Auth Redirect URLs
Go to: https://supabase.com/dashboard → Authentication → URL Configuration

Add under **Redirect URLs:**
```
https://your-finflow.vercel.app/auth/verified
https://your-finflow.vercel.app/auth/reset-password
```

### 5. Redeploy
Option A (automatic): Push a new commit to main
```bash
git add .
git commit -m "fix: enable Supabase cloud features on Vercel"
git push
```

Option B (manual): Go to Vercel Deployments tab → Click "Redeploy" on latest commit

---

## ✓ Verify It Works

1. Open your deployed URL: `https://your-finflow.vercel.app`
2. Try to **Sign Up** with a test email
3. Check browser **DevTools → Console** for errors:
   - ✓ No errors? You're good!
   - ✗ "Cloud not configured"? Env vars not set → redo step 2 & 5
   - ✗ 403 error? CORS or RLS → redo step 3, check Supabase Logs

---

## 🔍 Check Vercel Build

Go to: https://vercel.com/your-account/finflow/deployments

Click on the latest deployment → **Build Logs** → Search for `VITE_SUPABASE`

Should see:
```
✓ VITE_SUPABASE_URL: set
✓ VITE_SUPABASE_ANON_KEY: set
```

If you see `✗ missing`, env vars didn't save. Go back to step 2.

---

## Debug: 403 Forbidden on Sign-Up

If you still get 403 errors:

1. Check **Supabase Logs**: https://supabase.com/dashboard/project/dmxqkvploojokffuhxnz/logs
   - Look for API errors related to `auth.users` or `profiles`

2. Check **RLS policies are correct**
   ```bash
   # In Supabase SQL Editor:
   SELECT * FROM pg_policies WHERE tablename IN ('profiles','households');
   ```
   Should return ~20 policies. If none, run `/db/schema.sql` again.

3. Check **user exists** after sign-up
   ```bash
   # Supabase Dashboard → Authentication → Users
   # Is your test email listed?
   ```

---

## Local Dev: Still Works Without Supabase?

Yes! If env vars aren't set:
- App boots in **localStorage-only mode**
- All v5/v6/v7 features work (Dashboard, Reports, Transactions, etc.)
- Cloud features disabled (auth, invitations, sharing)

To test local without cloud:
```bash
cd react
# Don't set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local
npm run dev
# App works with sample data
```

---

## After Deployment Works

Your users can now:
✓ Sign up with email/password  
✓ Create households  
✓ Share budgets with family  
✓ Invite via email  
✓ See real-time activity log  

All v7 features (recurring, debts, goals) work in cloud mode too.

---

## Files I've Added

- **DEPLOYMENT.md** — Full deployment guide
- **SUPABASE_CONFIG.md** — Detailed Supabase troubleshooting
- **check-env.js** — Build-time warning about missing env vars

---

**Questions?** Check DEPLOYMENT.md or CLAUDE.md in the repo.
