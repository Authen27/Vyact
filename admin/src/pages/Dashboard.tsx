// NorthStar Dashboard — KPIs from FinFlow v7 PRD §08
// NorthStar metric: Active Households per Week (AHpW)

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Users, Activity, DollarSign, Heart } from 'lucide-react';
import { CURRENT_KPI, PREVIOUS_KPI, MOCK_KPI_HISTORY } from '../lib/mockData';

const hsl = (v: string) => `hsl(var(--${v}))`;

export default function Dashboard() {
  const c = CURRENT_KPI;
  const p = PREVIOUS_KPI;
  const ahpwDelta = ((c.activeHouseholdsPerWeek - p.activeHouseholdsPerWeek) / p.activeHouseholdsPerWeek * 100).toFixed(1);
  const trendData = MOCK_KPI_HISTORY.map(k => ({
    week: k.weekOf.slice(5),
    ahpw: k.activeHouseholdsPerWeek,
    signups: k.signups,
    mrr: k.mrr,
    nps: k.nps,
  }));

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="font-mono text-[0.6rem] tracking-[0.18em] uppercase text-claude mb-1.5">NorthStar Metric</div>
        <h1 className="display-serif text-4xl text-ink mb-1">Active Households per Week</h1>
        <p className="text-ink-mid text-[0.92rem]">
          A household where 2+ members logged in or recorded a transaction in the past 7 days.
          Single-user accounts count as 0.5. <strong className="text-ink">This is the heartbeat.</strong>
        </p>
      </div>

      {/* Hero metric */}
      <div className="panel p-7 mb-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-claude" />
        <div className="grid lg:grid-cols-[280px_1fr] gap-7 items-center">
          <div>
            <div className="display-serif text-[5.5rem] leading-none text-ink">
              {c.activeHouseholdsPerWeek.toLocaleString()}
            </div>
            <div className={`flex items-center gap-1.5 mt-2 font-mono text-[0.78rem] ${parseFloat(ahpwDelta) >= 0 ? 'text-positive' : 'text-danger'}`}>
              {parseFloat(ahpwDelta) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {parseFloat(ahpwDelta) >= 0 ? '+' : ''}{ahpwDelta}% vs last week
            </div>
            <div className="font-mono text-[0.62rem] tracking-[0.14em] uppercase text-ink-dim mt-3">
              Week of {c.weekOf}
            </div>
          </div>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="ahpwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={hsl('claude')} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={hsl('claude')} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 3" stroke={hsl('line')} vertical={false} />
                <XAxis dataKey="week" stroke={hsl('ink-dim')} tick={{ fontSize: 10 }} />
                <YAxis stroke={hsl('ink-dim')} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="ahpw" stroke={hsl('claude')} strokeWidth={2.5} fill="url(#ahpwGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="mb-6">
        <h2 className="display-serif text-2xl text-ink mb-3">Module KPIs</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Time to first txn" value={`${c.timeToFirstTxnSec}s`} target="< 90s" good={c.timeToFirstTxnSec < 90} />
          <Kpi label="Template completion" value={`${c.templateCompletionPct}%`} target="> 90%" good={c.templateCompletionPct > 90} />
          <Kpi label="D7 retention" value={`${c.d7RetentionPct}%`} target="> 60%" good={c.d7RetentionPct > 60} />
          <Kpi label="Sessions / user / wk" value={c.avgSessionsPerUser.toFixed(1)} target="> 4" good={c.avgSessionsPerUser > 4} />
          <Kpi label="Multi-member %" value={`${c.multiMemberPct}%`} target="> 40%" good={c.multiMemberPct > 40} />
          <Kpi label="D90 retention" value={`${c.d90RetentionPct}%`} target="> 50%" good={c.d90RetentionPct > 50} />
          <Kpi label="Pulse improved 30d" value={`${c.pulseImproved30dPct}%`} target="> 70%" good={c.pulseImproved30dPct > 70} />
          <Kpi label="Reminder confirmed" value={`${c.reminderConfirmedPct}%`} target="> 80%" good={c.reminderConfirmedPct > 80} />
          <Kpi label="Recs followed" value={`${c.recsFollowedPct}%`} target="> 25%" good={c.recsFollowedPct > 25} />
          <Kpi label="Chat satisfaction" value={`${c.avgChatSatisfaction.toFixed(2)} / 5`} target="> 4.2" good={c.avgChatSatisfaction > 4.2} />
          <Kpi label="Free → Paid" value={`${c.freeToPaidPct.toFixed(1)}%`} target="> 8%" good={c.freeToPaidPct > 8} />
          <Kpi label="NPS" value={c.nps} target="> 50" good={c.nps > 50} />
        </div>
      </div>

      {/* Three-up: Signups · MRR · NPS trends */}
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="panel">
          <div className="px-4 py-3 border-b border-line flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-info" />
              <span className="mono-label">Weekly signups</span>
            </div>
            <span className="display-serif text-xl text-ink">{c.signups}</span>
          </div>
          <div className="h-[140px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <Bar dataKey="signups" fill={hsl('info')} radius={[3, 3, 0, 0]} />
                <XAxis dataKey="week" stroke={hsl('ink-dim')} tick={{ fontSize: 9 }} />
                <Tooltip />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="px-4 py-3 border-b border-line flex justify-between items-center">
            <div className="flex items-center gap-2">
              <DollarSign size={14} className="text-positive" />
              <span className="mono-label">Monthly recurring revenue</span>
            </div>
            <span className="display-serif text-xl text-ink">${(c.mrr / 1000).toFixed(1)}K</span>
          </div>
          <div className="h-[140px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={hsl('positive')} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={hsl('positive')} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="mrr" stroke={hsl('positive')} strokeWidth={2} fill="url(#mrrGrad)" />
                <XAxis dataKey="week" stroke={hsl('ink-dim')} tick={{ fontSize: 9 }} />
                <Tooltip />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="px-4 py-3 border-b border-line flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Heart size={14} className="text-claude" />
              <span className="mono-label">NPS</span>
            </div>
            <span className="display-serif text-xl text-ink">{c.nps}</span>
          </div>
          <div className="h-[140px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="npsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={hsl('claude')} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={hsl('claude')} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="nps" stroke={hsl('claude')} strokeWidth={2} fill="url(#npsGrad)" />
                <XAxis dataKey="week" stroke={hsl('ink-dim')} tick={{ fontSize: 9 }} />
                <ReferenceLine y={50} stroke={hsl('warn')} strokeDasharray="2 3" label={{ value: 'Target', position: 'right', fontSize: 9, fill: hsl('warn') }} />
                <Tooltip />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 text-center font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
        <Activity size={12} className="inline mr-1" /> Mock data · Wires to PostHog + Stripe + Intercom in v8.1
      </div>
    </div>
  );
}

function Kpi({ label, value, target, good }: { label: string; value: string | number; target: string; good: boolean }) {
  return (
    <div className="panel p-4">
      <div className="mono-label mb-1.5">{label}</div>
      <div className="display-serif text-[1.6rem] leading-none text-ink mb-1">{value}</div>
      <div className={`font-mono text-[0.62rem] tracking-wide ${good ? 'text-positive' : 'text-warn'}`}>
        {good ? '✓' : '⚠'} target {target}
      </div>
    </div>
  );
}
