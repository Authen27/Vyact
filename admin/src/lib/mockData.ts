// Mock data layer for the admin app.
// Replaced by Supabase queries in v8.1+ once auth and RLS are wired.

import type { User, Household, Subscription, Article, AuditEntry, KpiSnapshot, AdminRole } from '../types';

// ── Deterministic-ish seeded RNG (so charts don't reshuffle on hot reload)
let _seed = 42;
const rand = () => { _seed = (_seed * 9301 + 49297) % 233280; return _seed / 233280; };
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

const FIRST_NAMES = ['Alex','Sam','Jordan','Priya','Amir','Mei','Jamie','Robin','Avery','Taylor','Casey','Morgan','Nico','Sasha','Kai','Eden','Zara','Ravi','Aisha','Liam'];
const LAST_NAMES  = ['Chen','Patel','Johnson','García','Müller','Smith','Hernández','Singh','Williams','Khan','Brown','Yamamoto','O\'Connor','Cohen','Rossi','Andersen','Silva','Tanaka','Nguyễn','Kowalski'];
const COUNTRIES   = ['US','UK','IN','CA','AU','DE','FR','BR','SG','AE','JP','MX'];
const TEMPLATES   = ['young_couple','family','single','self_employed','retiree','student'];

// ── USERS (200 mock)
export const MOCK_USERS: User[] = Array.from({ length: 220 }, (_, i) => {
  const fn = pick(FIRST_NAMES);
  const ln = pick(LAST_NAMES);
  const signup = new Date(Date.now() - rand() * 365 * 86400000);
  const lastSeen = new Date(signup.getTime() + rand() * (Date.now() - signup.getTime()));
  const tiers: ['free','free','free','family','family','premium','enterprise'] = ['free','free','free','family','family','premium','enterprise'];
  return {
    id: `u_${i.toString().padStart(4, '0')}`,
    email: `${fn.toLowerCase()}.${ln.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
    name: `${fn} ${ln}`,
    status: i % 50 === 0 ? 'suspended' : i % 30 === 0 ? 'invited' : i % 80 === 0 ? 'churned' : 'active',
    signupDate: signup.toISOString().split('T')[0],
    lastSeen: lastSeen.toISOString().split('T')[0],
    households: Math.floor(rand() * 3) + 1,
    subscriptionTier: pick(tiers),
    country: pick(COUNTRIES),
    pulseScore: 35 + Math.floor(rand() * 60),
    template: pick(TEMPLATES),
  };
});

// ── HOUSEHOLDS
export const MOCK_HOUSEHOLDS: Household[] = MOCK_USERS.flatMap(u =>
  Array.from({ length: u.households }, (_, j) => ({
    id: `h_${u.id}_${j}`,
    name: j === 0 ? `${u.name.split(' ')[1]} Family` : `${u.name.split(' ')[0]}'s ${j === 1 ? 'Personal' : 'Business'}`,
    type: (j === 0 ? 'family' : j === 1 ? 'personal' : 'business') as Household['type'],
    memberCount: Math.floor(rand() * 4) + 1,
    activeMemberCount: Math.floor(rand() * 3) + 1,
    ownerId: u.id,
    createdAt: u.signupDate,
    baseCurrency: u.country === 'IN' ? 'INR' : u.country === 'UK' ? 'GBP' : u.country === 'BR' ? 'BRL' : u.country === 'JP' ? 'JPY' : 'USD',
  }))
);

// ── SUBSCRIPTIONS
const TIER_PRICES: Record<string, number> = { free: 0, family: 18, premium: 42, enterprise: 0 };
export const MOCK_SUBSCRIPTIONS: Subscription[] = MOCK_USERS
  .filter(u => u.subscriptionTier !== 'free')
  .map((u, i) => ({
    id: `s_${i.toString().padStart(4, '0')}`,
    userId: u.id,
    tier: u.subscriptionTier,
    status: i % 25 === 0 ? 'past_due' : i % 40 === 0 ? 'canceled' : 'active',
    monthlyAmount: TIER_PRICES[u.subscriptionTier],
    currency: 'USD',
    startedAt: u.signupDate,
    renewsAt: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    failureCount: i % 25 === 0 ? 2 : 0,
  }));

