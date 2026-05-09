// Placeholder pages for the v6 React migration.
// Each shows a "migration in progress" message and links to the v5
// vanilla version where the feature is fully functional.
//
// Migration TODO (in priority order):
//  1. Settings — profile, theme cards, currency rates table, sync
//  2. Net Worth — assets/liabilities split, ratios
//  3. Debts — list, payoff strategy, EMI breakdown, payment recording
//  4. Goals — list with inline progress
//  5. Budgets — grid with status pills
//  6. Splits — IOU panels, settlement flow
//  7. Help — collapsible accordion sections

import { useTranslation } from '../hooks';
import { Panel } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';

const PAGE_META: Record<string, { icon: string; title: string; description: string; v5Path: string }> = {
  budgets:  { icon: '◎',  title: 'Budgets',   description: 'Monthly spending limits by category, with status pills and color-coded progress bars.', v5Path: '/index.html#budgets' },
  goals:    { icon: '◇',  title: 'Goals',     description: '6 goal types with inline progress updates and completion celebration.',                  v5Path: '/index.html#goals' },
  splits:   { icon: '🤝', title: 'Splits',    description: 'Group bills with N participants. Outstanding IOUs tracked per person, one-click settle.',v5Path: '/index.html#splits' },
  debts:    { icon: '🏦', title: 'Debts',     description: 'Avalanche/Snowball strategies, payoff calculator, EMI breakdown into interest + principal.', v5Path: '/index.html#debts' },
  networth: { icon: '⚖️', title: 'Net Worth', description: 'Balance sheet with 4 financial ratios (liquidity, debt-to-asset, emergency coverage, savings ratio).', v5Path: '/index.html#networth' },
  settings: { icon: '⚙️', title: 'Settings',  description: 'Profile, theme cards, language, currency, exchange rates, sync, account stats.',          v5Path: '/index.html#settings' },
  help:     { icon: '📖', title: 'Help',      description: '17 collapsible accordion sections — searchable. v5 features fully documented.',          v5Path: '/index.html#help' },
};

interface Props { page: keyof typeof PAGE_META; }

export default function Stubs({ page }: Props) {
  const { t } = useTranslation();
  const meta = PAGE_META[page];

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5">{t(page)}</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            React migration in progress
          </p>
        </div>
      </div>

      <Panel>
        <div className="px-6 py-12 text-center">
          <div className="text-5xl mb-4 opacity-70">{meta.icon}</div>
          <h2 className="display-italic text-3xl text-ink mb-3">{meta.title}</h2>
          <p className="text-ink-mid max-w-md mx-auto leading-relaxed mb-6">{meta.description}</p>
          <div className="bg-coral-tint border border-coral/30 rounded-md px-5 py-4 max-w-md mx-auto text-left">
            <div className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-terra mb-1.5">
              v6 React Migration
            </div>
            <p className="text-[0.84rem] text-ink-mid leading-relaxed">
              This page is fully functional in the v5 vanilla shell. The data layer, state store,
              and design tokens are all migrated — wiring up this page is now a matter of porting
              the existing render logic. All the underlying functions in <code className="font-mono text-coral bg-bg3 px-1.5 py-0.5 rounded">lib/calculations.ts</code> already work for it.
            </p>
          </div>
        </div>
      </Panel>

      <div className="mt-3.5">
        <Panel title="What's already wired in v6">
          <div className="grid sm:grid-cols-2 gap-2 p-4">
            {[
              ['✓ Vite + React 18 + TypeScript', 'Dev server, HMR, bundle'],
              ['✓ Tailwind CSS with paper-warm tokens', 'Light/dark/system themes'],
              ['✓ Zustand global store', 'Reactive state, actions, persistence'],
              ['✓ DataAdapter (TypeScript)', 'Multi-profile localStorage today, Supabase-ready'],
              ['✓ Recharts integration', 'Area, Bar, Donut charts on Reports + Dashboard'],
              ['✓ React Router v6', 'Deep-linkable URLs, nested routes ready'],
              ['✓ Lucide React icons', '1,400+ icons, tree-shakeable'],
              ['✓ All v5 calculations ported', 'Pulse Score, splits, EMI, ratios, insights'],
            ].map(([title, sub]) => (
              <div key={title} className="bg-bg3 border border-line rounded-md p-3">
                <div className="text-[0.84rem] font-semibold text-ink mb-0.5">{title}</div>
                <div className="font-mono text-[0.62rem] tracking-wider text-ink-dim">{sub}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-6 text-center">
        <EmptyState
          icon="→"
          message="See VERSIONS.md for the full v6 migration plan and remaining work"
        />
      </div>
    </div>
  );
}
