'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PayPalButtons } from '@paypal/react-paypal-js';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StripeCheckout from '@/components/features/payments/StripeCheckout';
import { toast } from 'sonner';

type PaymentMethod = 'stripe' | 'paypal';

type Props = {
  bookingId: string;
  amount: number;   // SOLO display (la verdad la calcula backend)
  currency: string; // 'USD'
};

type CreatePayPalOrderResponse = {
  order_id: string;
};

export default function PaymentSelector({ bookingId, amount, currency }: Props) {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('stripe');

  const formattedAmount = useMemo(() => {
    // display-only
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  }, [amount, currency]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setSelectedMethod('stripe')}
          className={[
            'rounded-xl border-2 p-4 text-left transition-all',
            selectedMethod === 'stripe' ? 'border-brand-500 bg-brand-50' : 'border-neutral-200 hover:border-neutral-300',
          ].join(' ')}
        >
          <p className="text-sm font-semibold">Tarjeta (Stripe)</p>
          <p className="text-xs text-neutral-500">Visa / Mastercard / Amex</p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedMethod('paypal')}
          className={[
            'rounded-xl border-2 p-4 text-left transition-all',
            selectedMethod === 'paypal' ? 'border-brand-500 bg-brand-50' : 'border-neutral-200 hover:border-neutral-300',
          ].join(' ')}
        >
          <p className="text-sm font-semibold">PayPal</p>
          <p className="text-xs text-neutral-500">Paga con tu cuenta PayPal</p>
        </button>
      </div>

      <Card variant="bordered" className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-600">Total (display)</p>
          <p className="text-sm font-bold">{formattedAmount}</p>
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          El cobro real lo calcula el servidor con tu reserva (booking_id).
        </p>
      </Card>

      {selectedMethod === 'stripe' ? (
        <StripeCheckout bookingId={bookingId} />
      ) : (
        <Card variant="bordered" className="p-4">
          <PayPalButtons
            style={{ layout: 'vertical' }}
            createOrder={async () => {
              const res = await fetch('/api/payments/paypal/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ booking_id: bookingId }), // ✅ SOLO booking_id
              });

              if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null;
                throw new Error(body?.error ?? 'No se pudo crear la orden de PayPal.');
              }

              const data = (await res.json()) as CreatePayPalOrderResponse;
              return data.order_id;
            }}
            onApprove={async () => {
              toast.success('Pago aprobado. Procesando confirmación...');
              router.push('/user/dashboard/bookings');
            }}
            onError={(err) => {
              console.error(err);
              toast.error('PayPal falló. Intenta nuevamente o usa Stripe.');
            }}
          />
          <div className="mt-3 flex justify-end">
            <Button variant="outline" onClick={() => setSelectedMethod('stripe')}>
              Usar tarjeta
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
