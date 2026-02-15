/**
 * @fileoverview Service layer for booking CRUD operations.
 * @module services/bookings.service
 */
import { createClient } from '@/lib/supabase/client';
import type { CreateBookingPayload } from '@/types/api.types';
import type { Booking } from '@/types/models';

function generateBookingCode(): string {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GST-${rand}`;
}

async function create(payload: CreateBookingPayload): Promise<Booking> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión para reservar.');

  // Fetch flight price
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
  const totalAmount = subtotal; // gateway fee added during payment

  // Insert booking
  const { data: booking, error: bookingErr } = await supabase
  .from('bookings')
  .insert({
    booking_code: generateBookingCode(),
    user_id: user.id,
    flight_id: payload.flight_id,
    subtotal,
    payment_gateway_fee: 0,          // 👈 agrega
    total_amount: totalAmount,
    payment_method: 'stripe',        // 👈 agrega
    payment_status: 'pending',       // 👈 agrega
    booking_status: 'pending_emission', // 👈 agrega
  })
  .select()
  .single();


  if (bookingErr || !booking) throw new Error(bookingErr?.message ?? 'Error creando la reserva.');


  // Insert passengers (passport encrypted via DB function)
  const passengers = payload.passengers.map((p) => ({
    booking_id: booking.id,
    first_name: p.first_name,
    last_name: p.last_name,
    date_of_birth: p.date_of_birth,
    nationality: p.nationality,
    passport_number: p.passport_number, // Will be encrypted by RPC in production
    passport_expiry_date: p.passport_expiry_date,
  }));

  const { error: paxErr } = await supabase
    .from('booking_passengers')
    .insert(passengers);

  if (paxErr) throw new Error(paxErr.message);

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

export const bookingsService = { create, listForCurrentUser, getById };
