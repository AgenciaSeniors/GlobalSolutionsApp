-- ============================================================================
-- 028_booking_payment_guard.sql  (already applied to production)
-- Blocks payment-field tampering on bookings. The `bookings_update_own` RLS
-- policy + column grants let any authenticated user PATCH their own booking and
-- set payment_status='paid' / lower total_amount (confirm without paying).
-- Payment fields are only written by the server confirm routes (service_role),
-- so this BEFORE UPDATE guard allows only service_role / admins to change them.
--
-- SECURITY INVOKER (default) is REQUIRED so current_user reflects the caller's
-- role; a SECURITY DEFINER function would see the owner and never block.
-- ============================================================================
create or replace function public.enforce_booking_payment_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin')
     or public.auth_uid_is_admin() then
    return new;
  end if;

  if new.payment_status  is distinct from old.payment_status
  or new.total_amount    is distinct from old.total_amount
  or new.payment_method  is distinct from old.payment_method
  or new.payment_gateway is distinct from old.payment_gateway
  or new.paid_at         is distinct from old.paid_at then
    raise exception 'No autorizado para modificar campos de pago de la reserva'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_booking_payment_guard on public.bookings;
create trigger trg_booking_payment_guard
  before update on public.bookings
  for each row execute function public.enforce_booking_payment_guard();
