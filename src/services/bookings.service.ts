/**
 * @fileoverview Service layer for booking CRUD operations.
 * @module services/bookings.service
 */
import { createClient } from '@/lib/supabase/client';
import type { CreateBookingPayload } from '@/types/api.types';
import type { Booking, BookingWithDetails } from '@/types/models';

function generateBookingCode(): string {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GST-${rand}`;
}

async function create(payload: CreateBookingPayload): Promise<Booking> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión para reservar.');

  const { data: flight, error: flightErr } = await supabase
    .from('flights')
    .select('final_price, available_seats')
    .eq('id', payload.flight_id)
    .single();

  if (flightErr || !flight) throw new Error('Vuelo no encontrado.');
  if (flight.available_seats < payload.passengers.length) {
    throw new Error('No hay suficientes asientos disponibles.');
  }

  const subtotal = flight.final_price * payload.passengers.length;
  const totalAmount = subtotal;

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      booking_code: generateBookingCode(),
      user_id: user.id,
      flight_id: payload.flight_id,
      subtotal,
      total_amount: totalAmount,
    })
    .select()
    .single();

  if (bookingErr || !booking) throw new Error('Error creando la reserva.');

  const passengers = payload.passengers.map((p) => ({
    booking_id: booking.id,
    first_name: p.first_name,
    last_name: p.last_name,
    date_of_birth: p.date_of_birth,
    nationality: p.nationality,
    passport_number: p.passport_number,
    passport_expiry_date: p.passport_expiry_date,
  }));

  const { error: paxErr } = await supabase
    .from('booking_passengers')
    .insert(passengers);

  if (paxErr) throw new Error('Error guardando datos de pasajeros.');

  return booking as Booking;
}

async function listForCurrentUser(): Promise<Booking[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
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

function normalizePassengers(b: BookingWithDetails): BookingWithDetails {
  return {
    ...b,
    passengers: Array.isArray(b.passengers) ? b.passengers : [],
  };
}

async function listWithDetails(): Promise<BookingWithDetails[]> {
  const res = await fetch('/api/bookings', { method: 'GET' });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'No se pudieron cargar tus reservas.');
  }

  const json = (await res.json().catch(() => null)) as { data?: BookingWithDetails[] } | null;
  const data = json?.data ?? [];

  return data.map(normalizePassengers);
}

export const bookingsService = { create, listWithDetails, listForCurrentUser, getById };
