-- ============================================================================
-- 029_profile_privilege_guard.sql  (already applied to production)
-- Blocks privilege escalation via profiles. 'authenticated' has column UPDATE
-- on role / loyalty_points / agent_fund_cents / agent_code / is_active, and the
-- "update own profile" RLS policies only check id = auth.uid(), so any user
-- could PATCH their own profile to role='admin', self-award loyalty points, or
-- credit themselves agent funds. This guard allows only service_role / admins
-- to change those privileged fields; name/phone/avatar stay user-editable.
--
-- SECURITY INVOKER (default) is REQUIRED so current_user reflects the caller.
-- ============================================================================
create or replace function public.enforce_profile_privilege_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin')
     or public.auth_uid_is_admin() then
    return new;
  end if;

  if new.role             is distinct from old.role
  or new.loyalty_points   is distinct from old.loyalty_points
  or new.agent_fund_cents is distinct from old.agent_fund_cents
  or new.agent_code       is distinct from old.agent_code
  or new.is_active        is distinct from old.is_active then
    raise exception 'No autorizado para modificar campos protegidos del perfil'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profile_privilege_guard on public.profiles;
create trigger trg_profile_privilege_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_privilege_guard();
