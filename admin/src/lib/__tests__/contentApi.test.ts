import { describe, it, expect } from 'vitest';
import { slugify, rowToArticle, type ContentRow } from '../contentApi';

// Test scenarios ADM-UNIT-001..011. First unit tests for the admin app's
// privileged surface. Catalogued in docs/TEST_SCENARIOS.md.
//
// Why slugify + rowToArticle?
//   - slugify produces URL-visible slugs for published articles; a regression
//     here (especially around special characters) would break consumer links.
//   - rowToArticle is the boundary mapper between Supabase rows and the
//     consumer-facing Article shape; defaulting bugs (e.g. a null emoji
//     bleeding through) would surface on the live Insights page.

function row(over: Partial<ContentRow> = {}): ContentRow {
  return {
    id: 'r-1',
    slug: 'sample-slug',
    title: 'Sample title',
    summary: 'A short summary',
    body: 'Body content here.',
    topic: 'budgeting',
    status: 'published',
    author_id: 'u-1',
    author_name: 'Test Author',
    read_minutes: 4,
    cover_emoji: '📊',
    published_at: '2026-05-23T10:00:00.000Z',
    created_at: '2026-05-23T09:00:00.000Z',
    updated_at: '2026-05-23T09:30:00.000Z',
    ...over,
  };
}

describe('slugify', () => {
  it('ADM-UNIT-001 · lowercases and replaces spaces with single hyphens', () => {
    expect(slugify('Hello World Article')).toBe('hello-world-article');
  });
  it('ADM-UNIT-002 · strips characters outside [a-z0-9 -]', () => {
    expect(slugify('Tax & Retirement: 2026!')).toBe('tax-retirement-2026');
  });
  it('ADM-UNIT-003 · collapses runs of whitespace into a single hyphen', () => {
    expect(slugify('Multiple    spaces\there')).toBe('multiple-spaces-here');
  });
  it('ADM-UNIT-004 · trims leading/trailing whitespace before slugging', () => {
    expect(slugify('   padded title   ')).toBe('padded-title');
  });
  it('ADM-UNIT-005 · caps the slug at 80 characters', () => {
    const long = 'word '.repeat(40); // 200 chars pre-slugify
    const s = slugify(long);
    expect(s.length).toBeLessThanOrEqual(80);
  });
  it('ADM-UNIT-006 · returns an empty string for entirely-stripped input', () => {
    expect(slugify('!!!  ???  @@@')).toBe('');
  });
  it('ADM-UNIT-007 · preserves digits and existing hyphens', () => {
    expect(slugify('debt-snowball vs avalanche 2026')).toBe('debt-snowball-vs-avalanche-2026');
  });
});

describe('rowToArticle', () => {
  it('ADM-UNIT-008 · maps the canonical row fields to the Article shape', () => {
    const a = rowToArticle(row());
    expect(a.id).toBe('r-1');
    expect(a.slug).toBe('sample-slug');
    expect(a.title).toBe('Sample title');
    expect(a.topic).toBe('budgeting');
    expect(a.status).toBe('published');
    expect(a.author).toBe('Test Author');
    expect(a.summary).toBe('A short summary');
    expect(a.body).toBe('Body content here.');
    expect(a.readMinutes).toBe(4);
    expect(a.coverEmoji).toBe('📊');
    expect(a.source).toBe('original');
    expect(a.views).toBe(0);
  });
  it('ADM-UNIT-009 · defaults a null summary to the empty string', () => {
    const a = rowToArticle(row({ summary: null }));
    expect(a.summary).toBe('');
  });
  it('ADM-UNIT-010 · defaults a null cover_emoji to 📰', () => {
    const a = rowToArticle(row({ cover_emoji: null }));
    expect(a.coverEmoji).toBe('📰');
  });
  it('ADM-UNIT-011 · maps null published_at to undefined (not the string "null")', () => {
    const a = rowToArticle(row({ published_at: null }));
    expect(a.publishedAt).toBeUndefined();
  });
});
