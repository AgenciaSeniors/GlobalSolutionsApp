'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface PaymentFormProps {
  bookingId?: string;
}

export default function PaymentForm({ bookingId }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { t } = useLanguage();

  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onPay() {
    if (!stripe || !elements) return;

    setPaying(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message ?? t('payment.error.failed'));
      setPaying(false);
      return;
    }

    // ✅ Pago confirmado por Stripe en el cliente.
    // Llamamos a nuestro backend para actualizar el estado de la reserva
    // de 'pending' → 'paid' + 'pending_emission' de forma inmediata.
    // Esto garantiza que aparezca en el panel de emisión sin depender del webhook.
    if (bookingId) {
      try {
        const res = await fetch('/api/payments/stripe/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: bookingId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          console.error('[PaymentForm] confirm endpoint error:', data?.error);
        }
      } catch (confirmErr) {
        // No bloqueamos al usuario — el webhook de Stripe actuará como respaldo
        console.error('[PaymentForm] confirm fetch failed:', confirmErr);
      }
    }

    setSuccess(true);
    setPaying(false);
    router.push('/user/dashboard/bookings');
  }

  if (success) {
    return (
      <Card variant="bordered" className="p-6">
        <p className="font-bold text-emerald-600">{t('payment.success.title')}</p>
        <p className="mt-2 text-neutral-700">
          {t('payment.success.message')}
        </p>
        <div className="mt-4">
          <a className="underline" href="/user/dashboard/bookings">
            {t('payment.success.goToBookings')}
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="bordered" className="p-6">
      <h2 className="font-bold text-neutral-900">{t('payment.method')}</h2>

      <div className="mt-4">
        <PaymentElement />
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6">
        <Button onClick={onPay} disabled={!stripe || !elements || paying}>
          {paying ? t('payment.paying') : t('payment.pay')}
        </Button>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        {t('payment.noReload')}
      </p>
    </Card>
  );
}
