-- Vyact — Insights Hub §A: additive content_items columns for evergreen "card"
-- and curated "external" formats (v9.5.3 / spec docs/insights-integration-spec.md).
--
-- Forward-only, additive. Existing rows (legacy editorial articles) keep working:
-- the new `format` defaults to 'article' and the conditional CHECKs only bind for
-- format='card' / 'external'. RLS is INHERITED from the existing content_items
-- policies (admins write, consumers read published) — no new policy logic.

alter table public.content_items
  add column if not exists format          text    not null default 'article',
  add column if not exists category        text,             -- card's real category (Saving/Debt/…); topic stays the legacy 6-value field
  add column if not exists visual_kind     text,             -- 'icon' | 'stat' | 'diagram'
  add column if not exists visual_ref      jsonb,            -- render spec: icon={"icon":"…"}, stat={"big":…}, diagram={"primitive":…}
  add column if not exists body_md         text,             -- ≤120-word markdown body (card)
  add column if not exists tags            text[],           -- trigger/context tags
  add column if not exists reading_seconds int,
  add column if not exists tone            text,             -- 'neutral' | 'positive' | 'constructive'
  add column if not exists india_relevant  boolean not null default false,
  add column if not exists source_name     text,             -- external allowlist
  add column if not exists source_url      text,
  add column if not exists why_it_matters  text;

-- Closed-set + integrity constraints (added NOT VALID then validated so a large
-- existing table never blocks; legacy rows are all format='article' so they pass).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ck_content_format') then
    alter table public.content_items add constraint ck_content_format
      check (format in ('article','card','external')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ck_content_visual_kind') then
    alter table public.content_items add constraint ck_content_visual_kind
      check (visual_kind is null or visual_kind in ('icon','stat','diagram')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ck_content_tone') then
    alter table public.content_items add constraint ck_content_tone
      check (tone is null or tone in ('neutral','positive','constructive')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ck_card_has_visual') then
    alter table public.content_items add constraint ck_card_has_visual
      check (format <> 'card' or (visual_kind is not null and visual_ref is not null and body_md is not null)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ck_external_has_source') then
    alter table public.content_items add constraint ck_external_has_source
      check (format <> 'external' or (source_name is not null and source_url is not null and published_at is not null)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ck_source_allowlist') then
    alter table public.content_items add constraint ck_source_allowlist
      check (source_name is null or source_name in ('RBI','SEBI','IncomeTax','PFRDA_NPS','GovScheme')) not valid;
  end if;
end $$;

alter table public.content_items validate constraint ck_content_format;
alter table public.content_items validate constraint ck_content_visual_kind;
alter table public.content_items validate constraint ck_content_tone;
alter table public.content_items validate constraint ck_card_has_visual;
alter table public.content_items validate constraint ck_external_has_source;
alter table public.content_items validate constraint ck_source_allowlist;

create index if not exists idx_content_format_published
  on public.content_items (format, published_at desc);
create index if not exists idx_content_tags_gin
  on public.content_items using gin (tags);
