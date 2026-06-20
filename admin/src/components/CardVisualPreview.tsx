// Vyact Admin — live preview of a card's code-rendered visual (v9.5.4, spec §D).
// Mirrors the consumer renderer so "what the author sees is what ships". Reads the
// normalized visual_ref shape: icon={icon}, stat={big,sub}, diagram={primitive,…}.
import {
  AlertTriangle, Baby, BarChart3, Briefcase, CalendarCheck, CalendarClock,
  CalendarDays, CalendarRange, CalendarX, CheckCircle, CircleDot, Clock, Coffee,
  Coins, Compass, Droplet, Equal, Eye, FileText, Footprints, Gift, GraduationCap,
  Heart, HeartPulse, Home, Hourglass, KeyRound, Landmark, LayoutGrid, Map, PenLine,
  Percent, PiggyBank, Plane, Receipt, RefreshCcw, RefreshCw, Repeat, RotateCcw,
  Search, Shield, ShieldAlert, ShieldCheck, Smartphone, Smile, Sparkles, Sunrise,
  Tag, Tags, Target, TrendingDown, Umbrella, UserCheck, Users, Wallet, Wind, Zap,
  type LucideIcon,
} from 'lucide-react';
import type { VisualKind } from '../lib/contentApi';

const ICONS: Record<string, LucideIcon> = {
  AlertTriangle, Baby, BarChart3, Briefcase, CalendarCheck, CalendarClock,
  CalendarDays, CalendarRange, CalendarX, CheckCircle, CircleDot, Clock, Coffee,
  Coins, Compass, Droplet, Equal, Eye, FileText, Footprints, Gift, GraduationCap,
  Heart, HeartPulse, Home, Hourglass, KeyRound, Landmark, LayoutGrid, Map, PenLine,
  Percent, PiggyBank, Plane, Receipt, RefreshCcw, RefreshCw, Repeat, RotateCcw,
  Search, Shield, ShieldAlert, ShieldCheck, Smartphone, Smile, Sparkles, Sunrise,
  Tag, Tags, Target, TrendingDown, Umbrella, UserCheck, Users, Wallet, Wind, Zap,
};

const SEG_BG = ['bg-claude', 'bg-positive', 'bg-warn', 'bg-info', 'bg-danger'];
const SEG_TEXT = ['text-claude', 'text-positive', 'text-warn', 'text-info', 'text-danger'];

export default function CardVisualPreview({ kind, ref_, className = '' }: {
  kind: VisualKind | null; ref_: unknown; className?: string;
}) {
  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-md bg-elev ${className}`}>
      {render(kind, ref_)}
    </div>
  );
}

function render(kind: VisualKind | null, ref_: any) {
  if (kind === 'icon') return <IconHero name={ref_?.icon} />;
  if (kind === 'stat') return <StatHero big={ref_?.big} sub={ref_?.sub} />;
  if (kind === 'diagram') {
    const p = ref_?.primitive;
    if (p === 'arc') return <Arc pct={ref_.pct} label={ref_.label} />;
    if (p === 'arrow') return <Arrow dir={ref_.dir} label={ref_.label} />;
    if (p === 'bar2') return <Bar2 a={ref_.a} b={ref_.b} />;
    if (p === 'compare2') return <Compare2 a={ref_.a} b={ref_.b} />;
    if (p === 'stack') return <Stack parts={ref_.parts} />;
  }
  return <div className="text-ink-dim text-xs">No visual</div>;
}

function IconHero({ name }: { name?: string }) {
  const Icon = (name && ICONS[name]) || Sparkles;
  return (
    <span className="flex items-center justify-center w-14 h-14 rounded-full bg-claude/10">
      <Icon size={26} strokeWidth={1.6} className="text-claude" />
    </span>
  );
}

function StatHero({ big, sub }: { big?: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-3">
      <div className="text-[1.5rem] leading-none font-semibold text-ink tabular-nums">{big || '—'}</div>
      {sub && <div className="text-[0.7rem] text-ink-mid mt-1.5">{sub}</div>}
    </div>
  );
}

function Arc({ pct, label }: { pct: number; label?: string }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const r = 28, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center justify-center text-claude">
      <svg width="74" height="74" viewBox="0 0 74 74">
        <circle cx="37" cy="37" r={r} fill="none" className="text-line" stroke="currentColor" strokeWidth="7" opacity="0.3" />
        <circle cx="37" cy="37" r={r} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} transform="rotate(-90 37 37)" />
        <text x="37" y="42" textAnchor="middle" fontSize="14" fill="currentColor" fontWeight="600">{p}%</text>
      </svg>
      {label && <div className="text-[0.62rem] text-ink-mid mt-0.5">{label}</div>}
    </div>
  );
}

function Arrow({ dir, label }: { dir: 'up' | 'down'; label?: string }) {
  const up = dir === 'up';
  return (
    <div className={`flex flex-col items-center justify-center px-3 ${up ? 'text-positive' : 'text-info'}`}>
      <svg width="44" height="44" viewBox="0 0 48 48" style={{ transform: up ? 'none' : 'scaleY(-1)' }}>
        <path d="M24 40 L24 12 M14 22 L24 12 L34 22" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label && <div className="text-[0.62rem] text-ink-mid mt-1 text-center max-w-[150px]">{label}</div>}
    </div>
  );
}

function Bar2({ a, b }: { a: [string, number]; b: [string, number] }) {
  const max = Math.max(a?.[1] ?? 0, b?.[1] ?? 0) || 100;
  const bar = (pair: [string, number], i: number) => (
    <div className="flex flex-col items-center justify-end gap-1 h-full">
      <div className={`w-9 rounded-t ${SEG_BG[i]}`} style={{ height: `${(pair[1] / max) * 60}px`, minHeight: 6 }} />
      <span className="text-[0.58rem] text-ink-mid text-center max-w-[64px] leading-tight">{pair[0]}</span>
    </div>
  );
  return <div className="flex items-end gap-5 h-[84px] pb-1">{bar(a, 0)}{bar(b, 1)}</div>;
}

function Compare2({ a, b }: { a: string; b: string }) {
  const box = (label: string, i: number) => (
    <div className={`flex-1 flex items-center justify-center rounded px-2 py-3 text-[0.66rem] font-medium text-center bg-elev border border-line ${SEG_TEXT[i]}`}>{label}</div>
  );
  return <div className="flex items-center gap-2 w-full px-4">{box(a, 0)}<span className="text-[0.58rem] text-ink-dim">vs</span>{box(b, 3)}</div>;
}

function Stack({ parts }: { parts: [string, number][] }) {
  const total = (parts || []).reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div className="w-full px-4">
      <div className="flex h-5 w-full overflow-hidden rounded-full">
        {parts.map(([, v], i) => <div key={i} className={SEG_BG[i % SEG_BG.length]} style={{ width: `${(v / total) * 100}%` }} />)}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-0.5">
        {parts.map(([label, v], i) => (
          <span key={i} className="flex items-center gap-1 text-[0.58rem] text-ink-mid">
            <span className={`inline-block w-2 h-2 rounded-sm ${SEG_BG[i % SEG_BG.length]}`} /> {label} {v}
          </span>
        ))}
      </div>
    </div>
  );
}
