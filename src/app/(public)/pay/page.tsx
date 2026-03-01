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
  const [senderName, setSenderName] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);

  // Fetch booking details to show booking_code and total
  useEffect(() => {
    async function fetchBookingDetails() {
      try {
        const res = await fetch(`/api/bookings?id=${bookingId}`);
        const data = await res.json().catch(() => null);
        if (data?.booking_code) setBookingCode(data.booking_code);
        if (data?.total_amount) setTotalAmount(Number(data.total_amount));
      } catch {
        // Fallback: just show ID
      }
    }
    if (bookingId) fetchBookingDetails();
  }, [bookingId]);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("booking_id", bookingId);
      formData.append("file", file);
      if (senderName.trim()) formData.append("sender_name", senderName.trim());
      if (referenceNumber.trim()) formData.append("reference_number", referenceNumber.trim());

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

  const displayCode = bookingCode || bookingId.slice(0, 8);
  const whatsappPhone = (settings.business_phone || "").replace(/[^0-9+]/g, "").replace(/^\+/, "");
  const whatsappMsg = encodeURIComponent(
    `Hola, quiero realizar el pago por Zelle para mi reserva *${displayCode}*` +
    (totalAmount ? ` por un monto de *$${totalAmount.toFixed(2)}*` : "") +
    `. Por favor envíenme los datos de la cuenta.`
  );
  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${whatsappMsg}`;

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-3xl p-6 pt-24">
        <Card variant="bordered" className="p-6 space-y-5">
          <h1 className="text-xl font-semibold">Pago por Zelle</h1>

          {/* Booking Summary */}
          <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-500 uppercase font-medium">Reserva</p>
              <p className="text-lg font-bold font-mono text-brand-600">{displayCode}</p>
            </div>
            {totalAmount !== null && (
              <div className="text-right">
                <p className="text-xs text-neutral-500 uppercase font-medium">Total a pagar</p>
                <p className="text-2xl font-extrabold text-neutral-900">${totalAmount.toFixed(2)}</p>
              </div>
            )}
          </div>

          {/* Step 1: Contact via WhatsApp */}
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white text-sm font-bold">1</span>
              <h2 className="font-bold text-emerald-800">Solicita los datos de pago por WhatsApp</h2>
            </div>
            <p className="text-sm text-emerald-700">
              Contáctanos por WhatsApp para recibir los datos de la cuenta Zelle donde realizar la transferencia.
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white px-5 py-3 font-semibold text-sm transition-colors shadow-sm"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Contactar por WhatsApp
            </a>
          </div>

          {/* Step 2: Upload Proof */}
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">2</span>
              <h2 className="font-bold text-blue-800">Sube tu comprobante de pago</h2>
            </div>
            <p className="text-sm text-blue-700">
              Una vez realizada la transferencia, sube el comprobante e ingresa los datos de la transacción.
            </p>

            {/* Sender Info Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-blue-800">Nombre del remitente</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-blue-800">Referencia de transferencia</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Número de confirmación"
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

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
