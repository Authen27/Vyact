// Vyact Admin v8 — Content CRUD against Supabase
// content_items rows authored here are surfaced to the consumer app's
// Insights page for any user (RLS: anyone authenticated sees status='published').

import { sb } from './supabase';
import type { Article, ContentStatus } from '../types';

// v9.5.4 — Insights Hub formats. 'article' = legacy editorial; 'card' = evergreen
// lesson (visual+text, Learn tab); 'external' = curated link-out (What's New).
export type ContentFormat = 'article' | 'card' | 'external';
export type VisualKind = 'icon' | 'stat' | 'diagram';
export type CardTone = 'neutral' | 'positive' | 'constructive';
export type SourceName = 'RBI' | 'SEBI' | 'IncomeTax' | 'PFRDA_NPS' | 'GovScheme';

export interface ContentRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  topic: Article['topic'];
  status: ContentStatus;
  author_id: string | null;
  author_name: string;
  read_minutes: number;
  cover_emoji: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // Insights Hub additive columns
  format: ContentFormat | null;
  category: string | null;
  visual_kind: VisualKind | null;
  visual_ref: unknown | null;
  body_md: string | null;
  tags: string[] | null;
  reading_seconds: number | null;
  tone: CardTone | null;
  india_relevant: boolean | null;
  source_name: SourceName | null;
  source_url: string | null;
  why_it_matters: string | null;
}

export type EnrichedContent = Article & {
  summary: string; body: string; readMinutes: number; coverEmoji: string;
  format: ContentFormat;
  category: string | null;
  visualKind: VisualKind | null;
  visualRef: unknown | null;
  bodyMd: string | null;
  tags: string[];
  readingSeconds: number | null;
  tone: CardTone | null;
  indiaRelevant: boolean;
  sourceName: SourceName | null;
  // sourceUrl is inherited from Article (optional string)
  whyItMatters: string | null;
};

// Exported for unit testing (ADM-UNIT-008..011); see docs/TEST_SCENARIOS.md.
export function rowToArticle(r: ContentRow): EnrichedContent {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    topic: r.topic,
    status: r.status,
    author: r.author_name,
    publishedAt: r.published_at ?? undefined,
    updatedAt: r.updated_at,
    views: 0,
    source: 'original',
    summary: r.summary ?? '',
    body: r.body,
    readMinutes: r.read_minutes,
    coverEmoji: r.cover_emoji ?? '📰',
    format: r.format ?? 'article',
    category: r.category,
    visualKind: r.visual_kind,
    visualRef: r.visual_ref,
    bodyMd: r.body_md,
    tags: r.tags ?? [],
    readingSeconds: r.reading_seconds,
    tone: r.tone,
    indiaRelevant: r.india_relevant ?? false,
    sourceName: r.source_name,
    sourceUrl: r.source_url ?? undefined,
    whyItMatters: r.why_it_matters,
  };
}

export async function listAllContent() {
  const { data, error } = await sb()
    .from('content_items')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as ContentRow[]).map(rowToArticle);
}

export interface ContentInput {
  id?: string;
  format?: ContentFormat;
  slug: string;
  title: string;
  summary?: string;
  body?: string;
  topic: Article['topic'];
  status: ContentStatus;
  read_minutes?: number;
  cover_emoji?: string;
  author_name: string;
  // card-only
  category?: string | null;
  visual_kind?: VisualKind | null;
  visual_ref?: unknown | null;
  body_md?: string | null;
  tags?: string[] | null;
  reading_seconds?: number | null;
  tone?: CardTone | null;
  india_relevant?: boolean | null;
  // external-only
  source_name?: SourceName | null;
  source_url?: string | null;
  why_it_matters?: string | null;
  /** Explicit source date for externals; otherwise set on publish. */
  published_at?: string | null;
}

export async function upsertContent(input: ContentInput) {
  const format = input.format ?? 'article';
  const defaultEmoji = format === 'card' ? '📚' : format === 'external' ? '🔗' : '📰';
  // `body` is NOT NULL on the table; for cards the prose lives in body_md, so we
  // mirror it into body to satisfy the column (and keep any legacy reader working).
  const body = input.body ?? input.body_md ?? '';
  const publishedAt = input.published_at !== undefined
    ? input.published_at
    : (input.status === 'published' ? new Date().toISOString() : null);

  const row: Partial<ContentRow> = {
    slug: input.slug,
    title: input.title,
    summary: input.summary ?? null,
    body,
    topic: input.topic,
    status: input.status,
    read_minutes: input.read_minutes ?? Math.max(1, Math.round((input.reading_seconds ?? 180) / 60)),
    cover_emoji: input.cover_emoji ?? defaultEmoji,
    author_name: input.author_name,
    published_at: publishedAt,
    format,
    category: input.category ?? null,
    visual_kind: input.visual_kind ?? null,
    visual_ref: input.visual_ref ?? null,
    body_md: input.body_md ?? null,
    tags: input.tags ?? null,
    reading_seconds: input.reading_seconds ?? null,
    tone: input.tone ?? null,
    india_relevant: input.india_relevant ?? false,
    source_name: input.source_name ?? null,
    source_url: input.source_url ?? null,
    why_it_matters: input.why_it_matters ?? null,
  };
  if (input.id) {
    const { data, error } = await sb()
      .from('content_items').update(row).eq('id', input.id).select().single();
    if (error) throw error;
    return rowToArticle(data as ContentRow);
  } else {
    const { data, error } = await sb()
      .from('content_items').insert(row).select().single();
    if (error) throw error;
    return rowToArticle(data as ContentRow);
  }
}

export async function deleteContent(id: string) {
  const { error } = await sb().from('content_items').delete().eq('id', id);
  if (error) throw error;
}

export function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}
