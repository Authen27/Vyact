import { Sun, Moon, Database, Mail, Webhook, Shield, KeyRound } from 'lucide-react';
import { useAdminStore } from '../store';

export default function Settings() {
  const dark = useAdminStore(s => s.darkMode);
  const toggleDark = useAdminStore(s => s.toggleDark);

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
          <Row label="Backend" hint="Currently mock data. Wires to Supabase in v8.1.">
            <Status state="pending" label="Mock · will be Supabase" icon={<Database size={12} />} />
          </Row>
          <Row label="Region" hint="Production region for primary database.">
            <code className="font-mono text-[0.78rem] text-ink-mid bg-elev px-2 py-1 rounded">eu-west-2</code>
          </Row>
        </Section>

        {/* Integrations */}
        <Section title="Integrations">
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

        {/* Security */}
        <Section title="Security">
          <Row label="Admin SSO" hint="Google Workspace · IP allowlist."><Status state="pending" label="Required for v8.1" icon={<Shield size={12} />} /></Row>
          <Row label="Session timeout" hint="Auto sign-out after inactivity.">
            <code className="font-mono text-[0.78rem] text-ink-mid bg-elev px-2 py-1 rounded">30 min</code>
          </Row>
          <Row label="Audit retention" hint="Years to keep audit log entries.">
            <code className="font-mono text-[0.78rem] text-ink-mid bg-elev px-2 py-1 rounded">7 years</code>
          </Row>
        </Section>
      </div>

      <div className="mt-6 text-center font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
        Admin v8.0 · Connect integrations in v8.1
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

function Status({ state, label, icon }: { state: 'connected' | 'pending'; label: string; icon: React.ReactNode }) {
  const cls = state === 'connected' ? 'bg-positive/15 text-positive border-positive/30' : 'bg-warn/10 text-warn border-warn/30';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill font-mono text-[0.62rem] tracking-wider border ${cls}`}>
      {icon} {label}
    </span>
  );
}
