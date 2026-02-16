/**
 * @fileoverview Service layer for booking CRUD operations.
 * @module services/bookings.service
 */
import { createClient } from '@/lib/supabase/server';
import type { CreateBookingPayload } from '@/types/api.types';
import type { Booking } from '@/types/models';

function generateBookingCode(): string {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GST-${rand}`;
}

async function create(payload: CreateBookingPayload): Promise<Booking> {
  // CORRECCIÓN: Añadido 'await' porque createClient en el servidor es una Promesa
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión para reservar.');

  // 1. Validar Vuelo y Disponibilidad
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

  // 2. Crear la Reserva (Booking Header)
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


  // 3. Insertar Pasajeros con ENCRIPTACIÓN (Módulo 3.2)
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey) {
    console.error('❌ CRITICAL ERROR: SUPABASE_SERVICE_ROLE_KEY faltante en .env.local');
    // Borramos la reserva huérfana para no dejar basura en la DB
    await supabase.from('bookings').delete().eq('id', booking.id);
    throw new Error('Error interno de seguridad: Llave de encriptación no configurada.');
  }

  // Iteramos cada pasajero para encriptarlo individualmente usando la función de DB
  for (const p of payload.passengers) {
    const { error: rpcError } = await supabase.rpc('insert_encrypted_passenger', {
      p_booking_id: booking.id,
      p_first_name: p.first_name,
      p_last_name: p.last_name,
      p_date_of_birth: p.date_of_birth,
      p_nationality: p.nationality,
      p_passport_number: p.passport_number, // El dato sensible
      p_passport_expiry_date: p.passport_expiry_date,
      p_secret_key: secretKey
    });

    if (rpcError) {
      console.error('⚠️ Error guardando pasajero encriptado:', rpcError.message);
      throw new Error('Error guardando datos protegidos de los pasajeros.');
    }
  }

  return booking as Booking;
}

async function listForCurrentUser(): Promise<Booking[]> {
  // CORRECCIÓN: Añadido 'await'
  const supabase = await createClient();
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
  // CORRECCIÓN: Añadido 'await'
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Booking;
}

export const bookingsService = { create, listForCurrentUser, getById };