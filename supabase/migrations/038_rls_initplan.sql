-- ============================================================================
-- 038_rls_initplan.sql  (already applied to production)
-- Performance: wrap auth.uid()/auth.role()/auth.jwt() in scalar subselects so
-- Postgres evaluates them once per query instead of once per row (the
-- auth_rls_initplan advisory, 69 policies / 25 tables). Pure optimization —
-- semantics unchanged (verified: RLS still enforces owner-only access).
-- ============================================================================
set local search_path = public, pg_temp;

do $$
declare r record; q text; c text; stmt text;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') || ' ' || coalesce(with_check,'')) ~ 'auth\.(uid|role|jwt)\('
  loop
    stmt := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if r.qual is not null then
      q := regexp_replace(r.qual, 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
      stmt := stmt || format(' using (%s)', q);
    end if;
    if r.with_check is not null then
      c := regexp_replace(r.with_check, 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
      stmt := stmt || format(' with check (%s)', c);
    end if;
    execute stmt;
  end loop;
end $$;
