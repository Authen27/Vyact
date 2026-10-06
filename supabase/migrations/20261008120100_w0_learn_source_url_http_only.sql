-- W0 (audit 2026-10-04, FE-PUB-02 / ADM-01) — a lesson's source link must be http(s).
--
-- /learn/<slug> renders content_items.source_url as a clickable link on vyact.app.
-- HTML-escaping made "javascript:…" safe to print but still clickable, and a malformed
-- value made the page throw. The renderer now drops anything that isn't http(s)
-- (react/api/_page.js httpUrl); this CHECK stops the CMS storing one in the first place.
--
-- NOT VALID: existing rows are not re-checked here (the renderer already ignores a bad
-- one); every new insert and every update must satisfy it.

BEGIN;

alter table public.content_items
  drop constraint if exists ck_content_items_source_url_http;

alter table public.content_items
  add constraint ck_content_items_source_url_http
  check (source_url is null or source_url = '' or source_url ~* '^https?://')
  not valid;

COMMIT;
