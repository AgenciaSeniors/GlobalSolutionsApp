/**
 * @fileoverview Hook for creating a booking and initiating payment.
 * @module hooks/useBooking
 */
'use client';

import { useState } from 'react';
import type { CreateBookingPayload } from '@/types/api.types';
import type { Booking } from '@/types/models';
import { bookingsService } from '@/services/bookings.service';

export function useBooking() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(payload: CreateBookingPayload) {
    setIsLoading(true);
    setError(null);

    try {
      const data = await bookingsService.create(payload);
      setBooking(data);
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creando reserva';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return { booking, isLoading, error, create };
}
