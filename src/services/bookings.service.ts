/**
 * @fileoverview Service layer for booking CRUD operations.
 * @module services/bookings.service
 */
import { createClient } from '@/lib/supabase/client';
import type { CreateBookingPayload } from '@/types/api.types';
import type { Booking, BookingWithDetails } from '@/types/models';

/**
 * Create a booking. Runs server-side (POST /api/bookings/create): the price is
 * computed authoritatively on the server and passengers are encrypted there
 * (the encryption key is server-only), so the browser cannot tamper with the
 * total or access the secret.
 */
async function create(payload: CreateBookingPayload): Promise<Booking> {
  const res = await fetch('/api/bookings/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? 'Error creando la reserva.');
  }

  return data.booking as Booking;
}

async function listForCurrentUser(): Promise<Booking[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Booking[];
}

async function getById(id: string): Promise<Booking | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Booking;
}

async function listWithDetails(): Promise<BookingWithDetails[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      flight:flights(
        *,
        airline:airlines(*),
        origin_airport:airports!origin_airport_id(*),
        destination_airport:airports!destination_airport_id(*)
      ),
      passengers:booking_passengers(*)
    `,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []) as BookingWithDetails[];
}

export const bookingsService = { create, listForCurrentUser, listWithDetails, getById };