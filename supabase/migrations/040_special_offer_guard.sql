-- ============================================================================
-- 040_special_offer_guard.sql  (already applied to production)
-- special_offers had an UPDATE policy "Authenticated users can increment
-- sold_seats" USING (is_active=true) with NO column restriction, so any logged-in
-- user could tamper with ANY active offer (price, dates, etc.) via the REST API.
-- The legit use is the checkout incrementing sold_seats from the browser. This
-- BEFORE UPDATE guard lets non-admins change ONLY sold_seats, and only upward and
-- within max_seats (also prevents overselling). Admins/service-role keep full
-- control. SECURITY INVOKER so current_user reflects the caller. Verified on the
-- live DB (increment allowed, price-change and decrement blocked for non-admins).
-- ============================================================================
create or replace function public.enforce_special_offer_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin')
     or public.auth_uid_is_admin() then
    return new;
  end if;

  if (to_jsonb(new) - 'sold_seats' - 'updated_at')
     is distinct from (to_jsonb(old) - 'sold_seats' - 'updated_at') then
    raise exception 'No autorizado para modificar esta oferta' using errcode = '42501';
  end if;

  if new.sold_seats < old.sold_seats then
    raise exception 'sold_seats no puede disminuir' using errcode = '42501';
  end if;
  if new.sold_seats > new.max_seats then
    raise exception 'No hay cupos suficientes para esta oferta' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_special_offer_guard on public.special_offers;
create trigger trg_special_offer_guard
  before update on public.special_offers
  for each row execute function public.enforce_special_offer_guard();
