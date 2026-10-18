// Vyact Admin — AI Assistant Intelligence
// Reads admin_ai_usage_summary() (SECURITY DEFINER, admin-gated). Every figure is
// derived from the privacy-safe ai_usage table: intent + sentiment + length only,
// never any message content. Used to segment user types for the business.

import { useEffect, useState } from 'react';
import { Brain, RefreshCw, Users, MessageSquare, TrendingUp, ThumbsUp, ThumbsDown, type LucideIcon } from 'lucide-react';
import {
  fetchAiUsageSummary, fetchAiFeedbackSummary,
  type AiUsageSummary, type AiUsageSegment, type AiFeedbackSummary,
} from '../lib/adminApi';

const INTENT_COLORS: Record<string, string> = {
  spending: '#4A6FA5', savings: '#85A88A', budget: '#E8A87C', debt: '#C2543F',
  networth: '#6E4555', goals: '#3a9d6b', status: '#E26D5C', pulse: '#E26D5C', planning: '#b0823f',
  help: '#6B7C53', other: '#9a9088',
};
const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#3a9d6b', neutral: '#b08a4f', negative: '#c2543f',
};

function pct(n: number, total: number) { return total > 0 ? Math.round((n / total) * 100) : 0; }

// Business segmentation from engagement + sentiment + focus.
function segmentOf(s: AiUsageSegment): { label: string; color: string } {
  const sent = s.avgSentiment ?? 0;
  if (s.interactions >= 10) {
    return sent < -0.15
      ? { label: 'Power user · frustrated', color: '#c2543f' }
      : { label: 'Power user · advocate', color: '#3a9d6b' };
  }
  if (sent < -0.15) return { label: 'At-risk · negative tone', color: '#c2543f' };
  if (s.interactions >= 3) return { label: 'Engaged', color: '#4A6FA5' };
  return { label: 'Casual / new', color: '#9a9088' };
}

