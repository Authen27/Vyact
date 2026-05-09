import { useState } from 'react';
import { useTranslation } from '../hooks';

interface Section { q: string; a: string | JSX.Element; }
const SECTIONS: Section[] = [
  {
    q: 'Getting started — how do I set up FinFlow?',
    a: 'Sign up with your email, complete the 4-step onboarding (template → household size → primary concern → currency), and you\'re in. Your first household is created automatically. Add transactions from the Transactions page or use keyboard shortcut N.',
  },
  {
    q: 'What is the Family Pulse Score?',
    a: 'A single 0–100 health score for your finances, computed from 5 components: Budget Compliance (25%), Savings Rate (25%), Goal Progress (15%), Expense Trend (15%), Debt Health (20%). Excellent ≥ 80 · Good ≥ 65 · Fair ≥ 45 · Needs Work below that.',
  },
  {
    q: 'How do budgets work?',
    a: 'Create a budget per category with a monthly spending limit. The Budgets page shows real-time progress bars coloured green (on-track), amber (≥ 80%), red (over). Limits are per-calendar-month and reset on the 1st.',
  },
  {
    q: 'How do goals work?',
    a: 'Six goal types: Emergency Fund, Savings, Debt Payoff, Investment, Purchase, Custom. Add a target amount and optional deadline. Click "+ Progress" to record a contribution. Mark goals complete when you hit the target.',
  },
  {
    q: 'How does debt management and the payoff calculator work?',
    a: 'Add each debt with its balance, interest rate, and minimum payment. Choose Avalanche (highest APR first — saves the most interest) or Snowball (smallest balance first — faster wins). The Debts page ranks them by strategy, shows months to payoff, and splits each payment into interest vs principal portions. Record a payment and the balance updates automatically.',
  },
  {
    q: 'What is the Net Worth page?',
    a: 'A balance sheet: all assets minus all liabilities. Assets are grouped by liquidity (Liquid · Short-term · Long-term). Four ratios are shown: Liquidity Ratio, Debt-to-Asset ratio, Emergency Coverage (months of expenses covered by liquid assets), and monthly Savings Ratio.',
  },
  {
    q: 'How do split payments work?',
    a: 'When adding a transaction, mark it as a split. Enter each participant\'s name and their share of the bill. The Splits page tracks who has paid and who owes. Click "Mark paid" or "Settle" to clear individual balances. The IOU summary at the top shows total owed to you and total you owe.',
  },
  {
    q: 'What does the Planner do?',
    a: 'A deterministic (no AI) rules engine that evaluates your transactions, budgets, goals, debts, and assets to generate prioritised recommendations across five domains: Income, Expenses, Investments, Debt, Tax. Severity levels: Critical · Watch · Info.',
  },
  {
    q: 'What is the Recurring page for?',
    a: 'Manage recurring transaction schedules (weekly, monthly, yearly, custom day-of-month). Enable auto-confirm so transactions are added automatically, or set reminder lead days (1, 3, or 7 days before due) to get notified. Pause or delete schedules any time.',
  },
  {
    q: 'How does multi-currency work?',
    a: 'Every transaction, budget, debt, and asset stores its original currency. All totals convert to your base currency using the editable exchange rate table in Settings → Exchange Rates. Rates are USD-based and updated manually.',
  },
  {
    q: 'What is multi-household?',
    a: 'You can create multiple households (e.g. Personal, Family, Business) and switch between them. Each household has isolated data. Invite others via email — they get a role (Admin, Member, Viewer, Child) with matching permissions enforced by database-level RLS.',
  },
  {
    q: 'How do I back up and restore my data?',
    a: 'Settings → Sync & Backup → Download Backup downloads a full JSON snapshot. Keep this somewhere safe. CSV export gives a flat transactions file for spreadsheets. Cloud sync (when Supabase is connected) keeps data safe automatically.',
  },
  {
    q: 'Keyboard shortcuts',
    a: (
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[0.84rem]">
        {[['N','Add transaction'],['G','Add goal'],['D','Add debt'],['A','Add asset'],['/','Focus search'],['Esc','Close modal / blur input']].map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <kbd className="font-mono text-[0.72rem] bg-bg3 border border-line rounded px-2 py-0.5 text-ink">{k}</kbd>
            <span className="text-ink-mid">{v}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    q: 'Themes and appearance',
    a: 'Three themes: Paper Warm (cream & coral, default), Dark (warm palette on dark background), System (follows OS preference). Switch in Settings → Appearance. The theme is saved locally and persists across sessions.',
  },
  {
    q: 'Privacy and security',
    a: 'When cloud is enabled, all data is stored in Supabase with row-level security — you can only access your own household\'s data. Auth uses PKCE flow. Passwords are hashed by Supabase Auth. Local mode keeps everything in browser localStorage — no data leaves your device.',
  },
  {
    q: 'How do I change language?',
    a: 'Settings → Language & Currency → Language. Six languages supported: English, Español, Français, हिन्दी, Deutsch, 日本語. The UI switches immediately. Missing keys fall back to English.',
  },
  {
    q: 'Transaction types — what is the difference between expense, income, investment, and transfer?',
    a: 'Expense and Income are counted in your cash-flow totals and Pulse Score. Investment records an outflow that links to an Asset (e.g. buying stocks). Transfer moves money between accounts — it is neutral and excluded from income/expense totals. Mark any transaction as Excluded (🔒 Private) to hide it from all aggregations.',
  },
];

export default function Help() {
  const { t } = useTranslation();
  const [open, setOpen]   = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? SECTIONS.filter(s => s.q.toLowerCase().includes(query.toLowerCase()) || (typeof s.a === 'string' && s.a.toLowerCase().includes(query.toLowerCase())))
    : SECTIONS;

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5">{t('help')}</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            {SECTIONS.length} topics · searchable
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          className="input w-full"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(null); }}
          placeholder="Search help topics…"
        />
      </div>

      {/* Accordion */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-ink-mid">
            No topics match "{query}"
          </div>
        )}
        {filtered.map((s, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="bg-bg border border-line rounded-xl overflow-hidden">
              <button
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-bg3 transition-colors"
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="font-semibold text-ink text-[0.9rem] leading-snug">{s.q}</span>
                <span className="text-ink-dim text-lg flex-shrink-0 transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▾
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-line px-5 py-4 text-[0.84rem] text-ink-mid leading-relaxed">
                  {typeof s.a === 'string' ? s.a : s.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer tip */}
      <div className="mt-8 text-center">
        <p className="text-[0.8rem] text-ink-dim">
          Something missing? Use the <span className="font-semibold text-ink">Planner</span> for personalised financial recommendations,
          or the <span className="font-semibold text-ink">Chat</span> for AI-powered answers about your data.
        </p>
      </div>
    </div>
  );
}
