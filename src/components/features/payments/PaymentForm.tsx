'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

export default function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();

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
      setError(result.error.message ?? 'Pago fallido.');
      setPaying(false);
      return;
    }

    setSuccess(true);
    setPaying(false);
  }

  if (success) {
    return (
      <Card variant="bordered" className="p-6">
        <p className="font-bold text-emerald-600">Pago confirmado</p>
        <p className="mt-2 text-neutral-700">
          Tu pago fue procesado. Puedes volver a tus reservas.
        </p>
        <div className="mt-4">
          <a className="underline" href="/user/dashboard/bookings">
            Ir a Mis Reservas
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="bordered" className="p-6">
      <h2 className="font-bold text-neutral-900">Método de pago</h2>

      <div className="mt-4">
        <PaymentElement />
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6">
        <Button onClick={onPay} disabled={!stripe || !elements || paying}>
          {paying ? 'Procesando...' : 'Pagar'}
        </Button>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        No recargues la página durante el pago.
      </p>
    </Card>
  );
}
