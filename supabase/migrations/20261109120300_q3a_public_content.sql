-- Q3a (v10.130.0; audit FE-PUB-08, ADM-10, ADM-11; owner, 20 Oct 2026).
--
-- FE-PUB-08: a signed-out visitor could read every column of a published Learn item through the API, the
--   author's user id among them. They may now read only the columns the public pages and the app's video
--   and infographic lookup use (react/api/learn.js LESSON_COLS and LIST_COLS, sitemap.js, llms.js, v.js,
--   react/src/lib/insightVideos.ts), plus the ones those queries filter on. The "public reads published"
--   policy still decides WHICH rows. migrationReplay/authz tests check that every column react/api asks for
--   stays in this list.
-- ADM-10: the infographics bucket takes images only (PNG, JPEG, WebP), at most 5 MB each.
-- ADM-11: until admin v1.4.x an edit wrote the editor's email as the author. Those bylines become "Vyact"
--   (CONTENT_BYLINE). Publish dates that edits reset are not recoverable and stay as they are.

-- ── FE-PUB-08 ──────────────────────────────────────────────────────────────────────────────────────────────────
revoke select on table public.content_items from anon;
grant select (slug, title, category, format, status, tags, body_md, reading_seconds, why_it_matters,
              video_url, video_updated_at, infographic_url, source_name, source_url, published_at, updated_at)
  on table public.content_items to anon;

-- ── ADM-10 ─────────────────────────────────────────────────────────────────────────────────────────────────────
update storage.buckets
   set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'],
       file_size_limit    = 5242880
 where id = 'insight-infographics';

-- ── ADM-11 ─────────────────────────────────────────────────────────────────────────────────────────────────────
update public.content_items set author_name = 'Vyact' where author_name like '%@%';
