# Junior Implementation Brief — Google SSO as Mandatory Primary Sign-in

> **Who:** junior engineer / agent.
> **What:** make Google sign-in the primary, always-visible CTA on Sign In and
> Sign Up. Remove the `isCloudEnabled` feature-flag guard from `GoogleButton`.
> **Repo:** `Vyact-main` (github.com/Authen27/Vyact), branch `feat/google-sso-mandatory`.
> **Source of truth:** every symbol below was verified against the actual files.
> **Do not push, do not merge.** Hand back the branch + lint/build output for senior review.

---

## 0. Rules before you start

- Work **only** in `react/src/`. Do not touch `supabase/`, `admin/`, `.github/`,
  `*.env*`, or any file not listed in this brief.
- No new `npm install`. All needed imports already exist.
- Branch: `git switch -c feat/google-sso-mandatory` from `main`.
- If anything does not match the file exactly, **stop and leave a
  `// TODO(review): <what differed>` comment.** Do not guess.
- Definition of done (paste output when handing back):
  ```bash
  cd react && npm run lint    # must show 0 errors
  cd react && npm run build   # must succeed
  ```

---

## 1. Context — why this change is needed

`GoogleButton` currently returns `null` when `isCloudEnabled()` is false:

```ts
// react/src/components/auth/GoogleButton.tsx  line 9 — CURRENT
if (!isCloudEnabled()) return null;
```

In the **production build** `isCloudEnabled()` is always `true` (the PROD fallback
URL/key is committed), so the button already renders in prod. But:

1. The guard hides it in local dev — making it impossible to test the OAuth flow
   without extra setup.
2. More importantly: the button sits **below** the email/password form. Google SSO
   should be the **primary CTA** — the first thing a user sees.

The Supabase Google provider configuration (dashboard step) is a separate human
task tracked in `todo.yaml` under `google_sso_provider_config`. Until that step is
done the button will redirect to Google and return an `OAuth provider not enabled`
error — which is acceptable and expected. The button must still always be visible.

---

## 2. Changes — exact files, exact edits

### 2.1  `react/src/components/auth/GoogleButton.tsx`

**Replace the entire file** with this:

```tsx
import { useState } from 'react';
import { signInOAuth } from '../../lib/auth';

// Primary Google sign-in CTA.
// Always rendered — provider misconfiguration surfaces as an inline error,
// not a missing button. The Supabase Google provider + redirect URL
// configuration is a human/dashboard step (see todo.yaml: google_sso_provider_config).
export default function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const [oauthError, setOauthError] = useState('');

  async function go() {
    setBusy(true);
    setOauthError('');
    try {
      await signInOAuth('google');   // redirects away on success
      // If we reach here the redirect didn't fire — treat as an error.
      setBusy(false);
    } catch (e) {
      setOauthError(
        (e as Error).message.includes('provider')
          ? 'Google sign-in is not configured yet. Please use email below.'
          : (e as Error).message
      );
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 border border-line rounded-md py-2.5 text-sm font-medium text-ink hover:bg-bg3 transition-colors disabled:opacity-60"
      >
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3.1 0 5.9 1.2 8 3.1l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C39.9 36 44 30.6 44 24c0-1.2-.1-2.4-.4-3.5z"/>
        </svg>
        {busy ? 'Redirecting…' : 'Continue with Google'}
      </button>
      {oauthError && (
        <p className="text-terra text-[0.78rem] text-center mt-2">{oauthError}</p>
      )}
    </div>
  );
}
```

**What changed vs the current file:**
- Removed: `import { isCloudEnabled } from '../../lib/supabase';`
- Removed: `if (!isCloudEnabled()) return null;`
- Added: `oauthError` state — shows an inline message instead of crashing if the
  provider is not yet configured.
- Wrapped the return in a `<div>` to accommodate the error paragraph.

---

### 2.2  `react/src/pages/auth/SignIn.tsx`

**Goal:** Google button is the first thing the user sees, email/password form is secondary.

The current render order inside `<AuthShell title="Welcome back">` is:
```
form (email + password)
<GoogleButton />          ← currently here (line 73)
divider "or"
magic-link toggle
footer
```

**Change it to:**
```
<GoogleButton />          ← move to top, primary CTA
divider "or sign in with email"
form (email + password)
magic-link toggle
footer
```

Find this block (lines 56–98) and replace the entire `return (...)`:

```tsx
  return (
    <AuthShell title="Welcome back">

      {/* Primary CTA — Google */}
      <GoogleButton />

      <div className="my-4 flex items-center gap-3">
        <div className="flex-1 h-px bg-line" />
        <span className="font-mono text-[0.6rem] tracking-wider uppercase text-ink-dim">or sign in with email</span>
        <div className="flex-1 h-px bg-line" />
      </div>

      {/* Secondary — email / password */}
      <form onSubmit={onSubmit}>
        <Field label="Email">
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus placeholder="you@example.com" />
        </Field>
        {mode === 'password' && (
          <Field label="Password">
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
          </Field>
        )}
        {error && <div className="text-terra text-[0.84rem] mb-3">{error}</div>}
        <Button full type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : mode === 'password' ? <><LogIn size={14} /> Sign in</> : <><Mail size={14} /> Send magic link</>}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => { setMode(m => m === 'password' ? 'magic' : 'password'); setError(''); }}
        className="w-full text-center text-coral hover:underline text-sm font-medium mt-3"
      >
        {mode === 'password' ? 'Sign in with magic link instead' : 'Sign in with password instead'}
      </button>

      <div className="mt-5 pt-4 border-t border-line text-center text-sm text-ink-mid">
        <Link to="/auth/reset" className="hover:underline flex items-center justify-center gap-1.5">
          <KeyRound size={12} /> Forgot password?
        </Link>
        <div className="mt-2.5">
          New here? <Link to="/auth/sign-up" className="text-coral font-medium hover:underline">Create an account</Link>
        </div>
      </div>
    </AuthShell>
  );
```

