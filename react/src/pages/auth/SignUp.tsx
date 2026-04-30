import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Mail } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input, Field } from '../../components/ui/Input';
import { signUp } from '../../lib/auth';
import { AuthShell } from './SignIn';
import { useStore } from '../../store';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [verifyEmailSent, setVerifyEmailSent] = useState(false);
  const navigate = useNavigate();
  const toast = useStore(s => s.toast);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError(''); setSubmitting(true);
    try {
      const result = await signUp({ email, password, displayName: name });
      if (result.user && !result.session) {
        // Email verification required
        setVerifyEmailSent(true);
      } else {
        toast(`Welcome, ${name}!`, 'success');
        navigate('/onboarding');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (verifyEmailSent) {
    return (
      <AuthShell title="Verify your email">
        <div className="text-center">
          <Mail size={48} className="mx-auto text-coral mb-4" />
          <p className="text-ink-mid mb-2">
            We sent a verification link to <strong className="text-ink">{email}</strong>.
          </p>
          <p className="text-ink-mid text-sm mb-5">
            Click the link to activate your account.
          </p>
          <Link to="/auth/sign-in" className="text-coral hover:underline text-sm font-medium">
            Already verified? Sign in →
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account">
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

      <p className="text-[0.74rem] text-ink-dim mt-4 leading-relaxed text-center">
        By signing up you agree to our terms and privacy policy. Your financial data is encrypted at rest and never shared.
      </p>

      <div className="mt-5 pt-4 border-t border-line text-center text-sm text-ink-mid">
        Already have an account? <Link to="/auth/sign-in" className="text-coral font-medium hover:underline">Sign in</Link>
      </div>
    </AuthShell>
  );
}
