"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

import PaymentForm from "@/components/features/payments/PaymentForm";

type PaymentMethod = "stripe" | "paypal";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getStringField(obj: unknown, key: string): string | null {
  if (!isRecord(obj)) return null;
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

export default function PayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookingId = searchParams.get("booking_id");
  const methodParam = searchParams.get("method");

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(
    methodParam === "paypal" ? "paypal" : "stripe"
  );

  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  const paypalOptions = useMemo(() => {
    return {
      clientId: paypalClientId ?? "",
      currency: "USD",
      intent: "capture",
    };
  }, [paypalClientId]);

  useEffect(() => {
    const id = bookingId;
    if (!id) return;
    if (selectedMethod !== "stripe") return;

    let cancelled = false;

    async function createIntent() {
      try {
        setError(null);
        setStripeLoading(true);

        const res = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ booking_id: id }),
        });

        const raw: unknown = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = getStringField(raw, "error") ?? "No se pudo iniciar el pago con Stripe.";
          throw new Error(msg);
        }

        const clientSecret = getStringField(raw, "client_secret");
        if (!clientSecret) {
          throw new Error("Stripe: falta client_secret en la respuesta del servidor.");
        }

        if (!cancelled) setStripeClientSecret(clientSecret);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        if (!cancelled) setStripeLoading(false);
      }
    }

    createIntent();
    return () => {
      cancelled = true;
    };
  }, [bookingId, selectedMethod]);

  useEffect(() => {
    if (methodParam === "paypal") setSelectedMethod("paypal");
    if (methodParam === "stripe") setSelectedMethod("stripe");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!bookingId) {
    return (
      <>
        <Navbar />
        <div className="mx-auto max-w-3xl p-6 pt-24">
          <Card variant="bordered" className="p-6">
            <p className="text-sm text-red-600">Falta booking_id en la URL.</p>
            <div className="mt-4">
              <Button onClick={() => router.push("/flights")}>Volver</Button>
            </div>
          </Card>
        </div>
        <Footer />
      </>
    );
  }

  if (!paypalClientId) {
    return (
      <>
        <Navbar />
        <div className="mx-auto max-w-3xl p-6 pt-24">
          <Card variant="bordered" className="p-6">
            <p className="text-sm text-red-600">Falta NEXT_PUBLIC_PAYPAL_CLIENT_ID en .env.local</p>
          </Card>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-3xl p-6 pt-24">
        <Card variant="bordered" className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Pago</h1>
              <p className="mt-1 text-xs text-neutral-500">
                Booking: <span className="font-mono">{bookingId}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedMethod("stripe")}
                className={selectedMethod === "stripe" ? "border-brand-500 bg-brand-50" : ""}
              >
                Tarjeta (Stripe)
              </Button>

              <Button
                variant="outline"
                onClick={() => setSelectedMethod("paypal")}
                className={selectedMethod === "paypal" ? "border-brand-500 bg-brand-50" : ""}
              >
                PayPal
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {selectedMethod === "stripe" ? (
            <div className="space-y-3">
              {stripeLoading && <p className="text-sm text-neutral-500">Preparando pago con Stripe…</p>}

              {!stripeLoading && stripeClientSecret && (
                <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
                  <PaymentForm />
                </Elements>
              )}
            </div>
          ) : (
            <PayPalScriptProvider options={paypalOptions}>
              <PayPalButtons
                style={{ layout: "vertical" }}
                createOrder={async () => {
                  setError(null);

                  const res = await fetch("/api/payments/paypal/create-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ booking_id: bookingId }),
                  });

                  const raw: unknown = await res.json().catch(() => null);

                  if (!res.ok) {
                    const msg = getStringField(raw, "error") ?? "No se pudo crear la orden de PayPal.";
                    throw new Error(msg);
                  }

                  const orderId = getStringField(raw, "order_id");
                  if (!orderId) throw new Error("PayPal: falta order_id en la respuesta del servidor.");

                  return orderId;
                }}
                onApprove={async () => {
                  // Paid real: webhook backend. Aquí solo UX.
                  router.push("/user/dashboard/bookings");
                }}
                onError={(err: unknown) => {
                  console.error(err);
                  setError("PayPal falló. Intenta nuevamente o usa Stripe.");
                }}
              />
            </PayPalScriptProvider>
          )}
        </Card>
      </div>
      <Footer />
    </>
  );
}
