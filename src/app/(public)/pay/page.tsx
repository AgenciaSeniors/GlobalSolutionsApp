'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

import { useAuthContext } from '@/components/providers/AuthProvider';
import { createPaymentIntent, type PaymentBreakdown } from '@/services/payments.service';

import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import PaymentForm from '@/components/features/payments/PaymentForm';

function formatMoney(amount?: number, currency?: string) {
  if (amount == null) return '-';
  const c = currency ?? 'USD';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(amount);
}

export default function PayPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user } = useAuthContext();

  // 1) leer booking_id de la URL: /pay?booking_id=123
  const bookingId = sp.get('booking_id');

  // 2) Stripe key (frontend)
  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) return null;
    return loadStripe(key);
  }, []);

  // 3) estados UI
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 4) respuesta del backend
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>('USD');
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<PaymentBreakdown | null>(null);

  // A) exigir login (si no hay user, mandarlo al login)
  useEffect(() => {
    if (user === null) return; // auth todavía cargando
    if (!user) {
      const redirect = `/pay?booking_id=${encodeURIComponent(bookingId ?? '')}`;
      router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
    }
  }, [user, bookingId, router]);

  // B) crear intent (NO calcular precios)
  useEffect(() => {
    if (!user) return;

    if (!bookingId) {
      setError('Falta booking_id en la URL. Ejemplo: /pay?booking_id=...');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setCreating(true);
        setError(null);

        const res = await createPaymentIntent(bookingId as string);


        if (cancelled) return;

        setClientSecret(res.client_secret);
        if (res.currency) setCurrency(res.currency);
        if (typeof res.total_amount === 'number') setTotalAmount(res.total_amount);
        if (res.breakdown) setBreakdown(res.breakdown);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? 'Error creando el pago. Intenta nuevamente.');
      } finally {
        if (!cancelled) {
          setCreating(false);
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user, bookingId]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24">

        <div className="mx-auto max-w-3xl p-6">
          <h1 className="text-2xl font-bold text-neutral-900">Pago</h1>
          <p className="mt-1 text-neutral-500">Completa el pago de tu reserva.</p>

          <div className="mt-6 space-y-4">
            {loading ? (
              <Card variant="bordered" className="p-6">
                <p className="text-neutral-500">Preparando pago...</p>
              </Card>
            ) : error ? (
              <Card variant="bordered" className="p-6">
                <p className="text-red-600 font-semibold">Error</p>
                <p className="mt-2 text-neutral-700">{error}</p>
                <div className="mt-4">
                  <Button onClick={() => router.refresh()} disabled={creating}>
                    Reintentar
                  </Button>
                </div>
              </Card>
            ) : (
              <>
                {/* Resumen de monto */}
                <Card variant="bordered" className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">Total</span>
                    <span className="text-lg font-bold text-neutral-900">
                      {formatMoney(
                        totalAmount ?? (breakdown?.total_amount as number | undefined),
                        currency
                      )}
                    </span>
                  </div>

                  {/* Breakdown opcional */}
                  {breakdown && (
                    <div className="mt-4 text-sm text-neutral-700 space-y-2">
                      {'subtotal' in breakdown && (
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>{formatMoney(breakdown.subtotal as number | undefined, currency)}</span>
                        </div>
                      )}
                      {'markup' in breakdown && (
                        <div className="flex justify-between">
                          <span>Markup</span>
                          <span>{formatMoney(breakdown.markup as number | undefined, currency)}</span>
                        </div>
                      )}
                      {'gateway_fee' in breakdown && (
                        <div className="flex justify-between">
                          <span>Fee pasarela</span>
                          <span>{formatMoney(breakdown.gateway_fee as number | undefined, currency)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                {/* Stripe Elements */}
                {!stripePromise ? (
                  <Card variant="bordered" className="p-6">
                    <p className="text-red-600 font-semibold">Falta configuración de Stripe</p>
                    <p className="mt-2 text-neutral-700">
                      No existe NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY en .env.local
                    </p>
                  </Card>
                ) : !clientSecret ? (
                  <Card variant="bordered" className="p-6">
                    <p className="text-neutral-500">No se recibió client_secret.</p>
                  </Card>
                ) : (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <PaymentForm />
                  </Elements>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
