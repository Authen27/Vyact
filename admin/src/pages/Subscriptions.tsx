// FinFlow Admin — Subscriptions (live public.subscriptions)
// The subscriptions table exists in production but is intentionally empty
// until Stripe webhooks are wired in admin v1.1.0. This page reflects that
// honestly: real query, real (zero) results, "billing not wired" callout.

import { useEffect, useMemo, useState } from 'react';
import { CreditCard, RefreshCw, Info } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { fetchAllSubscriptions, type AdminSubscriptionRow } from '../lib/adminApi';

const TIER_COLOR = {
  free:       '#9CA3AF',
  family:     '#85A88A',
  premium:    '#E26D5C',
  enterprise: '#6E4555',
} as const;

const STATUS_COLOR: Record<AdminSubscriptionRow['status'], string> = {
  active:    'bg-positive/15 text-positive',
  past_due:  'bg-warn/15 text-warn',
  canceled:  'bg-line2 text-ink-dim',
  trialing:  'bg-info/15 text-info',
};

const hsl = (v: string) => `hsl(var(--${v}))`;

export default function Subscriptions() {
  const [rows, setRows]       = useState<AdminSubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tick, setTick]       = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const data = await fetchAllSubscriptions();
        if (!cancelled) setRows(data);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const stats = useMemo(() => {
    const active = rows.filter(r => r.status === 'active');
    const mrr    = active.reduce((s, r) => s + Number(r.monthly_amount), 0);
    const arr    = mrr * 12;
    const tierMix = (['free','family','premium','enterprise'] as const).map(tier => ({
      tier,
      count: rows.filter(r => r.tier === tier).length,
    }));
    const failures = rows.reduce((s, r) => s + r.failure_count, 0);
    return { active: active.length, mrr, arr, tierMix, failures };
  }, [rows]);

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="display-serif text-3xl text-ink mb-1">Subscriptions</h1>
          <p className="text-ink-mid text-[0.92rem]">
            {rows.length} subscription{rows.length === 1 ? '' : 's'} · {stats.active} active · live from <code className="font-mono">public.subscriptions</code>
          </p>
        </div>
        <button onClick={() => setTick(t => t + 1)}
          className="font-mono text-[0.6rem] tracking-wider uppercase px-3 py-2 border border-line rounded-md hover:bg-elev transition flex items-center gap-1.5">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="panel p-4 mb-4 border-danger/30 text-danger text-sm">{error}</div>}

      {/* Honest "billing not wired" banner when the table is empty */}
      {!loading && rows.length === 0 && !error && (
        <div className="panel p-5 mb-5 border-info/40 bg-info/5">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-info flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-ink text-[0.95rem] mb-1">Billing not wired yet</div>
              <p className="text-[0.85rem] text-ink-mid leading-relaxed">
                The <code className="font-mono">subscriptions</code> table exists in production with the
                full schema (tier, status, MRR, Stripe sub id, failure count) but no Stripe
                webhooks are configured to populate it. Roadmap entry <strong>admin v1.1.0</strong>: wire{' '}
                <code className="font-mono">stripe-webhook</code> Edge Function to insert / update
                rows on <code className="font-mono">customer.subscription.*</code> events. No mock data
                shown — the empty state IS the truth.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Metric label="MRR (USD)"       value={`$${stats.mrr.toLocaleString()}`} />
        <Metric label="ARR (USD)"       value={`$${stats.arr.toLocaleString()}`} />
        <Metric label="Active subs"     value={String(stats.active)} tone="positive" />
        <Metric label="Failed payments" value={String(stats.failures)} tone={stats.failures ? 'warn' : undefined} />
      </div>

      {/* Tier mix donut + list */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-3 mb-5">
        <div className="panel p-5">
          <div className="mono-label mb-3">Tier mix</div>
          {rows.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-ink-dim text-[0.78rem] text-center">
              No subscriptions yet
            </div>
          ) : (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.tierMix.filter(t => t.count > 0)}
                    dataKey="count" nameKey="tier" innerRadius={45} outerRadius={70}>
                    {stats.tierMix.filter(t => t.count > 0).map(t => (
                      <Cell key={t.tier} fill={TIER_COLOR[t.tier]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: hsl('surface'), border: `1px solid ${hsl('line')}`, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 space-y-1">
            {stats.tierMix.map(t => (
              <div key={t.tier} className="flex items-center justify-between text-[0.78rem]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: TIER_COLOR[t.tier] }} />
                  <span className="capitalize text-ink-mid">{t.tier}</span>
                </div>
                <span className="font-mono text-ink">{t.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 bg-elev border-b border-line2 mono-label">
            <div>User id</div><div>Tier</div><div>Status</div><div className="text-right">MRR</div><div>Renews</div>
          </div>
          <div className="divide-y divide-line">
            {loading && <div className="px-4 py-6 text-center text-ink-mid text-sm">Loading…</div>}
            {!loading && rows.length === 0 && (
              <div className="px-4 py-10 text-center text-ink-dim text-sm flex flex-col items-center gap-2">
                <CreditCard size={20} />
                <span>No subscriptions in the database.</span>
              </div>
            )}
            {rows.map(r => (
              <div key={r.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-3 row-hover items-center">
                <div className="font-mono text-[0.7rem] text-ink-mid truncate">{r.user_id.slice(0, 8)}…</div>
                <div className="font-mono text-[0.78rem] text-ink capitalize">{r.tier}</div>
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded-pill font-mono text-[0.55rem] tracking-wider uppercase ${STATUS_COLOR[r.status]}`}>
                    {r.status}
                  </span>
                </div>
                <div className="text-right font-mono text-[0.84rem] text-ink">
                  {r.monthly_amount > 0 ? `$${r.monthly_amount}` : '—'}
                </div>
                <div className="font-mono text-[0.74rem] text-ink-mid">
                  {r.renews_at ? new Date(r.renews_at).toLocaleDateString() : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[0.7rem] text-ink-dim font-mono">
        Source: <code>public.subscriptions</code> · awaiting Stripe webhook integration (admin v1.1.0)
      </p>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'warn' }) {
  const cls = tone === 'positive' ? 'text-positive' : tone === 'warn' ? 'text-warn' : 'text-ink';
  return (
    <div className="panel p-4">
      <div className="mono-label mb-1.5">{label}</div>
      <div className={`display-serif text-[1.6rem] leading-none ${cls}`}>{value}</div>
    </div>
  );
}
