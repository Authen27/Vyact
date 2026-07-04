-- ============================================================================
-- Vyact v9.9.1 / admin v1.3.1 — portrait infographics for Insight content.
--
-- Each content_items row (evergreen card / article / external) can carry a
-- full-length portrait infographic image, authored outside Vyact (NotebookLM
-- etc.) and uploaded by a content admin through the Content CMS. Unlike the
-- YouTube-hosted video short, there is no free third-party CDN for an
-- arbitrary image, so this DOES need real storage — a Supabase Storage
-- bucket, the first one in this app.
-- ============================================================================

-- 1. content_items gains the same url + last-updated pattern already used
--    for video_url/video_updated_at (v9.9.0).
alter table content_items
  add column if not exists infographic_url        text,
  add column if not exists infographic_updated_at timestamptz;

comment on column content_items.infographic_url is
  'Public Storage URL of the full-length portrait infographic for this content item, if uploaded.';
comment on column content_items.infographic_updated_at is
  'Set whenever infographic_url changes (new upload/replace) in the admin CMS.';

-- 2. Storage bucket — public read (images are non-sensitive marketing/
--    educational content, same trust level as the evergreen card bodies
--    which are already public at /learn/<slug>), write restricted to content
--    admins via the same is_admin('content') gate used on content_items.
insert into storage.buckets (id, name, public)
values ('insight-infographics', 'insight-infographics', true)
on conflict (id) do nothing;

drop policy if exists "insight infographics public read"    on storage.objects;
drop policy if exists "insight infographics admin write"    on storage.objects;
drop policy if exists "insight infographics admin update"   on storage.objects;
drop policy if exists "insight infographics admin delete"   on storage.objects;

create policy "insight infographics public read" on storage.objects
  for select using (bucket_id = 'insight-infographics');

create policy "insight infographics admin write" on storage.objects
  for insert with check (bucket_id = 'insight-infographics' and public.is_admin('content'));

create policy "insight infographics admin update" on storage.objects
  for update using (bucket_id = 'insight-infographics' and public.is_admin('content'));

create policy "insight infographics admin delete" on storage.objects
  for delete using (bucket_id = 'insight-infographics' and public.is_admin('content'));