// ── ARTICLES
const TOPICS: Article['topic'][] = ['debt','tax','investment','budgeting','savings','retirement'];
const ARTICLE_TITLES = [
  'The 50/30/20 rule, revisited for 2026',
  'Avalanche vs Snowball — when each strategy wins',
  'How ISA allowance works in the UK',
  '401(k) employer match: the highest-return investment most workers miss',
  'Why your credit score moves and how to read it',
  'Building a 6-month emergency fund on any income',
  'Debt-to-income ratio: what banks actually look at',
  'Compound interest in plain English',
  'How to read a payslip — gross, net, deductions',
  'Sinking funds: the spending category most people skip',
  'Tax-loss harvesting for retail investors',
  'Roth vs Traditional: the under-30 decision tree',
];
export const MOCK_ARTICLES: Article[] = ARTICLE_TITLES.map((title, i) => ({
  id: `a_${i.toString().padStart(3, '0')}`,
  title,
  slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  topic: TOPICS[i % TOPICS.length],
  status: i < 8 ? 'published' : i < 10 ? 'review' : 'draft',
  author: pick(['Maya Chen','Aaron Wells','Priya Rao','Editorial Team']),
  publishedAt: i < 8 ? new Date(Date.now() - i * 7 * 86400000).toISOString().split('T')[0] : undefined,
  updatedAt: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
  views: i < 8 ? Math.floor(rand() * 50000) + 1000 : 0,
  source: i % 4 === 0 ? 'aggregated' : 'original',
}));

// ── AUDIT LOG (last 50 entries)
const ACTIONS = ['user.suspended','user.role_changed','user.deleted','content.published','content.unpublished','subscription.refunded','settings.updated','audit.exported'];
export const MOCK_AUDIT: AuditEntry[] = Array.from({ length: 80 }, (_, i) => ({
  id: `audit_${i.toString().padStart(4, '0')}`,
  actorEmail: pick(['admin@finflow.app','ops@finflow.app','content@finflow.app']),
  actorRole: pick<AdminRole>(['super','roles','content']),
  action: pick(ACTIONS),
  entity: pick(['user','article','subscription','setting']),
  entityId: `id_${Math.floor(rand() * 1000).toString(36)}`,
  at: new Date(Date.now() - i * 3600 * 1000 - rand() * 600 * 1000).toISOString(),
  ip: `${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}`,
}));

// ── KPI snapshots (last 12 weeks for trend)
export const MOCK_KPI_HISTORY: KpiSnapshot[] = Array.from({ length: 12 }, (_, i) => {
  const week = new Date(Date.now() - (11 - i) * 7 * 86400000);
  const weekStart = new Date(week);
  weekStart.setDate(week.getDate() - week.getDay());
  return {
    weekOf: weekStart.toISOString().split('T')[0],
    activeHouseholdsPerWeek: Math.floor(120 + i * 18 + rand() * 30),
    timeToFirstTxnSec: Math.floor(180 - i * 8 + rand() * 15),
    templateCompletionPct: 78 + Math.floor(i * 1.2 + rand() * 4),
    d7RetentionPct: 48 + Math.floor(i * 1.1 + rand() * 5),
    avgSessionsPerUser: 2.4 + i * 0.15 + rand() * 0.4,
    multiMemberPct: 28 + Math.floor(i * 1.1 + rand() * 3),
    d90RetentionPct: 32 + Math.floor(i * 1.5 + rand() * 4),
    pulseImproved30dPct: 55 + Math.floor(i * 1.3 + rand() * 5),
    reminderConfirmedPct: 70 + Math.floor(i * 0.9 + rand() * 4),
    recsFollowedPct: 14 + Math.floor(i * 1.0 + rand() * 3),
    avgChatSatisfaction: +(3.4 + i * 0.07 + rand() * 0.15).toFixed(2),
    freeToPaidPct: 4.5 + i * 0.3 + rand() * 0.6,
    nps: 28 + Math.floor(i * 1.8 + rand() * 6),
    signups: Math.floor(80 + i * 12 + rand() * 20),
    mrr: Math.floor(8500 + i * 1100 + rand() * 800),
    churnPct: 5.2 - i * 0.15 + rand() * 0.5,
  };
});

export const CURRENT_KPI = MOCK_KPI_HISTORY[MOCK_KPI_HISTORY.length - 1];
export const PREVIOUS_KPI = MOCK_KPI_HISTORY[MOCK_KPI_HISTORY.length - 2];