export default function Intelligence() {
  const [data, setData] = useState<AiUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const d = await fetchAiUsageSummary();
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  // v1.4.2 — Pip answer feedback loads on its own, so a failure here (e.g. before
  // the ai_feedback migration is deployed) never hides the usage metrics.
  const [feedback, setFeedback] = useState<AiFeedbackSummary | null>(null);
  const [feedbackError, setFeedbackError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setFeedbackError('');
    fetchAiFeedbackSummary()
      .then(d => { if (!cancelled) setFeedback(d); })
      .catch(e => { if (!cancelled) setFeedbackError((e as Error).message); });
    return () => { cancelled = true; };
  }, [tick]);

  const intents = data ? Object.entries(data.byIntent).sort(([, a], [, b]) => b - a) : [];
  const intentTotal = intents.reduce((s, [, c]) => s + c, 0);
  const sentiments = ['positive', 'neutral', 'negative'] as const;
  const sentTotal = data ? sentiments.reduce((s, k) => s + (data.bySentiment[k] || 0), 0) : 0;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-[0.6rem] tracking-[0.18em] uppercase text-claude mb-1.5 flex items-center gap-1.5">
            <Brain size={12} /> AI Assistant Intelligence
          </div>
          <h1 className="display-serif text-4xl text-ink mb-1">How members talk to Vyact</h1>
          <p className="text-ink-mid text-[0.92rem] max-w-2xl">
            Intent &amp; sentiment of Ask-Vyact conversations, used to segment user types.
            Privacy-safe — only intent, sentiment and message length are stored, never message content.
          </p>
        </div>
        <button onClick={() => setTick(t => t + 1)}
          className="font-mono text-[0.6rem] tracking-wider uppercase px-3 py-2 border border-line rounded-md hover:bg-elev transition flex items-center gap-1.5">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="panel p-4 mb-5 border-danger/30 text-danger text-sm">
          Could not load AI metrics: {error}
        </div>
      )}

      {!error && !loading && data && data.total === 0 && (
        <div className="panel p-6 mb-5 text-ink-mid text-sm">
          No AI interactions logged yet. Once members use <strong>Ask Vyact</strong> in the
          consumer app, intent and sentiment signals will appear here.
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Total interactions" value={data?.total} loading={loading} icon={MessageSquare} />
        <Kpi label="Distinct users"     value={data?.users} loading={loading} icon={Users} />
        <Kpi label="Last 7 days"        value={data?.last7} loading={loading} icon={TrendingUp} />
        <Kpi label="Last 30 days"       value={data?.last30} loading={loading} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        {/* Intent distribution */}
        <div className="panel p-5">
          <h2 className="font-mono text-[0.62rem] tracking-[0.16em] uppercase text-ink-dim mb-3">Intent distribution</h2>
          {intents.length === 0 && <div className="text-ink-mid text-sm">No data.</div>}
          <div className="space-y-2">
            {intents.map(([intent, count]) => (
              <div key={intent}>
                <div className="flex justify-between text-[0.8rem] mb-0.5">
                  <span className="text-ink capitalize">{intent}</span>
                  <span className="text-ink-mid font-mono">{count} · {pct(count, intentTotal)}%</span>
                </div>
                <div className="h-2 rounded-full bg-elev overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct(count, intentTotal)}%`, background: INTENT_COLORS[intent] || INTENT_COLORS.other }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment split */}
        <div className="panel p-5">
          <h2 className="font-mono text-[0.62rem] tracking-[0.16em] uppercase text-ink-dim mb-3">Sentiment</h2>
          {sentTotal === 0 && <div className="text-ink-mid text-sm">No data.</div>}
          {sentTotal > 0 && (
            <>
              <div className="flex h-3 rounded-full overflow-hidden mb-4">
                {sentiments.map(k => (
                  <div key={k} style={{ width: `${pct(data!.bySentiment[k] || 0, sentTotal)}%`, background: SENTIMENT_COLORS[k] }} />
                ))}
              </div>
              <div className="space-y-2">
                {sentiments.map(k => (
                  <div key={k} className="flex items-center justify-between text-[0.82rem]">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: SENTIMENT_COLORS[k] }} />
                      <span className="text-ink capitalize">{k}</span>
                    </span>
                    <span className="text-ink-mid font-mono">{data!.bySentiment[k] || 0} · {pct(data!.bySentiment[k] || 0, sentTotal)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <PipFeedback data={feedback} error={feedbackError} />

      {/* Segments table */}
      <h2 className="font-mono text-[0.62rem] tracking-[0.16em] uppercase text-ink-dim mb-2.5">User segments</h2>
      <div className="panel overflow-hidden">
        <table className="w-full text-[0.82rem]">
          <thead>
            <tr className="text-left font-mono text-[0.58rem] tracking-wider uppercase text-ink-dim border-b border-line">
              <th className="px-4 py-2.5">User</th>
              <th className="px-4 py-2.5">Segment</th>
              <th className="px-4 py-2.5 text-right">Interactions</th>
              <th className="px-4 py-2.5">Top intent</th>
              <th className="px-4 py-2.5 text-right">Avg sentiment</th>
              <th className="px-4 py-2.5">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {(data?.segments ?? []).map(s => {
              const seg = segmentOf(s);
              const sent = s.avgSentiment ?? 0;
              return (
                <tr key={s.userId} className="border-b border-line/60 hover:bg-elev/50">
                  <td className="px-4 py-2.5 text-ink">{s.email || s.userId.slice(0, 8)}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-[0.62rem] tracking-wider uppercase px-2 py-0.5 rounded" style={{ color: seg.color, background: `${seg.color}1a` }}>
                      {seg.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-ink-mid">{s.interactions}</td>
                  <td className="px-4 py-2.5 text-ink-mid capitalize">{s.topIntent || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: sent > 0.15 ? SENTIMENT_COLORS.positive : sent < -0.15 ? SENTIMENT_COLORS.negative : SENTIMENT_COLORS.neutral }}>
                    {s.avgSentiment === null ? '—' : sent.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-ink-dim font-mono text-[0.74rem]">{s.lastSeen ? s.lastSeen.slice(0, 10) : '—'}</td>
                </tr>
              );
            })}
            {(!data || data.segments.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-ink-mid">No user segments yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const UP = '#3a9d6b';
const DOWN = '#c2543f';

/** v1.4.2 — how members rate Pip's answers (👍 / 👎 under each answer). */
function PipFeedback({ data, error }: { data: AiFeedbackSummary | null; error: string }) {
  const rated = data ? data.up + data.down : 0;
  return (
    <section className="mb-6" aria-label="Pip answer feedback">
      <h2 className="font-mono text-[0.62rem] tracking-[0.16em] uppercase text-ink-dim mb-2.5">Pip answer feedback</h2>
      {error && <div className="panel p-4 text-danger text-sm">Could not load feedback: {error}</div>}
      {!error && data && data.total === 0 && (
        <div className="panel p-5 text-ink-mid text-sm">
          No ratings yet. Members rate an answer with 👍 or 👎 under it in Pip; only the rating, the
          question's intent and the answer's length are stored.
        </div>
      )}
      {!error && data && data.total > 0 && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="panel p-5">
            <div className="flex items-end gap-6 mb-4">
              <div>
                <div className="font-mono text-[0.58rem] tracking-wider uppercase text-ink-dim mb-1">Helpful</div>
                <div className="display-serif text-3xl text-ink">{pct(data.up, rated)}%</div>
              </div>
              <div className="flex items-center gap-1.5 text-[0.82rem] font-mono" style={{ color: UP }}><ThumbsUp size={13} /> {data.up}</div>
              <div className="flex items-center gap-1.5 text-[0.82rem] font-mono" style={{ color: DOWN }}><ThumbsDown size={13} /> {data.down}</div>
              <div className="text-[0.78rem] text-ink-dim font-mono ml-auto">{data.last30} in 30 days</div>
            </div>
            <div className="space-y-2">
              {data.byIntent.map(r => {
                const n = r.up + r.down;
                return (
                  <div key={r.intent}>
                    <div className="flex justify-between text-[0.8rem] mb-0.5">
                      <span className="text-ink capitalize">{r.intent}</span>
                      <span className="text-ink-mid font-mono">👍 {r.up} · 👎 {r.down}</span>
                    </div>
                    <div className="flex h-2 rounded-full bg-elev overflow-hidden">
                      <div style={{ width: `${pct(r.up, n)}%`, background: UP }} />
                      <div style={{ width: `${pct(r.down, n)}%`, background: DOWN }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="panel overflow-x-auto">
            <table className="w-full text-[0.8rem]">
              <thead>
                <tr className="text-left font-mono text-[0.58rem] tracking-wider uppercase text-ink-dim border-b border-line">
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Rating</th>
                  <th className="px-4 py-2.5">Intent</th>
                  <th className="px-4 py-2.5">Surface</th>
                  <th className="px-4 py-2.5 text-right">Answer length</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.slice(0, 12).map((r, i) => (
                  <tr key={`${r.at}-${i}`} className="border-b border-line/60">
                    <td className="px-4 py-2 text-ink-dim font-mono text-[0.72rem]">{r.at.slice(0, 16).replace('T', ' ')}</td>
                    <td className="px-4 py-2" style={{ color: r.rating === 1 ? UP : DOWN }}>
                      {r.rating === 1 ? <ThumbsUp size={13} aria-label="Helpful" /> : <ThumbsDown size={13} aria-label="Not helpful" />}
                    </td>
                    <td className="px-4 py-2 text-ink-mid capitalize">{r.intent || '—'}</td>
                    <td className="px-4 py-2 text-ink-mid">{r.surface}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink-mid">{r.responseLen ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Kpi({ label, value, loading, suffix, icon: Icon }: {
  label: string; value?: number; loading: boolean; suffix?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-1.5 font-mono text-[0.58rem] tracking-wider uppercase text-ink-dim mb-1.5">
        {Icon && <Icon size={11} />} {label}
      </div>
      <div className="display-serif text-3xl text-ink">
        {loading ? '…' : (value ?? '—')}{!loading && value !== undefined && suffix ? suffix : ''}
      </div>
    </div>
  );
}
