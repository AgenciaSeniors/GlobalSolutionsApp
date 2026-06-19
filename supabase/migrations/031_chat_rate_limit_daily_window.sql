-- ============================================================================
-- 031_chat_rate_limit_daily_window.sql  (already applied to production)
-- The /api/chat route uses a per-DAY key (u:<id>:YYYY-MM-DD) with per-day limits
-- (5 guest / 25 user), but increment_chat_rate_limit reset its window every
-- 1 MINUTE, so the daily cap reset each minute (5/25 per minute, unlimited per
-- day → OpenAI cost abuse). Align the window to 1 day.
-- ============================================================================
create or replace function public.increment_chat_rate_limit(
  p_key   text,
  p_limit int
)
returns table(allowed boolean, count int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count      int;
  v_window_end timestamptz;
begin
  select c.count, c.window_end
    into v_count, v_window_end
    from chat_rate_limit_tokens c
   where c.key = p_key
     for update;

  if not found or now() > v_window_end then
    insert into chat_rate_limit_tokens (key, count, window_end)
    values (p_key, 1, now() + interval '1 day')
    on conflict (key) do update
       set count      = 1,
           window_end = now() + interval '1 day';

    return query select true::boolean, 1::int;
  else
    update chat_rate_limit_tokens
       set count = count + 1
     where key = p_key;

    v_count := v_count + 1;
    return query select (v_count <= p_limit)::boolean, v_count::int;
  end if;
end;
$$;
