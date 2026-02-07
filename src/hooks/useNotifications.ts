/**
 * @fileoverview Hook for sending email notifications from admin pages.
 * Calls /api/notifications with the current user's auth token.
 * @module hooks/useNotifications
 */
'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

type NotificationType =
  | 'booking_confirmation'
  | 'emission_complete'
  | 'payment_receipt'
  | 'booking_cancelled'
  | 'review_request'
  | 'welcome';

interface SendNotificationResult {
  success: boolean;
  id?: string;
  error?: string;
}

export function useNotifications() {
  const supabase = createClient();

  const sendNotification = useCallback(async (
    type: NotificationType,
    email: string,
    data: Record<string, unknown>
  ): Promise<SendNotificationResult> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      if (!token) {
        return { success: false, error: 'No auth session' };
      }

      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ type, email, data }),
      });

      const result = await response.json();
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [supabase]);

  /** Shortcut: send emission complete notification */
  const notifyEmission = useCallback(async (
    clientEmail: string,
    data: {
      clientName: string;
      bookingCode: string;
      airlinePnr: string;
      flightNumber: string;
      airline: string;
      origin: string;
      originCity: string;
      destination: string;
      destinationCity: string;
      departureDate: string;
      passengers: { name: string; ticketNumber: string | null }[];
    }
  ) => sendNotification('emission_complete', clientEmail, data), [sendNotification]);

  /** Shortcut: send booking cancelled notification */
  const notifyCancellation = useCallback(async (
    clientEmail: string,
    data: { clientName: string; bookingCode: string; reason?: string }
  ) => sendNotification('booking_cancelled', clientEmail, data), [sendNotification]);

  /** Shortcut: send review request */
  const notifyReviewRequest = useCallback(async (
    clientEmail: string,
    data: { clientName: string; bookingCode: string; destination: string }
  ) => sendNotification('review_request', clientEmail, data), [sendNotification]);

  return { sendNotification, notifyEmission, notifyCancellation, notifyReviewRequest };
}
