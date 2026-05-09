// FinFlow Admin v8 — Types

export type AdminRole = 'super' | 'roles' | 'content';
export type UserStatus = 'active' | 'invited' | 'suspended' | 'churned';
export type SubTier = 'free' | 'family' | 'premium' | 'enterprise';
export type SubStatus = 'active' | 'past_due' | 'canceled' | 'trialing';
export type ContentStatus = 'draft' | 'review' | 'published' | 'archived';

export interface User {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  signupDate: string;
  lastSeen: string;
  households: number;
  subscriptionTier: SubTier;
  country: string;
  pulseScore?: number;
  template?: string;
}

export interface Household {
  id: string;
  name: string;
  type: 'personal' | 'family' | 'business' | 'multi_biz' | 'shared';
  memberCount: number;
  activeMemberCount: number;
  ownerId: string;
  createdAt: string;
  baseCurrency: string;
}

export interface Subscription {
  id: string;
  userId: string;
  tier: SubTier;
  status: SubStatus;
  monthlyAmount: number;
  currency: string;
  startedAt: string;
  renewsAt: string;
  failureCount: number;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  topic: 'debt' | 'tax' | 'investment' | 'budgeting' | 'savings' | 'retirement';
  status: ContentStatus;
  author: string;
  publishedAt?: string;
  updatedAt: string;
  views: number;
  source: 'original' | 'aggregated';
  sourceUrl?: string;
}

export interface AuditEntry {
  id: string;
  actorEmail: string;
  actorRole: AdminRole;
  action: string;
  entity: string;
  entityId?: string;
  diff?: Record<string, [unknown, unknown]>;
  at: string;
  ip?: string;
}

export interface KpiSnapshot {
  weekOf: string;            // ISO week start
  // NorthStar
  activeHouseholdsPerWeek: number;
  // Onboarding
  timeToFirstTxnSec: number;
  templateCompletionPct: number;
  // Activation
  d7RetentionPct: number;
  // Engagement
  avgSessionsPerUser: number;
  // Household
  multiMemberPct: number;
  // Retention
  d90RetentionPct: number;
  // Pulse Score
  pulseImproved30dPct: number;
  // Recurring
  reminderConfirmedPct: number;
  // Planner
  recsFollowedPct: number;
  // Chatbot
  avgChatSatisfaction: number;
  // Revenue
  freeToPaidPct: number;
  // CS
  nps: number;
  // Underlying
  signups: number;
  mrr: number;
  churnPct: number;
}
