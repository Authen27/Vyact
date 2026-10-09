import { useEffect, useState } from 'react';
import { Sun, Moon, Database, Mail, Webhook, Shield, KeyRound } from 'lucide-react';
import { useAdminStore } from '../store';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { pingDatabase, projectRefOf, type DbStatus } from '../lib/dbStatus';

export default function Settings() {
  const dark = useAdminStore(s => s.darkMode);
  const toggleDark = useAdminStore(s => s.toggleDark);
  // W8c (audit ADM-12): the database status is a live round-trip, not a hard-coded "connected".
  const [db, setDb] = useState<DbStatus>('checking');
  useEffect(() => { let live = true; void pingDatabase(supabase).then(r => { if (live) setDb(r); }); return () => { live = false; }; }, []);
  const projectRef = projectRefOf(SUPABASE_URL);

  return (
    <div>
      <div className="mb-6">
        <h1 className="display-serif text-3xl text-ink mb-1">Settings</h1>
        <p className="text-ink-mid text-[0.92rem]">System configuration · Integrations · Admin preferences</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {/* Appearance */}
        <Section title="Appearance">
          <Row label="Theme" hint="Light Claude · default. Dark for low-light power users.">
            <button onClick={toggleDark} className="px-3 py-2 bg-elev border border-line rounded-md text-[0.84rem] text-ink hover:bg-sunken transition flex items-center gap-2">
              {dark ? <><Sun size={14} /> Switch to Light</> : <><Moon size={14} /> Switch to Dark</>}
            </button>
          </Row>
        </Section>

        {/* Database */}
        <Section title="Database">
          <Row label="Backend" hint="Supabase. Checked with a live read when this page opens.">
            <Status state={db === 'connected' ? 'connected' : db === 'checking' ? 'pending' : 'error'}
              label={db === 'connected' ? 'Supabase · reachable' : db === 'checking' ? 'Checking…' : db === 'not_configured' ? 'Not configured' : 'Unreachable'}
              icon={<Database size={12} />} />
          </Row>
          <Row label="Project" hint="The Supabase project this build talks to.">
            <code className="font-mono text-[0.78rem] text-ink-mid bg-elev px-2 py-1 rounded">{projectRef ?? 'not set'}</code>
          </Row>
        </Section>

        {/* Integrations */}
        <Section title="Integrations">
          {/* W8c (ADM-12): nothing here is checked, so nothing claims "connected" (GA4's row did). */}
          <Row label="Stripe" hint="Subscription, refunds, dunning."><Status state="pending" label="Not connected" icon={<KeyRound size={12} />} /></Row>
          <Row label="PostHog" hint="Product analytics, cohort retention."><Status state="pending" label="Not connected" icon={<KeyRound size={12} />} /></Row>
          <Row label="Intercom" hint="Customer support inbox + NPS."><Status state="pending" label="Not connected" icon={<KeyRound size={12} />} /></Row>
          <Row label="Sentry" hint="Error monitoring."><Status state="pending" label="Not connected" icon={<KeyRound size={12} />} /></Row>
        </Section>

        {/* Email */}
        <Section title="Email & Notifications">
          <Row label="Transactional" hint="Resend · Postmark · SES (configurable)."><Status state="pending" label="SES (planned)" icon={<Mail size={12} />} /></Row>
          <Row label="Webhooks" hint="Outbound webhooks for partner systems."><Status state="pending" label="0 endpoints" icon={<Webhook size={12} />} /></Row>
        </Section>

        {/* Security — audit 7.4: these show CONFIGURED INTENT, not verified
            enforcement. Until they are read from a live source, they are
            labelled as targets, not asserted as fact. */}
        <Section title="Security">
          {/* Owner decision (2026-10-06, audit D23): no two-factor authentication for the
              consumer app or admin. Say so instead of promising it. */}
          <Row label="Admin MFA" hint="Not used (owner decision, Oct 2026): admin sign-in is password-only. Keep admin passwords unique and long."><Status state="pending" label="Not used" icon={<Shield size={12} />} /></Row>
          <Row label="Session timeout" hint="Target auto sign-out after inactivity. Not yet enforced by the server.">
            <code className="font-mono text-[0.78rem] text-amber-600 bg-elev px-2 py-1 rounded">30 min (planned)</code>
          </Row>
          <Row label="Audit retention" hint="Target retention for audit log entries. Not yet enforced by a lifecycle rule.">
            <code className="font-mono text-[0.78rem] text-amber-600 bg-elev px-2 py-1 rounded">7 years (planned)</code>
          </Row>
        </Section>
      </div>

      <div className="mt-6 text-center font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
        Admin v{__APP_VERSION__}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="px-4 py-3 border-b border-line">
        <h2 className="display-serif text-lg text-ink">{title}</h2>
      </div>
      <div className="divide-y divide-line">
        {children}
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-[0.86rem] font-medium text-ink">{label}</div>
        {hint && <div className="text-[0.74rem] text-ink-dim mt-0.5">{hint}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Status({ state, label, icon }: { state: 'connected' | 'pending' | 'error'; label: string; icon: React.ReactNode }) {
  const cls = state === 'connected' ? 'bg-positive/15 text-positive border-positive/30'
    : state === 'error' ? 'bg-danger/10 text-danger border-danger/30' : 'bg-warn/10 text-warn border-warn/30';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill font-mono text-[0.62rem] tracking-wider border ${cls}`}>
      {icon} {label}
    </span>
  );
}