**Only change is layout order.** No logic changes. All imports stay the same.

---

### 2.3  `react/src/pages/auth/SignUp.tsx`

**Goal:** same — Google first, email form second.

Current order inside `<AuthShell title="Create your account">` (lines 78–113):
```
form (name + email + password)
verification note
divider
<GoogleButton />          ← currently here (line 107)
footer
```

**Change it to:**
```
<GoogleButton />          ← top
divider "or sign up with email"
form (name + email + password)
footer
```

Find the `return (` block (line 78 onward) and replace it with:

```tsx
  return (
    <AuthShell title="Create your account">

      {/* Primary CTA — Google */}
      <GoogleButton />

      <div className="my-4 flex items-center gap-3">
        <div className="flex-1 h-px bg-line" />
        <span className="font-mono text-[0.6rem] tracking-wider uppercase text-ink-dim">or sign up with email</span>
        <div className="flex-1 h-px bg-line" />
      </div>

      {/* Secondary — email form */}
      <form onSubmit={onSubmit}>
        <Field label="Full name">
          <Input type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus placeholder="Alex Morgan" />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
        </Field>
        <Field label="Password" hint="min 8 chars">
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" minLength={8} />
        </Field>
        {error && <div className="text-terra text-[0.84rem] mb-3">{error}</div>}
        <Button full type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : <><UserPlus size={14} /> Sign up</>}
        </Button>
      </form>

      <div className="mt-5 pt-4 border-t border-line text-center text-sm text-ink-mid">
        Already have an account? <Link to="/auth/sign-in" className="text-coral font-medium hover:underline">Sign in</Link>
      </div>
    </AuthShell>
  );
```

**Removed:** the "Email verification is optional…" paragraph (now redundant — Google
users never see email verification). **No logic changes.**

---

### 2.4  `react/src/pages/auth/ResetPassword.tsx`

**No layout changes needed.** `GoogleButton` is already present in the `'request'`
step. The only change is that it will now always render (due to 2.1 above) even
when `isCloudEnabled()` is false — which is the desired behaviour.

**One small cleanup:** remove the `isCloudEnabled` import since
`ResetPassword.tsx` uses it only to guard `GoogleButton` (which no longer needs
the guard) and to gate the `useEffect`. Check line 7:

```ts
import { isCloudEnabled } from '../../lib/supabase';
```

The `useEffect` on line 22 still uses `isCloudEnabled()` as a guard:
```ts
  useEffect(() => {
    if (!isCloudEnabled()) return;    // ← keep this line as-is
    ...
  }, []);
```

**Keep that `useEffect` guard** — it prevents `getSession()` throwing in local dev.
So keep the `isCloudEnabled` import. No change needed to this file.

---

## 3. Verify — exact commands to run and paste back

```bash
cd react
npm run lint
# Expected: ✖ N problems (0 errors, N warnings)  ← 0 errors is the gate

npm run build
# Expected: ✓ built in Xs

# Quick smoke check — confirm Google button is in the output bundle:
grep -c "Continue with Google" dist/assets/index-*.js
# Expected: 1
```

---

## 4. Commit and hand back

```bash
git add react/src/components/auth/GoogleButton.tsx \
        react/src/pages/auth/SignIn.tsx \
        react/src/pages/auth/SignUp.tsx
git status   # confirm ONLY those 3 files are staged
git commit -m "feat(auth): Google SSO as primary mandatory CTA — no feature flag

- GoogleButton always renders; isCloudEnabled guard removed.
  Error state handles provider-not-configured gracefully.
- SignIn: Google button moved above email form as primary CTA.
- SignUp: Google button moved above email form as primary CTA.
- ResetPassword: no layout change (button already present + correct position).

Provider config (Supabase dashboard) tracked in todo.yaml: google_sso_provider_config.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

**Then stop.** Hand back: (a) branch name, (b) lint output, (c) build output,
(d) any `// TODO(review)` markers you left and why.

Do not push. Do not open a PR. Do not touch the Supabase dashboard.

---

## 5. What you must NOT do

- Do not add new npm packages.
- Do not change `supabase.ts`, `auth.ts`, `store.ts`, or any file not listed above.
- Do not remove the `isCloudEnabled()` guard inside the `useEffect` in
  `ResetPassword.tsx` — that guard is unrelated to the button visibility.
- Do not change the `AuthShell` component in `SignIn.tsx`.
- Do not change how `signInOAuth` works in `auth.ts`.
