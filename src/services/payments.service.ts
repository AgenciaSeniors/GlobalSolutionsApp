import { postJSON } from '@/lib/api/fetcher';

export type PaymentBreakdown = {
  subtotal?: number;
  markup?: number;
  gateway_fee?: number;
  total_amount?: number;
  currency?: string;
  [key: string]: unknown;
};

export type CreateIntentResponse = {
  client_secret: string;
  total_amount?: number;
  currency?: string;
  breakdown?: PaymentBreakdown;
};

export async function createPaymentIntent(booking_id: string): Promise<CreateIntentResponse> {
  return postJSON('/api/payments/create-intent', { booking_id });
}
