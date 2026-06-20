// Vyact Admin — Insights Hub visual kit (v9.5.4, spec §C3/§D).
// The CLOSED SET the card visual picker is constrained to: 57 icons, 5 diagram
// primitives, and the card taxonomy. Keeping these in one place guarantees an
// author can't reference a visual the consumer bundle can't render.
import type { VisualKind, CardTone, SourceName } from './contentApi';

export const ICON_ALLOWLIST = [
  'AlertTriangle', 'Baby', 'BarChart3', 'Briefcase', 'CalendarCheck', 'CalendarClock',
  'CalendarDays', 'CalendarRange', 'CalendarX', 'CheckCircle', 'CircleDot', 'Clock', 'Coffee',
  'Coins', 'Compass', 'Droplet', 'Equal', 'Eye', 'FileText', 'Footprints', 'Gift', 'GraduationCap',
  'Heart', 'HeartPulse', 'Home', 'Hourglass', 'KeyRound', 'Landmark', 'LayoutGrid', 'Map', 'PenLine',
  'Percent', 'PiggyBank', 'Plane', 'Receipt', 'RefreshCcw', 'RefreshCw', 'Repeat', 'RotateCcw',
  'Search', 'Shield', 'ShieldAlert', 'ShieldCheck', 'Smartphone', 'Smile', 'Sparkles', 'Sunrise',
  'Tag', 'Tags', 'Target', 'TrendingDown', 'Umbrella', 'UserCheck', 'Users', 'Wallet', 'Wind', 'Zap',
] as const;

export const DIAGRAM_PRIMITIVES = ['arc', 'arrow', 'bar2', 'compare2', 'stack'] as const;
export type DiagramPrimitive = typeof DIAGRAM_PRIMITIVES[number];

export const VISUAL_KINDS: VisualKind[] = ['icon', 'stat', 'diagram'];
export const CARD_TONES: CardTone[] = ['neutral', 'positive', 'constructive'];
export const SOURCE_NAMES: SourceName[] = ['RBI', 'SEBI', 'IncomeTax', 'PFRDA_NPS', 'GovScheme'];

export const CARD_CATEGORIES = [
  'Saving', 'Debt', 'Budgeting', 'Investing', 'Net Worth', 'Mindset', 'India', 'Household', 'Using Vyact',
] as const;

// Cards keep their rich category, but content_items.topic is the legacy 6-value
// CHECK column (NOT NULL) — map category → a valid topic for the DB.
const CATEGORY_TO_TOPIC: Record<string, string> = {
  Saving: 'savings', Debt: 'debt', Budgeting: 'budgeting', Investing: 'investment',
  'Net Worth': 'savings', Mindset: 'savings', India: 'savings', Household: 'budgeting', 'Using Vyact': 'budgeting',
};
export const topicForCategory = (category: string): string => CATEGORY_TO_TOPIC[category] ?? 'savings';

/** Build a default visual_ref for a freshly chosen kind/primitive (so the picker
 *  always has a valid shape to edit + preview). */
export function defaultVisualRef(kind: VisualKind, primitive: DiagramPrimitive = 'arc'): unknown {
  if (kind === 'icon') return { icon: 'PiggyBank' };
  if (kind === 'stat') return { big: '₹500/day', sub: '≈ ₹15,000 a month' };
  switch (primitive) {
    case 'arc': return { primitive: 'arc', pct: 50, label: '1 of 2' };
    case 'arrow': return { primitive: 'arrow', dir: 'up', label: 'trending up' };
    case 'bar2': return { primitive: 'bar2', a: ['A', 100], b: ['B', 60] };
    case 'compare2': return { primitive: 'compare2', a: 'This', b: 'That' };
    case 'stack': return { primitive: 'stack', parts: [['Needs', 50], ['Wants', 30], ['Save', 20]] };
  }
}
