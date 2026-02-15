'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

import Card from '@/components/ui/Card';
import PaymentForm from '@/components/features/payments/PaymentForm';
import type { PriceBreakdown } from '@/types/models';

type CreateIntentResponse = {
  client_secret: string;
  breakdown: PriceBreakdown;
};

type Props = {
  bookingId: string;
};

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

export default function StripeCheckout({ bookingId }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function createIntent() {
      try {
        setError(null);

        const res = await fetch('/api/payments/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // ✅ SOLO booking_id (no amounts)
          body: JSON.stringify({ booking_id: bookingId }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? 'No se pudo iniciar el pago con Stripe.');
        }

        const data = (await res.json()) as CreateIntentResponse;
        if (!cancelled) setClientSecret(data.client_secret);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error inesperado');
      }
    }

    createIntent();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const options = useMemo(() => {
    if (!clientSecret) return null;
    return { clientSecret };
  }, [clientSecret]);

  if (error) {
    return (
      <Card variant="bordered" className="p-6">
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  if (!options) {
    return (
      <Card variant="bordered" className="p-6">
        <p className="text-sm text-neutral-500">Preparando pago con Stripe…</p>
      </Card>
    );
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm />
    </Elements>
  );
}
