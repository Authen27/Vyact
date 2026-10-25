-- Q3a (v10.130.0; audit DB-OPS-03, DB-OPS-16; owner decision D4, 20 Oct 2026: "codify + drop the backups").
--
-- Objects that exist only in production (the 28 May baseline recorded them, or the dashboard made them) are
-- brought under the migrations:
--
-- 1. migration_issues: the v9 migration's issue log. It had no row-level security, and Supabase's default grants
--    left it readable and writable through the API by anyone, signed out included (the Q2 access matrix pinned
--    it). Only the server reads it now.
-- 2. _backup_v9_*: the v9 redesign's in-database restore point (June 2026). The redesign shipped four months ago
--    and every later migration builds on it; the copies hold old transactions, accounts and budgets that no
--    erase, export or purge reaches. Dropped (irreversible).
-- 3. pg_trgm: installed in public by the baseline, used by nothing in the repo. Dropped when nothing in this
--    database uses it either; otherwise left as it is, with a notice, so a production-only dependent never breaks.

-- ── 1. migration_issues: server only ────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.migration_issues') is not null then
    alter table public.migration_issues enable row level security;
    revoke all on table public.migration_issues from public, anon, authenticated;
    grant select, insert, update, delete on table public.migration_issues to service_role;
  end if;
end $$;

-- ── 2. the v9 backups ───────────────────────────────────────────────────────────────────────────────────────────
do $$
declare t record;
begin
  for t in select c.relname from pg_class c
            where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname like '\_backup\_v9\_%'
  loop
    begin
      execute format('drop table public.%I', t.relname);
      raise notice 'Q3a: dropped the v9 backup table %', t.relname;
    exception when insufficient_privilege then
      -- Owned by a platform role: say so in the Deploy log rather than fail every later migration.
      raise notice 'Q3a: could not drop % (not its owner); drop it in the SQL editor', t.relname;
    end;
  end loop;
end $$;

-- ── 3. pg_trgm, only if nothing uses it ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_indexes   int;
  v_functions int;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then return; end if;

  -- An index built on one of its operator classes.
  select count(*) into v_indexes
    from pg_index i
    join pg_opclass o on o.oid = any (i.indclass::oid[])
    join pg_depend d on d.classid = 'pg_opclass'::regclass and d.objid = o.oid and d.deptype = 'e'
    join pg_extension e on e.oid = d.refobjid and e.extname = 'pg_trgm';

  -- A function body that calls it (pg_depend does not see inside a body).
  select count(*) into v_functions
    from pg_proc p
   where p.pronamespace not in ('pg_catalog'::regnamespace, 'information_schema'::regnamespace)
     and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
     and p.prosrc ~* '(similarity|show_trgm|show_limit|set_limit|_trgm)';

  if v_indexes = 0 and v_functions = 0 then
    begin
      drop extension pg_trgm;
      raise notice 'Q3a: pg_trgm dropped (nothing used it)';
    exception when insufficient_privilege then
      raise notice 'Q3a: pg_trgm is unused but owned by a platform role; drop it from the dashboard';
    end;
  else
    raise notice 'Q3a: pg_trgm kept: % index(es) and % function(s) use it', v_indexes, v_functions;
  end if;
end $$;
