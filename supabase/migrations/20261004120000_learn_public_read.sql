-- v10.49.0 (#0) — the public Learn library is readable again by logged-out visitors.
--
-- Since ~9 Sep (v10.22's 20260909150000 revoked EXECUTE on the admin helpers from anon)
-- every anonymous read of content_items failed with
--   42501 permission denied for function is_admin
-- because the one SELECT policy was `status = 'published' OR is_admin('content')` for
-- role PUBLIC: Postgres checks EXECUTE on every function in the expression when it plans
-- the query, even when the first operand already decides the row. /learn and the sitemap
-- went dark.
--
-- Split the policy by role: anon reads published rows and nothing else (no function
-- call); a signed-in user reads published rows, and a content admin also drafts. The
-- write policies and the helper lock-down are unchanged.

begin;

drop policy if exists "anyone reads published" on public.content_items;
drop policy if exists "public reads published" on public.content_items;
drop policy if exists "signed-in reads published, admins all" on public.content_items;

create policy "public reads published" on public.content_items
  for select to anon
  using (status = 'published');

create policy "signed-in reads published, admins all" on public.content_items
  for select to authenticated
  using (status = 'published' or public.is_admin('content'));

commit;
