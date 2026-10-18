-- v10.109.0 (owner decisions 16 Oct 2026: "Archive the concept of Pulse"; published content that mentions
-- it is unpublished by a migration).
--
-- The Pulse Score is archived: no screen, Pip answer or message shows it any more (its computation stays,
-- unused, like Goals and Tax). A published Learn lesson or Insights card that talks about it would describe a
-- feature the app no longer has, so every PUBLISHED content item that mentions Pulse as a word goes back to
-- 'draft'. The owner rewrites or deletes them in the admin CMS; nothing is deleted here.
--   • A whole-word match (\m … \M): "impulse" and the "HeartPulse" icon name are not Pulse.
--   • title, summary, body, the card's markdown body, its visual spec and its tags are all read.
--   • Idempotent: a second run finds nothing published to change.

update public.content_items
   set status = 'draft', updated_at = now()
 where status = 'published'
   and (title ~* '\mpulse\M'
        or coalesce(summary, '') ~* '\mpulse\M'
        or coalesce(body, '') ~* '\mpulse\M'
        or coalesce(body_md, '') ~* '\mpulse\M'
        or coalesce(visual_ref::text, '') ~* '\mpulse\M'
        or exists (select 1 from unnest(coalesce(tags, '{}'::text[])) as tag where tag ~* '^pulse$'));
