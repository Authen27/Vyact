import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useStore } from '../store';
import { TEMPLATES, hydrateTemplate, type TemplateKey } from '../lib/templates';
import { CURRENCIES, LOCALES } from '../constants';
import Button from '../components/ui/Button';

type Step = 1 | 2 | 3 | 4;
type Concern = 'spending' | 'debt' | 'savings' | 'retirement';

const CONCERN_OPTIONS: { key: Concern; icon: string; label: string }[] = [
  { key: 'spending',   icon: '👀', label: 'Track spending' },
  { key: 'debt',       icon: '⬇️', label: 'Pay off debt' },
  { key: 'savings',    icon: '🎯', label: 'Save for a goal' },
  { key: 'retirement', icon: '🏖️', label: 'Plan retirement' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const adapter = useStore(s => s.adapter);
  const currentHouseholdId = useStore(s => s.currentHouseholdId);
  const updateProfile = useStore(s => s.updateProfile);
  const refresh = useStore(s => s.refresh);
  const toast = useStore(s => s.toast);

  const [step, setStep] = useState<Step>(1);
  const [template, setTemplate] = useState<TemplateKey | null>(null);
  const [householdSize, setHouseholdSize] = useState<1|2|3|4>(2);
  const [concern, setConcern] = useState<Concern | null>(null);
  const [currency, setCurrency] = useState<string>(() => navigator.language?.includes('IN') ? 'INR' : navigator.language?.includes('GB') ? 'GBP' : 'USD');
  const [language, setLanguage] = useState<string>(() => navigator.language?.split('-')[0] in LOCALES ? navigator.language.split('-')[0] : 'en');
  const [submitting, setSubmitting] = useState(false);

  async function complete() {
    if (!template) return;
    setSubmitting(true);
    const meta = TEMPLATES[template];
    const { budgets, goals, debts } = hydrateTemplate(template, currency);

    // Pre-populate per template — first-run only
    for (const b of budgets) await adapter.upsert('budgets', currentHouseholdId, b);
    for (const g of goals)   await adapter.upsert('goals',   currentHouseholdId, g);
    for (const d of debts)   await adapter.upsert('debts',   currentHouseholdId, d);

    await updateProfile({
      template,
      primaryConcern: concern || meta.primaryConcern,
      baseCurrency: currency,
      language,
      household: meta.key === 'self_employed' ? 'business' : meta.key === 'family' ? 'family' : 'personal',
      onboardedAt: new Date().toISOString(),
    });
    await refresh();
    toast(`Welcome — ${meta.label} template applied`, 'success');
    navigate('/dashboard');
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-[150] bg-bg overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="display-italic text-3xl text-coral mb-1">FinFlow</div>
        <div className="font-mono text-[0.6rem] tracking-[0.18em] uppercase text-ink-dim mb-8">Step {step} of 4 · 90 seconds</div>

        {/* Progress bar */}
        <div className="bg-bg3 h-1 rounded-full overflow-hidden mb-8">
          <div className="h-full bg-coral transition-[width] duration-500" style={{ width: `${step / 4 * 100}%` }} />
        </div>

        {step === 1 && (
          <div>
            <h1 className="display-italic text-3xl text-ink mb-2">Which best describes you?</h1>
            <p className="text-ink-mid mb-7">Pick the template closest to your situation. You can change this later.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {(Object.keys(TEMPLATES) as TemplateKey[]).map(k => {
                const t = TEMPLATES[k];
                return (
                  <button key={k} onClick={() => setTemplate(k)}
                    className={`text-left p-4 rounded-md border-2 transition-all ${template === k ? 'border-coral bg-coral-tint' : 'border-line hover:border-line2 bg-bg2'}`}>
                    <div className="text-2xl mb-2">{t.icon}</div>
                    <div className="font-semibold text-ink mb-0.5">{t.label}</div>
                    <div className="text-[0.78rem] text-ink-mid leading-snug">{t.description}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end mt-7">
              <Button onClick={() => setStep(2)} disabled={!template}>Next <ArrowRight size={14} /></Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="display-italic text-3xl text-ink mb-2">How many people in your household?</h1>
            <p className="text-ink-mid mb-7">This sets up the Members section. You can edit later.</p>
            <div className="grid grid-cols-4 gap-3 mb-7">
              {([1,2,3,4] as const).map(n => (
                <button key={n} onClick={() => setHouseholdSize(n)}
                  className={`p-6 rounded-md border-2 transition-all ${householdSize === n ? 'border-coral bg-coral-tint' : 'border-line hover:border-line2 bg-bg2'}`}>
                  <div className="display-italic text-3xl text-ink">{n}{n === 4 ? '+' : ''}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Next <ArrowRight size={14} /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="display-italic text-3xl text-ink mb-2">What's your primary financial concern right now?</h1>
            <p className="text-ink-mid mb-7">This reorders your dashboard for what matters most to you.</p>
            <div className="grid sm:grid-cols-2 gap-3 mb-7">
              {CONCERN_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => setConcern(opt.key)}
                  className={`text-left p-4 rounded-md border-2 transition-all ${concern === opt.key ? 'border-coral bg-coral-tint' : 'border-line hover:border-line2 bg-bg2'}`}>
                  <div className="text-2xl mb-2">{opt.icon}</div>
                  <div className="font-semibold text-ink">{opt.label}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)} disabled={!concern}>Next <ArrowRight size={14} /></Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="display-italic text-3xl text-ink mb-2">Currency &amp; language</h1>
            <p className="text-ink-mid mb-7">Defaults from your browser. Change anytime in Settings.</p>
            <div className="space-y-4 mb-7">
              <div>
                <label className="font-mono text-[0.6rem] tracking-[0.12em] uppercase text-ink-mid mb-1.5 block">Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                  className="w-full bg-bg3 border border-line rounded-md px-3 py-2.5 font-ui">
                  {Object.entries(CURRENCIES).map(([code, c]) =>
                    <option key={code} value={code}>{c.symbol} {code} — {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-mono text-[0.6rem] tracking-[0.12em] uppercase text-ink-mid mb-1.5 block">Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-bg3 border border-line rounded-md px-3 py-2.5 font-ui">
                  {Object.entries(LOCALES).map(([code, l]) =>
                    <option key={code} value={code}>{l.name} ({code.toUpperCase()})</option>)}
                </select>
              </div>
            </div>

            {/* Summary */}
            {template && (
              <div className="bg-coral-tint border border-coral/30 rounded-md p-4 mb-7">
                <div className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-terra mb-2">You'll start with</div>
                <ul className="text-[0.84rem] text-ink space-y-1">
                  <li><Check size={12} className="inline text-sage mr-1.5" /> {TEMPLATES[template].label} template ({TEMPLATES[template].pages.length} pages)</li>
                  <li><Check size={12} className="inline text-sage mr-1.5" /> {TEMPLATES[template].starterBudgets.length} pre-populated budgets</li>
                  <li><Check size={12} className="inline text-sage mr-1.5" /> {TEMPLATES[template].starterGoals.length} starter goals</li>
                  {TEMPLATES[template].starterDebts.length > 0 && (
                    <li><Check size={12} className="inline text-sage mr-1.5" /> {TEMPLATES[template].starterDebts.length} debt template ready to fill in</li>
                  )}
                  <li><Check size={12} className="inline text-sage mr-1.5" /> Pulse Score weighted for your situation</li>
                </ul>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={complete} disabled={submitting}>
                {submitting ? 'Setting up…' : 'Get started'} <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        )}

        <button onClick={() => { setTemplate('family'); setConcern('spending'); complete(); }}
          className="font-mono text-[0.6rem] tracking-[0.1em] uppercase text-ink-dim hover:text-ink mt-12 block mx-auto">
          Skip — use Family with Kids template
        </button>
      </div>
    </div>
  );
}
