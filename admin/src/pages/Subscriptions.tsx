import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { MOCK_SUBSCRIPTIONS, MOCK_USERS } from '../lib/mockData';
import type { SubStatus, SubTier } from '../types';

const STATUS_COLOR: Record<SubStatus, string> = {
  active:    'bg-positive/15 text-positive',
  past_due:  'bg-warn/15 text-warn',
  trialing:  'bg-info/15 text-info',
  canceled:  'bg-danger/15 text-danger',
};

const TIER_PRICES: Record<SubTier, number> = { free: 0, family: 18, premium: 42, enterprise: 0 };

const PIE_COLOR: Record<SubTier, string> = {
  free:       'hsl(var(--ink-dim))',
  family:     'hsl(var(--claude))',
  premium:    'hsl(var(--warn))',
  enterprise: 'hsl(var(--info))',
};

export default function Subscriptions() {
  const usersById = useMemo(() => new Map(MOCK_USERS.map(u => [u.id, u])), []);

  const tierCounts = useMemo(() => {
    const counts: Record<SubTier, number> = { free: 0, family: 0, premium: 0, enterprise: 0 };
    for (const u of MOCK_USERS) counts[u.subscriptionTier]++;
    return counts;
  }, []);

  const mrr = MOCK_SUBSCRIPTIONS
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + s.monthlyAmount, 0);

  const arr = mrr * 12;
  const pastDue = MOCK_SUBSCRIPTIONS.filter(s => s.status === 'past_due').length;

  const pieData = (Object.entries(tierCounts) as [SubTier, number][])
    .map(([tier, count]) => ({ tier, count, fill: PIE_COLOR[tier] }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="display-serif text-3xl text-ink mb-1">Subscriptions</h1>
        <p className="text-ink-mid text-[0.92rem]">
          {MOCK_SUBSCRIPTIONS.length} active subscriptions · {pastDue} past due · ${mrr.toLocaleString()} MRR
        </p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Metric label="MRR" value={`$${mrr.toLocaleString()}`} />
        <Metric label="ARR (projected)" value={`$${arr.toLocaleString()}`} />
        <Metric label="Active subs" value={MOCK_SUBSCRIPTIONS.filter(s => s.status === 'active').length} />
        <Metric label="Past due" value={pastDue} tone={pastDue > 0 ? 'danger' : 'positive'} />
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-3">
        {/* Tier mix donut */}
        <div className="panel p-4">
          <div className="mono-label mb-3">Tier mix</div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="count" cx="50%" cy="50%" innerRadius={50} outerRadius={75}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-3">
            {pieData.map(d => (
              <div key={d.tier} className="flex justify-between items-center text-[0.78rem]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                  <span className="capitalize text-ink">{d.tier}</span>
                </div>
                <span className="font-mono text-ink-mid">{d.count} · ${(TIER_PRICES[d.tier] * d.count).toLocaleString()}/mo</span>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription list */}
        <div className="panel overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 bg-elev border-b border-line2 mono-label">
            <div>Customer</div><div>Tier</div><div>Status</div><div className="text-right">Monthly</div><div className="text-right">Renews</div>
          </div>
          <div className="divide-y divide-line max-h-[400px] overflow-y-auto">
            {MOCK_SUBSCRIPTIONS.slice(0, 50).map(s => {
              const u = usersById.get(s.userId);
              if (!u) return null;
              return (
                <div key={s.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 row-hover items-center">
                  <div className="min-w-0">
                    <div className="text-[0.84rem] font-semibold text-ink truncate">{u.name}</div>
                    <div className="font-mono text-[0.62rem] text-ink-dim truncate">{u.email}</div>
                  </div>
                  <div className="font-mono text-[0.78rem] text-ink-mid capitalize">{s.tier}</div>
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded-pill font-mono text-[0.55rem] tracking-wider uppercase ${STATUS_COLOR[s.status]}`}>
                      {s.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="font-mono text-[0.84rem] text-ink text-right">${s.monthlyAmount}</div>
                  <div className="font-mono text-[0.7rem] text-ink-dim text-right">{s.renewsAt}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 text-center font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
        Stripe webhook integration ships in v8.1 — current data is mocked
      </div>
    </div>
  );
}

function Metric({ label, value, tone = 'ink' }: { label: string; value: string | number; tone?: 'ink' | 'positive' | 'warn' | 'danger' }) {
  const cls = tone === 'positive' ? 'text-positive' : tone === 'warn' ? 'text-warn' : tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <div className="panel p-4">
      <div className="mono-label mb-1.5">{label}</div>
      <div className={`display-serif text-[1.6rem] leading-none ${cls}`}>{value}</div>
    </div>
  );
}
