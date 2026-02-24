"use client";

export const dynamic = 'force-dynamic';

/**
 * /pay — Checkout page
 *
 * Stripe:  create-intent → user enters card → Stripe confirms via webhook
 * PayPal:  create-order  → user approves    → capture-order (server-side) → webhook safety net
 */

import { Suspense } from "react";
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

type PaymentMethod = "stripe" | "paypal" | "zelle";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getStr(obj: unknown, key: string): string | null {
  if (!isRecord(obj)) return null;
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

function PayPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking_id");
  const methodParam = searchParams.get("method");

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(
    methodParam === "paypal" ? "paypal" : methodParam === "zelle" ? "zelle" : "stripe"
  );
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [paypalCapturing, setPaypalCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  const paypalOptions = useMemo(
    () => ({ clientId: paypalClientId ?? "", currency: "USD", intent: "capture" }),
    [paypalClientId]
  );

  /* ── Stripe: create intent ── */
  useEffect(() => {
    if (!bookingId || selectedMethod !== "stripe") return;
    let cancelled = false;

    (async () => {
      try {
        setError(null);
        setStripeLoading(true);
        const res = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ booking_id: bookingId }),
        });
        const raw: unknown = await res.json().catch(() => null);
        if (!res.ok) throw new Error(getStr(raw, "error") ?? "No se pudo iniciar el pago con Stripe.");
        const cs = getStr(raw, "client_secret");
        if (!cs) throw new Error("Stripe: falta client_secret en la respuesta.");
        if (!cancelled) setStripeClientSecret(cs);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        if (!cancelled) setStripeLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [bookingId, selectedMethod]);

  useEffect(() => {
    if (methodParam === "paypal") setSelectedMethod("paypal");
    else if (methodParam === "zelle") setSelectedMethod("zelle");
    else if (methodParam === "stripe") setSelectedMethod("stripe");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── PayPal: capture after approval ── */
  async function capturePayPal(orderId: string) {
    setPaypalCapturing(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, booking_id: bookingId }),
      });
      const raw: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getStr(raw, "error") ?? "No se pudo capturar el pago.");
      router.push("/user/dashboard/bookings");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al capturar el pago");
    } finally {
      setPaypalCapturing(false);
    }
  }

  /* ── Guards ── */
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

  if (!paypalClientId && selectedMethod === "paypal") {
    return (
      <>
        <Navbar />
        <div className="mx-auto max-w-3xl p-6 pt-24">
          <Card variant="bordered" className="p-6">
            <p className="text-sm text-red-600">
              Falta NEXT_PUBLIC_PAYPAL_CLIENT_ID en .env.local
            </p>
          </Card>
        </div>
        <Footer />
      </>
    );
  }

  /* ── Zelle: show confirmation message ── */
  if (selectedMethod === "zelle") {
    return (
      <>
        <Navbar />
        <div className="mx-auto max-w-3xl p-6 pt-24">
          <Card variant="bordered" className="p-6 space-y-4">
            <h1 className="text-xl font-semibold">Pago por Zelle</h1>
            <p className="text-sm text-neutral-500">
              Booking: <span className="font-mono">{bookingId}</span>
            </p>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 space-y-2">
              <p className="font-semibold">Tu reserva ha sido registrada exitosamente.</p>
              <p>
                Para completar el pago, realiza una transferencia por Zelle a la cuenta indicada
                en tu correo de confirmación o contacta a nuestro equipo.
              </p>
              <p>
                Una vez recibido tu pago, un administrador lo verificará y tu reserva será confirmada.
                Recibirás una notificación cuando esto suceda.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => router.push("/user/dashboard/bookings")}>
                Ver mis reservas
              </Button>
              <Button variant="outline" onClick={() => router.push("/")}>
                Volver al inicio
              </Button>
            </div>
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
          {/* Header + selector */}
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

          {/* Errors */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {paypalCapturing && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              Capturando pago con PayPal…
            </div>
          )}

          {/* Gateway UI */}
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
                disabled={paypalCapturing}
                createOrder={async () => {
                  setError(null);
                  const res = await fetch("/api/payments/paypal/create-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ booking_id: bookingId }),
                  });
                  const raw: unknown = await res.json().catch(() => null);
                  if (!res.ok)
                    throw new Error(getStr(raw, "error") ?? "No se pudo crear la orden de PayPal.");
                  const oid = getStr(raw, "order_id");
                  if (!oid) throw new Error("PayPal: falta order_id.");
                  return oid;
                }}
                onApprove={async (data) => {
                  await capturePayPal(data.orderID);
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

export default function PayPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-neutral-500 animate-pulse">Cargando...</p></div>}>
      <PayPageInner />
    </Suspense>
  );
}
