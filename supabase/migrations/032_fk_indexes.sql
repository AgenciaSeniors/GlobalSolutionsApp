-- ============================================================================
-- 032_fk_indexes.sql  (already applied to production)
-- Performance: add covering indexes for foreign keys that lacked one (25 per
-- the Supabase performance advisor). Idempotent — indexes every single-column
-- FK with no leading-column index. No behavior change.
-- ============================================================================
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl,
           (c.conrelid::regclass)::text as tbl_txt,
           a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and array_length(c.conkey, 1) = 1
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and i.indkey[0] = c.conkey[1]
      )
  loop
    execute format(
      'create index if not exists %I on %s (%I)',
      'idx_' || replace(r.tbl_txt, 'public.', '') || '_' || r.col,
      r.tbl,
      r.col
    );
  end loop;
end $$;
