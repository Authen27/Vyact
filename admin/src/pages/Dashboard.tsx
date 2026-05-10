// FinFlow Admin v8 — NorthStar Dashboard (live Supabase)
// Every number on this page is computed live by the admin_dashboard_kpis()
// SQL function or the admin_weekly_trend(weeks) trend RPC. Where a metric
// requires event tracking we don't have yet (D7/D90 retention, Pulse-improved%,
// NPS), the card shows "—" with a tooltip explaining what's needed.

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Users, Activity, FileText, Heart, RefreshCw } from 'lucide-react';
import { fetchDashboardKpis, fetchWeeklyTrend, type DashboardKpis, type WeeklyTrendRow } from '../lib/adminApi';

const hsl = (v: string) => `hsl(var(--${v}))`;

export default function Dashboard() {
  const [kpis,  setKpis]  = useState<DashboardKpis | null>(null);
  const [trend, setTrend] = useState<WeeklyTrendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const [k, t] = await Promise.all([fetchDashboardKpis(), fetchWeeklyTrend(12)]);
        if (cancelled) return;
        setKpis(k); setTrend(t);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshTick]);

  const trendData = trend.map(t => ({
    week: t.week_start.slice(5),       // MM-DD
    signups: t.signups,
    active:  t.active_users,
    txns:    t.new_txns,
  }));

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-[0.6rem] tracking-[0.18em] uppercase text-claude mb-1.5">NorthStar Metric</div>
          <h1 className="display-serif text-4xl text-ink mb-1">Active Households per Week</h1>
          <p className="text-ink-mid text-[0.92rem]">
            A household with at least one transaction recorded in the past 7 days.
            Live count from the production database — not seeded.
          </p>
        </div>
        <button onClick={() => setRefreshTick(t => t + 1)}
          className="font-mono text-[0.6rem] tracking-wider uppercase px-3 py-2 border border-line rounded-md hover:bg-elev transition flex items-center gap-1.5">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="panel p-4 mb-5 border-danger/30 text-danger text-sm">
          Could not load metrics: {error}
        </div>
      )}

      {/* Hero */}
      <div className="panel p-7 mb-5">
        <div className="grid lg:grid-cols-[280px_1fr] gap-7 items-center">
          <div>
            <div className="display-serif text-[5rem] leading-none text-claude mb-1">
              {loading ? '…' : (kpis?.activeHouseholds7d ?? '—')}
            </div>
            <div className="font-mono text-[0.65rem] tracking-[0.18em] uppercase text-ink-dim">
              Active households · last 7 days
            </div>
            {kpis && (
              <div className="mt-3 text-[0.78rem] text-ink-mid">
                {kpis.activeHouseholds7d} of {kpis.totalHouseholds} total · {' '}
                {kpis.totalHouseholds > 0
                  ? Math.round((kpis.activeHouseholds7d / kpis.totalHouseholds) * 100)
                  : 0}% activation
              </div>
            )}
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={hsl('claude')} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={hsl('claude')} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={hsl('line')} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: hsl('ink-dim') }} />
                <YAxis tick={{ fontSize: 10, fill: hsl('ink-dim') }} />
                <Tooltip contentStyle={{ background: hsl('surface'), border: `1px solid ${hsl('line')}`, fontSize: 12 }} />
                <Area type="monotone" dataKey="active" stroke={hsl('claude')} fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live KPI grid — only what we can really compute */}
      <h2 className="font-mono text-[0.62rem] tracking-[0.16em] uppercase text-ink-dim mb-2.5">Live metrics — production database</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi  label="Total users"        value={kpis?.totalUsers}       loading={loading} icon={Users} />
        <Kpi  label="Total households"   value={kpis?.totalHouseholds}  loading={loading} icon={Users} />
        <Kpi  label="Multi-member %"     value={kpis?.multiMemberPct}   loading={loading} suffix="%" />
        <Kpi  label="Active 7d (users)"  value={kpis?.activeUsers7d}    loading={loading} icon={Activity} />
        <Kpi  label="Signups · 7d"       value={kpis?.signups7d}        loading={loading} />
        <Kpi  label="Signups · 30d"      value={kpis?.signups30d}       loading={loading} />
        <Kpi  label="Transactions · 7d"  value={kpis?.transactions7d}   loading={loading} />
        <Kpi  label="Total transactions" value={kpis?.totalTransactions} loading={loading} />
        <Kpi  label="Published articles" value={kpis?.publishedArticles} loading={loading} icon={FileText} />
        <Kpi  label="Content favorites"  value={kpis?.contentFavorites} loading={loading} icon={Heart} />
        <Kpi  label="Paid subscriptions" value={kpis?.paidSubscriptions} loading={loading} />
        <Kpi  label="MRR (USD)"          value={kpis?.mrr}              loading={loading} prefix="$" />
      </div>

      {/* Aspirational metrics — explicit unavailable state */}
      <h2 className="font-mono text-[0.62rem] tracking-[0.16em] uppercase text-ink-dim mb-2.5">
        Cohort metrics — require event tracking <span className="text-warn">(not wired yet)</span>
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiUnavailable label="Time-to-first-txn"     hint="median seconds from sign-up to 1st transaction" />
        <KpiUnavailable label="D7 retention %"        hint="users active 7 days after sign-up" />
        <KpiUnavailable label="D90 retention %"       hint="users active 90 days after sign-up" />
        <KpiUnavailable label="Pulse improved 30d %"  hint="users whose Pulse Score rose vs 30d ago" />
        <KpiUnavailable label="Reminder confirmed %"  hint="recurring-transaction confirmations" />
        <KpiUnavailable label="Recs followed %"       hint="Planner recommendations actioned" />
        <KpiUnavailable label="Chat satisfaction"     hint="thumbs-up rate on AI chat answers" />
        <KpiUnavailable label="NPS"                   hint="-100 to +100 from in-app survey" />
      </div>

      {/* Trend charts */}
      <div className="grid lg:grid-cols-3 gap-3 mb-6">
        <ChartCard title="Weekly signups">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={hsl('line')} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: hsl('ink-dim') }} />
              <YAxis tick={{ fontSize: 10, fill: hsl('ink-dim') }} />
              <Tooltip contentStyle={{ background: hsl('surface'), border: `1px solid ${hsl('line')}`, fontSize: 12 }} />
              <Bar dataKey="signups" fill={hsl('claude')} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Weekly active users">
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={hsl('positive')} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={hsl('positive')} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={hsl('line')} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: hsl('ink-dim') }} />
              <YAxis tick={{ fontSize: 10, fill: hsl('ink-dim') }} />
              <Tooltip contentStyle={{ background: hsl('surface'), border: `1px solid ${hsl('line')}`, fontSize: 12 }} />
              <Area type="monotone" dataKey="active" stroke={hsl('positive')} fill="url(#g2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Weekly transactions">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={hsl('line')} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: hsl('ink-dim') }} />
              <YAxis tick={{ fontSize: 10, fill: hsl('ink-dim') }} />
              <Tooltip contentStyle={{ background: hsl('surface'), border: `1px solid ${hsl('line')}`, fontSize: 12 }} />
              <Bar dataKey="txns" fill={hsl('warn')} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <p className="text-[0.7rem] text-ink-dim font-mono">
        Computed at: {kpis?.computedAt ? new Date(kpis.computedAt).toISOString() : '—'} ·
        Source: <code className="ml-1">public.admin_dashboard_kpis()</code>
      </p>
    </div>
  );
}

interface KpiProps {
  label:   string;
  value?:  number | null;
  loading: boolean;
  prefix?: string;
  suffix?: string;
  // Lucide React icons are ForwardRefExoticComponent — accept anything
  // renderable that takes a size + className.
  icon?:   React.ComponentType<any>;
}
function Kpi({ label, value, loading, prefix, suffix, icon: Icon }: KpiProps) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="mono-label">{label}</div>
        {Icon && <Icon size={12} className="text-ink-dim" />}
      </div>
      <div className="display-serif text-[1.6rem] leading-none text-ink">
        {loading ? <span className="text-ink-dim">…</span>
          : value === null || value === undefined ? '—'
          : `${prefix ?? ''}${typeof value === 'number' ? value.toLocaleString() : value}${suffix ?? ''}`}
      </div>
    </div>
  );
}

function KpiUnavailable({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="panel p-4 opacity-70" title={hint}>
      <div className="mono-label mb-1">{label}</div>
      <div className="display-serif text-[1.6rem] leading-none text-ink-dim">—</div>
      <div className="text-[0.62rem] text-ink-dim mt-1 leading-snug">{hint}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="mono-label mb-2">{title}</div>
      {children}
    </div>
  );
}
