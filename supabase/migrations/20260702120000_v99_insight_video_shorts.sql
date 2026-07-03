-- ============================================================================
-- Vyact v9.9.0 — YouTube short video links for Insight content (evergreen
-- cards, articles, and external items all live in content_items).
--
-- Admin (Content CMS) pastes a YouTube URL per item; the consumer renders a
-- click-to-play embed + an "Open in YouTube" redirect (like/comment/subscribe
-- there). No video files are stored in Vyact — YouTube is the CDN, this is
-- just a URL + a last-updated timestamp so staleness is visible in the CMS.
-- Purely additive; existing RLS policies on content_items already cover these
-- new columns (row-level, not column-level).
-- ============================================================================

alter table content_items
  add column if not exists video_url        text,
  add column if not exists video_updated_at timestamptz;

comment on column content_items.video_url is
  'Optional YouTube short URL (any common form — watch/shorts/youtu.be/embed) for this content item. Normalised client-side via lib/youtube.ts.';
comment on column content_items.video_updated_at is
  'Set whenever video_url changes in the admin CMS — lets editors see at a glance which shorts are stale relative to the content.';
