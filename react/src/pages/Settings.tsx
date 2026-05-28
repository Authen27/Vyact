import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { useTranslation } from '../hooks';
import { Panel } from '../components/ui/Card';
import { fmt, today } from '../lib/format';
import { CURRENCIES, DEFAULT_RATES, LOCALES, PROFILE_TYPES } from '../constants';
import { sb } from '../lib/supabase';
import { enrollMfaTotp, verifyMfaEnrolment, listMfaFactors, unenrollMfaFactor } from '../lib/auth';
import type { Profile, Theme } from '../types';

const THEMES: { key: Theme; label: string; desc: string }[] = [
  { key: 'warm',   label: 'Paper Warm', desc: 'Cream & coral — default' },
  { key: 'dark',   label: 'Dark',       desc: 'Warm palette on dark ink' },
  { key: 'system', label: 'System',     desc: 'Follow OS preference' },
];

const DATE_FORMATS: { key: Profile['dateFormat']; label: string; example: string }[] = [
  { key: 'us',  label: 'US',       example: 'May 9, 2026' },
  { key: 'eu',  label: 'European', example: '9 May 2026' },
  { key: 'iso', label: 'ISO',      example: '2026-05-09' },
];

export default function Settings() {
  const { t } = useTranslation();
  const profile     = useStore(s => s.profile);
  const rates       = useStore(s => s.rates);
  const theme       = useStore(s => s.theme);
  const cloudEnabled = useStore(s => s.cloudEnabled);
  const session      = useStore(s => s.session);
  const transactions = useStore(s => s.transactions);
  const budgets     = useStore(s => s.budgets);
  const goals       = useStore(s => s.goals);
  const debts       = useStore(s => s.debts);
  const assets      = useStore(s => s.assets);
  const members     = useStore(s => s.members);
  const updateProfile = useStore(s => s.updateProfile);
  const upsertRate  = useStore(s => s.upsertRate);
  const resetRates  = useStore(s => s.resetRates);
  const setTheme    = useStore(s => s.setTheme);
  const toast       = useStore(s => s.toast);

  const [name, setName]       = useState(profile.name);
  const [email, setEmail]     = useState(profile.email);
  const [saving, setSaving]   = useState(false);
  const [rateEdits, setRateEdits] = useState<Record<string, string>>({});
  const [extraPay, setExtraPay] = useState(String(profile.extraPayment || 0));

  // MFA / Security state (TD-15)
  const [mfaQr, setMfaQr] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(false);

  async function saveProfile() {
    setSaving(true);
    try {
      await updateProfile({ name, email });
      toast('Profile saved', 'success');
    } catch { toast('Save failed', 'error'); }
    finally { setSaving(false); }
  }

  async function applyRate(code: string) {
    const val = parseFloat(rateEdits[code] ?? '');
    if (isNaN(val) || val <= 0) return;
    await upsertRate(code, val);
    setRateEdits(r => { const n = {...r}; delete n[code]; return n; });
    toast(`${code} rate updated`, 'success');
  }

  function downloadBackup() {
    const backup = {
      version: '6.4.9', exported: today(),
      profile, transactions, budgets, goals, members, debts, assets,
      exchangeRates: rates,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `finflow-backup-${today()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast('Backup downloaded', 'success');
  }

  function exportCSV() {
    const rows = [
      ['Date','Type','Description','Category','Amount','Currency','Note'],
      ...transactions.map(t => [t.date, t.type, t.description, t.category, t.amount, t.currency, t.note || '']),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `finflow-transactions-${today()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast('CSV exported', 'success');
  }

  async function saveDebtPrefs() {
    const ep = parseFloat(extraPay);
    await updateProfile({ extraPayment: isNaN(ep) ? 0 : ep });
    toast('Debt preferences saved', 'success');
  }

  const userEmail = session?.user?.email ?? profile.email;
  const emailVerified = Boolean(session?.user?.email_confirmed_at);

  async function resendVerification() {
    if (!userEmail) return;
    try {
      const { error } = await sb().auth.resend({ type: 'signup', email: userEmail });
      if (error) throw error;
      toast('Verification email sent — check your inbox', 'success');
    } catch (e) {
      toast(`Could not resend: ${(e as Error).message}`, 'error');
    }
  }

  async function fetchMfaFactors() {
    if (!cloudEnabled || !session) return setMfaFactors([]);
    setLoadingFactors(true);
    try {
      const factors = await listMfaFactors();
      setMfaFactors((factors as any)?.all || (factors as any) || []);
    } catch (e) {
      // ignore — best-effort UI
      setMfaFactors([]);
    } finally { setLoadingFactors(false); }
  }

  useEffect(() => {
    if (cloudEnabled && session) fetchMfaFactors();
  }, [cloudEnabled, session]);

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5">{t('settings')}</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            Profile · Appearance · Currency · Sync
          </p>
        </div>
      </div>

      <div className="space-y-4">

        {/* ── Profile ─────────────────────────────────────── */}
        <Panel title="Profile">
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="mono-label mb-1.5 block">Display Name</label>
              <input className="input w-full" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Email</label>
              <input className="input w-full" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Household Type</label>
              <select className="input w-full" value={profile.household}
                onChange={e => updateProfile({ household: e.target.value as Profile['household'] })}>
                {Object.entries(PROFILE_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Date Format</label>
              <select className="input w-full" value={profile.dateFormat}
                onChange={e => updateProfile({ dateFormat: e.target.value as Profile['dateFormat'] })}>
                {DATE_FORMATS.map(df => (
                  <option key={df.key} value={df.key}>{df.label} — {df.example}</option>
                ))}
              </select>
            </div>
            {cloudEnabled && session && (
              <div className="sm:col-span-2 flex items-center justify-between gap-3 bg-bg3 border border-line rounded-md px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className={`font-mono text-[0.6rem] tracking-widest uppercase px-2 py-0.5 rounded-full ${
                    emailVerified
                      ? 'bg-sage/10 border border-sage/30 text-sage'
                      : 'bg-honey/10 border border-honey/40 text-honey'
                  }`}>
                    {emailVerified ? 'Email verified' : 'Verification pending'}
                  </span>
                  <span className="text-[0.78rem] text-ink-mid">
                    {emailVerified
                      ? 'Password recovery is enabled.'
                      : 'You have full access — verifying enables password recovery.'}
                  </span>
                </div>
                {!emailVerified && (
                  <button className="btn-ghost text-xs py-1 px-2.5" onClick={resendVerification}>
                    Resend
                  </button>
                )}
              </div>
            )}

            <div className="sm:col-span-2 flex items-center justify-between gap-3">
              <Link
                to="/onboarding"
                className="text-[0.8rem] text-coral hover:underline font-medium"
              >
                {profile.onboardedAt ? 'Re-run onboarding wizard' : 'Run onboarding wizard'} →
              </Link>
              <button className="btn-primary" onClick={saveProfile} disabled={saving}>
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </div>
        </Panel>

        {/* ── Appearance ──────────────────────────────────── */}
        <Panel title="Appearance">
          <div className="p-5 grid sm:grid-cols-3 gap-3">
            {THEMES.map(th => (
              <button key={th.key} onClick={() => setTheme(th.key)}
                className={`border-2 rounded-lg p-4 text-left transition-all ${
                  theme === th.key ? 'border-coral bg-coral/5' : 'border-line bg-bg3 hover:border-coral/40'
                }`}>
                <div className="text-sm font-semibold text-ink mb-0.5">{th.label}</div>
                <div className="font-mono text-[0.6rem] tracking-wider text-ink-dim">{th.desc}</div>
                {theme === th.key && <div className="mt-2 text-[0.65rem] font-mono text-coral uppercase tracking-widest">Active</div>}
              </button>
            ))}
          </div>
        </Panel>

        {/* ── Localisation ────────────────────────────────── */}
        <Panel title="Language & Currency">
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="mono-label mb-1.5 block">Language</label>
              <select className="input w-full" value={profile.language}
                onChange={e => updateProfile({ language: e.target.value })}>
                {Object.entries(LOCALES).map(([k, v]) => (
                  <option key={k} value={k}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Base Currency</label>
              <select className="input w-full" value={profile.baseCurrency}
                onChange={e => updateProfile({ baseCurrency: e.target.value })}>
                {Object.entries(CURRENCIES).map(([code, meta]) => (
                  <option key={code} value={code}>{meta.symbol} {code} — {meta.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Panel>

        {/* ── Exchange Rates ───────────────────────────────── */}
        <Panel title="Exchange Rates (USD base)">
          <div className="p-4">
            <p className="text-[0.84rem] text-ink-mid mb-4">
              Rates relative to USD. All multi-currency amounts are converted through these.
            </p>
            <div className="grid sm:grid-cols-3 gap-2">
              {Object.entries(CURRENCIES).filter(([c]) => c !== 'USD').map(([code]) => (
                <div key={code} className="flex items-center gap-2 bg-bg3 border border-line rounded-md px-3 py-2">
                  <span className="font-mono text-[0.7rem] text-ink-dim w-8 flex-shrink-0">{code}</span>
                  <input
                    className="input flex-1 text-right text-sm py-1 px-2"
                    value={rateEdits[code] ?? String(rates[code] ?? DEFAULT_RATES[code] ?? '')}
                    onChange={e => setRateEdits(r => ({ ...r, [code]: e.target.value }))}
                    onBlur={() => applyRate(code)}
                    onKeyDown={e => e.key === 'Enter' && applyRate(code)}
                    placeholder={String(DEFAULT_RATES[code] ?? '')}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button className="btn-ghost text-sm" onClick={() => { resetRates(); toast('Rates reset to defaults', 'info'); }}>
                Reset to defaults
              </button>
            </div>
          </div>
        </Panel>

        {/* ── Debt Preferences ─────────────────────────────── */}
        <Panel title="Debt Preferences">
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="mono-label mb-1.5 block">Payoff Strategy</label>
              <select className="input w-full" value={profile.payoffStrategy}
                onChange={e => updateProfile({ payoffStrategy: e.target.value as Profile['payoffStrategy'] })}>
                <option value="avalanche">Avalanche — highest APR first (saves money)</option>
                <option value="snowball">Snowball — smallest balance first (motivation)</option>
              </select>
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Monthly Extra Payment ({profile.baseCurrency})</label>
              <input className="input w-full" type="number" min="0" value={extraPay}
                onChange={e => setExtraPay(e.target.value)} placeholder="0" />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button className="btn-primary" onClick={saveDebtPrefs}>Save Preferences</button>
            </div>
          </div>
        </Panel>

        {/* ── Sync & Backup ────────────────────────────────── */}
        <Panel title="Sync & Backup">
          <div className="p-5 space-y-3">
            {cloudEnabled && (
              <div className="flex items-center gap-2 bg-sage/10 border border-sage/30 rounded-md px-4 py-3 mb-4">
                <span className="text-sage">☁</span>
                <span className="text-[0.84rem] text-ink">Cloud sync is active — data syncs automatically with Supabase.</span>
              </div>
            )}
            <div className="grid sm:grid-cols-3 gap-3">
              <button className="btn-secondary flex flex-col items-center gap-1.5 py-4" onClick={downloadBackup}>
                <span className="text-xl">⬇</span>
                <span className="text-sm font-semibold">Download Backup</span>
                <span className="font-mono text-[0.6rem] text-ink-dim uppercase tracking-widest">JSON snapshot</span>
              </button>
              <button className="btn-secondary flex flex-col items-center gap-1.5 py-4" onClick={exportCSV}>
                <span className="text-xl">📄</span>
                <span className="text-sm font-semibold">Export CSV</span>
                <span className="font-mono text-[0.6rem] text-ink-dim uppercase tracking-widest">Transactions</span>
              </button>
              <button className="btn-secondary flex flex-col items-center gap-1.5 py-4"
                onClick={() => { navigator.clipboard.writeText(JSON.stringify({ profile, transactions, budgets, goals, debts, assets }, null, 2)); toast('Copied to clipboard', 'success'); }}>
                <span className="text-xl">📋</span>
                <span className="text-sm font-semibold">Copy to Clipboard</span>
                <span className="font-mono text-[0.6rem] text-ink-dim uppercase tracking-widest">Full backup</span>
              </button>
            </div>
          </div>
        </Panel>

        {/* ── Security ─────────────────────────────────────── */}
        <Panel title="Security">
          <div className="p-5 space-y-3">
            {!cloudEnabled || !session ? (
              <div className="bg-bg3 border border-line rounded-md p-4 text-sm text-ink-mid">
                Two-factor authentication requires cloud mode (Supabase). Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[0.9rem] text-ink-mid">Two-factor authentication (TOTP) adds an extra layer of account protection.</div>
                <div className="flex items-center gap-3">
                  <button className="btn-primary" onClick={async () => {
                    setMfaEnrolling(true);
                    try {
                      const enrolled = await enrollMfaTotp('FinFlow TOTP');
                      const otpauth = (enrolled as any)?.otpauth_url || (enrolled as any)?.otp_url || (enrolled as any)?.otpauth || null;
                      if (otpauth) setMfaQr(`https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(otpauth)}`);
                      setMfaFactorId((enrolled as any)?.id || (enrolled as any)?.factor_id || '');
                      await fetchMfaFactors();
                    } catch (e) {
                      toast(`MFA enrolment failed: ${(e as Error).message}`, 'error');
                    } finally { setMfaEnrolling(false); }
                  }} disabled={mfaEnrolling}>
                    {mfaEnrolling ? 'Working…' : 'Enable two-factor auth'}
                  </button>
                  {mfaQr && (
                    <div className="flex items-center gap-3">
                      <img src={mfaQr} alt="TOTP QR" className="w-24 h-24 border rounded-md" />
                      <div className="flex flex-col">
                        <input className="input w-40 mb-2" placeholder="Enter 6-digit code" value={mfaCode} onChange={e => setMfaCode(e.target.value)} />
                        <div className="flex gap-2">
                          <button className="btn-primary" onClick={async () => {
                            if (!mfaFactorId || !mfaCode) return toast('Enter code', 'error');
                            setMfaEnrolling(true);
                            try {
                              await verifyMfaEnrolment(mfaFactorId, mfaCode);
                              toast('Two-factor authentication enabled', 'success');
                              setMfaQr(''); setMfaCode(''); setMfaFactorId('');
                              await fetchMfaFactors();
                            } catch (e) { toast(`Verification failed: ${(e as Error).message}`, 'error'); }
                            finally { setMfaEnrolling(false); }
                          }}>{mfaEnrolling ? 'Verifying…' : 'Verify'}</button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                <div>
                  <div className="text-sm font-semibold mb-2">Enrolled factors</div>
                  <div>
                    {loadingFactors ? <div className="text-sm text-ink-mid">Loading…</div> : (
                      mfaFactors.length === 0 ? <div className="text-sm text-ink-mid">No enrolled 2FA factors.</div> : (
                        <ul className="space-y-2">
                          {mfaFactors.map((f: any) => (
                            <li key={f.id} className="flex items-center justify-between bg-bg3 border border-line rounded-md p-2">
                              <div>
                                <div className="font-medium">{f.friendly_name || f.factor_type || 'Factor'}</div>
                                <div className="text-sm text-ink-mid">{f.status || 'unknown'}</div>
                              </div>
                              <div>
                                <button className="btn-ghost text-sm" onClick={async () => {
                                  if (!confirm('Unenroll this factor?')) return;
                                  try { await unenrollMfaFactor(f.id); toast('Factor removed', 'success'); await fetchMfaFactors(); }
                                  catch (e) { toast(`Could not remove factor: ${(e as Error).message}`, 'error'); }
                                }}>Remove</button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* ── Account Stats ────────────────────────────────── */}
        <Panel title="Account Stats">
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Transactions', value: transactions.length },
              { label: 'Budgets',      value: budgets.length },
              { label: 'Goals',        value: goals.length },
              { label: 'Debts',        value: debts.length },
              { label: 'Assets',       value: assets.length },
              { label: 'Members',      value: members.length },
              { label: 'Income txns',  value: transactions.filter(t => t.type === 'income').length },
              { label: 'Expense txns', value: transactions.filter(t => t.type === 'expense').length },
            ].map(s => (
              <div key={s.label} className="bg-bg3 border border-line rounded-md p-3 text-center">
                <div className="text-2xl font-semibold text-coral">{s.value}</div>
                <div className="font-mono text-[0.62rem] tracking-wider text-ink-dim uppercase mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </Panel>

      </div>
    </div>
  );
}
