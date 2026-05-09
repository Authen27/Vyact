# FinFlow Deployment Guide

## Vercel + Supabase Setup

### Step 1: Prepare Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your FinFlow project (dmxqkvploojokffuhxnz)
3. Note your **Project URL** and **Anon Key** from Settings → API
4. Copy the exact values (including `https://` for URL)

**Example values (DO NOT USE - get your own):**
```
URL:  https://supabase.com/dashboard/project/dmxqkvploojokffuhxnz
Anon: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 2: Configure Vercel Environment Variables

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your FinFlow project
3. Click **Settings** → **Environment Variables**
4. Add three variables:

| Name | Value | When | 
|------|-------|------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Production + Preview + Development |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Production + Preview + Development |
| `VITE_APP_URL` | `https://$VERCEL_DOMAIN` or custom domain | Production only (optional - defaults to deployed URL) |

**CRITICAL:** You MUST set these BEFORE deploying. Vite env vars are bundled at build time, not at runtime.

### Step 3: Configure Supabase CORS & Auth

1. In Supabase dashboard, go to **Settings** → **API** 
2. Under **CORS settings**, add your Vercel domain:
   - Production: `https://your-finflow.vercel.app`
   - Preview: `https://*.vercel.app` or specific branch URL

3. Go to **Authentication** → **URL Configuration**
4. Add under **Redirect URLs**:
   ```
   https://your-finflow.vercel.app/auth/verified
   https://your-finflow.vercel.app/auth/reset-password
   ```

### Step 4: Deploy to Vercel

Once env vars are set, trigger a new deployment:

```bash
# Via CLI:
vercel --prod

# Or via Vercel Dashboard:
# Click Redeploy on the main branch
```

Check deployment logs for any missing env var warnings.

### Step 5: Test Deployment

1. Open your deployed app: `https://your-finflow.vercel.app`
2. Try to sign up with email/password
3. Check Supabase logs for any RLS policy errors
4. Check browser DevTools console for auth errors

### Troubleshooting

#### 403 Errors on Sign-Up/Login
- **Cause:** Missing env vars or CORS not configured
- **Fix:** Verify VITE_SUPABASE_* vars in Vercel dashboard
- **Check:** Supabase Settings → API → CORS has your Vercel domain

#### "Cloud not configured" Error
- **Cause:** Env vars not set before build
- **Fix:** Set them in Vercel, then redeploy (redeploy forces a new build)
- **Verify:** Check Vercel deployment log for ✓ next to env var names

#### RLS Policy Errors (403 in browser console)
- **Cause:** User is authenticated but RLS policies reject the query
- **Fix:** 
  1. Ensure user email matches invitation email
  2. Check memberships table in Supabase: `SELECT * FROM memberships WHERE user_id = '<your-user-id>'`
  3. Verify `role_in()` function is working: In SQL Editor, run `SELECT role_in('<household-id>')`

#### Auth Redirect Loop
- **Cause:** Redirect URLs not configured in Supabase
- **Fix:** Add `https://your-finflow.vercel.app/auth/verified` to Auth → URL Configuration

#### Local Development Works, Production Fails
- **Cause:** Different env vars between local `.env.local` and Vercel env vars
- **Fix:** 
  1. Make sure you set env vars in Vercel dashboard (not `.env.local`)
  2. `.env.local` is for LOCAL development only
  3. Vercel reads from dashboard settings, not from git

### Local Development Setup

For local testing:
```bash
cd react
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
npm install
npm run dev
```

### Monitoring Deployments

Vercel logs are visible at:
`https://vercel.com/your-account/finflow/deployments`

Supabase logs are visible at:
`https://supabase.com/dashboard/project/dmxqkvploojokffuhxnz/logs`

Look for:
- **Vercel Build Logs**: Check for env var warnings
- **Supabase API Logs**: Check for 403 / RLS policy rejections
- **Browser Console**: Check for client-side auth errors

### Reverting to Local-Only Mode

If you need to disable cloud features:
1. **Temporarily:** Don't set `VITE_SUPABASE_*` env vars — app falls back to localStorage
2. **Permanently:** Remove Supabase config from Vercel, redeploy

The app continues to work in pure localStorage mode without cloud features.

---

**Questions?** Check the main README.md or CLAUDE.md for architecture details.
