"use client";

export const dynamic = 'force-dynamic';

/**
 * /pay — Checkout page
 *
 * Stripe:  create-intent → user enters card → Stripe confirms via webhook
 * PayPal:  create-order  → user approves    → capture-order (server-side) → webhook safety net
 */

import { Suspense, useRef } from "react";
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
import { useAppSettings } from "@/hooks/useAppSettings";

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

  /* ── Zelle: payment details + upload proof ── */
  if (selectedMethod === "zelle") {
    return <ZellePaySection bookingId={bookingId} />;
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

/* ── Zelle Payment Section ── */
function ZellePaySection({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const { settings } = useAppSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("booking_id", bookingId);
      formData.append("file", file);

      const res = await fetch("/api/payments/zelle/upload-proof", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Error al subir comprobante");

      setProofUrl(data.proof_url);
      setFileName(file.name);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error al subir archivo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-3xl p-6 pt-24">
        <Card variant="bordered" className="p-6 space-y-5">
          <h1 className="text-xl font-semibold">Pago por Zelle</h1>
          <p className="text-sm text-neutral-500">
            Booking: <span className="font-mono">{bookingId}</span>
          </p>

          {/* Step 1: Payment Details */}
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 space-y-3">
            <h2 className="font-bold text-emerald-800">Paso 1: Realiza la transferencia</h2>
            <p className="text-sm text-emerald-700">
              Envía el monto total por Zelle a la siguiente cuenta:
            </p>
            <div className="rounded-lg bg-white p-4 border border-emerald-200">
              <p className="text-sm text-neutral-600">Enviar Zelle a:</p>
              <p className="text-lg font-bold text-neutral-900 font-mono">
                {settings.business_email}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {settings.business_name} · {settings.business_phone}
              </p>
            </div>
          </div>

          {/* Step 2: Upload Proof */}
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5 space-y-3">
            <h2 className="font-bold text-blue-800">Paso 2: Sube tu comprobante</h2>
            <p className="text-sm text-blue-700">
              Sube una captura de pantalla o foto del comprobante de tu transferencia Zelle.
            </p>

            {proofUrl ? (
              <div className="rounded-lg bg-white p-4 border border-emerald-300 space-y-2">
                <p className="text-sm font-semibold text-emerald-700">
                  ✅ Comprobante subido exitosamente
                </p>
                <p className="text-xs text-neutral-500">{fileName}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="block w-full text-sm text-neutral-600
                    file:mr-4 file:rounded-lg file:border-0
                    file:bg-blue-600 file:px-4 file:py-2
                    file:text-sm file:font-semibold file:text-white
                    hover:file:bg-blue-700 file:cursor-pointer"
                />
                {uploadError && (
                  <p className="text-sm text-red-600">{uploadError}</p>
                )}
                <Button
                  onClick={handleUpload}
                  isLoading={uploading}
                  disabled={uploading}
                  className="w-full"
                >
                  Subir Comprobante
                </Button>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p>
              <strong>¿Qué sucede después?</strong> Un administrador verificará tu pago y
              confirmará tu reserva. Recibirás una notificación por correo cuando esté listo.
              Tiempo estimado: <strong>2–4 horas</strong>.
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

export default function PayPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-neutral-500 animate-pulse">Cargando...</p></div>}>
      <PayPageInner />
    </Suspense>
  );
}
