// FinFlow Admin v8 — Content CRUD against Supabase
// content_items rows authored here are surfaced to the consumer app's
// Insights page for any user (RLS: anyone authenticated sees status='published').

import { sb } from './supabase';
import type { Article, ContentStatus } from '../types';

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
}

// Exported for unit testing (ADM-UNIT-008..011); see docs/TEST_SCENARIOS.md.
export function rowToArticle(r: ContentRow): Article & { summary: string; body: string; readMinutes: number; coverEmoji: string } {
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
  slug: string;
  title: string;
  summary?: string;
  body: string;
  topic: Article['topic'];
  status: ContentStatus;
  read_minutes?: number;
  cover_emoji?: string;
  author_name: string;
}

export async function upsertContent(input: ContentInput) {
  const row: Partial<ContentRow> = {
    slug: input.slug,
    title: input.title,
    summary: input.summary ?? null,
    body: input.body,
    topic: input.topic,
    status: input.status,
    read_minutes: input.read_minutes ?? 3,
    cover_emoji: input.cover_emoji ?? '📰',
    author_name: input.author_name,
    published_at: input.status === 'published' ? new Date().toISOString() : null,
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
