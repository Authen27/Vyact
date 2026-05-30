import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, KeyRound, CheckCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input, Field } from '../../components/ui/Input';
import { requestPasswordReset, updatePassword, getSession, signInMagicLink } from '../../lib/auth';
import { isCloudEnabled } from '../../lib/supabase';
import GoogleButton from '../../components/auth/GoogleButton';
import { AuthShell } from './SignIn';

export default function ResetPassword() {
  const [step, setStep] = useState<'request' | 'set' | 'sent' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // If we land here with an active recovery session (from the email link),
  // jump straight to "set new password".
  useEffect(() => {
    if (!isCloudEnabled()) return;
    (async () => {
      const session = await getSession();
      if (session?.user) setStep('set');
    })();
  }, []);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setStep('sent');
    } catch (e) { setError((e as Error).message); }
    finally { setSubmitting(false); }
  }

  async function setNew(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError(''); setSubmitting(true);
    try {
      await updatePassword(newPassword);
      setStep('done');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (e) { setError((e as Error).message); }
    finally { setSubmitting(false); }
  }

  if (step === 'sent') return (
    <AuthShell title="Check your inbox">
      <div className="text-center">
        <Mail size={48} className="mx-auto text-coral mb-4" />
        <p className="text-ink-mid mb-3">We sent a password reset link to <strong className="text-ink">{email}</strong>.</p>
        <Link to="/auth/sign-in" className="text-coral hover:underline text-sm">Back to sign in</Link>
      </div>
    </AuthShell>
  );

  if (step === 'done') return (
    <AuthShell title="Password updated">
      <div className="text-center">
        <CheckCircle size={48} className="mx-auto text-sage mb-4" />
        <p className="text-ink-mid">Redirecting to dashboard…</p>
      </div>
    </AuthShell>
  );

  if (step === 'set') return (
    <AuthShell title="Set a new password">
      <form onSubmit={setNew}>
        <Field label="New password" hint="min 8 chars">
          <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoFocus minLength={8} />
        </Field>
        {error && <div className="text-terra text-[0.84rem] mb-3">{error}</div>}
        <Button full type="submit" disabled={submitting}>
          {submitting ? 'Updating…' : <><KeyRound size={14} /> Update password</>}
        </Button>
      </form>
    </AuthShell>
  );

  if (!isCloudEnabled()) {
    return (
      <AuthShell title="Reset your password">
        <p className="text-ink-mid text-sm text-center mb-4">
          Password reset needs cloud mode. You can still sign in below.
        </p>
        <GoogleButton />
        <div className="mt-5 pt-4 border-t border-line text-center text-sm text-ink-mid">
          <Link to="/auth/sign-in" className="text-coral font-medium hover:underline">Back to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password">
      <form onSubmit={requestReset}>
        <p className="text-ink-mid text-sm mb-4">
          Enter your email and we'll send you a reset link.
        </p>
        <Field label="Email">
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus placeholder="you@example.com" />
        </Field>
        {error && <div className="text-terra text-[0.84rem] mb-3">{error}</div>}
        <Button full type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : <><Mail size={14} /> Send reset link</>}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="flex-1 h-px bg-line" />
        <span className="font-mono text-[0.6rem] tracking-wider uppercase text-ink-dim">or</span>
        <div className="flex-1 h-px bg-line" />
      </div>

      <GoogleButton />

      <button
        type="button"
        onClick={async () => {
          if (!email) { setError('Enter your email first, then use the magic link.'); return; }
          setError('');
          try { await signInMagicLink(email); setStep('sent'); }
          catch (e) { setError((e as Error).message); }
        }}
        className="w-full text-center text-coral hover:underline text-sm font-medium mt-3"
      >
        Email me a one-time sign-in link instead
      </button>

      <p className="text-ink-dim text-[0.78rem] text-center mt-3">
        Reset emails not arriving? Use Google or the one-time link above to get back in.
      </p>

      <div className="mt-5 pt-4 border-t border-line text-center text-sm text-ink-mid">
        <Link to="/auth/sign-in" className="text-coral font-medium hover:underline">Back to sign in</Link>
      </div>
    </AuthShell>
  );
}
