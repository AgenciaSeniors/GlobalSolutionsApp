-- ============================================================================
-- 035_auth_throttle.sql  (already applied to production)
-- Phase 9 — generic per-key auth throttle (service-role only) used for the
-- credential brute-force lockout (validate-credentials), password-reset rate
-- limit (forgot-password) and registration rate limit (complete-register).
-- ============================================================================
create table if not exists public.auth_throttle (
  key        text primary key,
  count      integer not null default 0,
  window_end timestamptz not null default now()
);
alter table public.auth_throttle enable row level security; -- no policies → service-role only

create or replace function public.auth_throttle_peek(p_key text, p_limit integer)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (now() > window_end) or (count < p_limit)
       from public.auth_throttle where key = p_key),
    true);
$$;

create or replace function public.auth_throttle_hit(p_key text, p_window_seconds integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.auth_throttle (key, count, window_end)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    count = case when now() > auth_throttle.window_end then 1 else auth_throttle.count + 1 end,
    window_end = case when now() > auth_throttle.window_end then now() + make_interval(secs => p_window_seconds) else auth_throttle.window_end end;
end;
$$;

revoke all on function public.auth_throttle_peek(text, integer) from public, anon, authenticated;
revoke all on function public.auth_throttle_hit(text, integer) from public, anon, authenticated;
grant execute on function public.auth_throttle_peek(text, integer) to service_role;
grant execute on function public.auth_throttle_hit(text, integer) to service_role;
