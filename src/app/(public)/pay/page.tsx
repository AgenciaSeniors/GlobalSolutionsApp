"use client";

export const dynamic = 'force-dynamic';

/**
 * /pay — Manual Payment Page
 *
 * All methods (Zelle, PIX, SPEI, Square) follow the same flow:
 * 1. Show booking summary
 * 2. Select payment method
 * 3. Contact via WhatsApp with pre-built message
 * 4. Upload payment proof
 * 5. Admin confirms manually
 */

import { Suspense, useRef } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Banknote, CreditCard, MessageCircle } from "lucide-react";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useAppSettings } from "@/hooks/useAppSettings";

type PaymentMethod = "zelle" | "pix" | "spei" | "square";

const PAYMENT_METHODS: Array<{
  id: PaymentMethod;
  label: string;
  sub: string;
  icon: typeof Banknote;
}> = [
  { id: "zelle", label: "Zelle", sub: "Transferencia USA", icon: Banknote },
  { id: "pix", label: "PIX", sub: "Transferencia Brasil", icon: Banknote },
  { id: "spei", label: "SPEI", sub: "Transferencia Mexico", icon: Banknote },
  { id: "square", label: "Tarjeta / Square", sub: "Visa, Mastercard, Amex", icon: CreditCard },
];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  zelle: "Zelle (USA)",
  pix: "PIX (Brasil)",
  spei: "SPEI (Mexico)",
  square: "Tarjeta de credito/debito (Square)",
};

type BookingPassenger = {
  first_name: string;
  last_name: string;
  passport_number: string;
  passport_expiry_date: string;
  nationality: string;
};

type BookingData = {
  booking_code?: string;
  total_amount?: number;
  contact_email?: string;
  contact_phone?: string;
  passengers?: BookingPassenger[];
  flight?: {
    departure_datetime?: string;
    origin_airport?: { iata_code?: string; city?: string };
    destination_airport?: { iata_code?: string; city?: string };
  } | null;
};

function PayPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking_id");
  const methodParam = searchParams.get("method");

  const validMethods: PaymentMethod[] = ["zelle", "pix", "spei", "square"];
  const initialMethod: PaymentMethod = validMethods.includes(methodParam as PaymentMethod)
    ? (methodParam as PaymentMethod)
    : "zelle";

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(initialMethod);
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
  const [bookingData, setBookingData] = useState<BookingData>({});

  // Fetch booking details
  useEffect(() => {
    async function fetchBookingDetails() {
      try {
        const res = await fetch(`/api/bookings?id=${bookingId}`);
        const data: BookingData = await res.json().catch(() => null);
        if (data?.booking_code) setBookingCode(data.booking_code);
        if (data?.total_amount) setTotalAmount(Number(data.total_amount));
        setBookingData(data ?? {});
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
      formData.append("booking_id", bookingId!);
      formData.append("file", file);
      if (senderName.trim()) formData.append("sender_name", senderName.trim());
      if (referenceNumber.trim()) formData.append("reference_number", referenceNumber.trim());

      const res = await fetch("/api/payments/manual/upload-proof", {
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

  /* ── WhatsApp message builder ── */
  const displayCode = bookingCode || bookingId.slice(0, 8);
  const whatsappPhone = (settings.business_phone || "").replace(/[^0-9+]/g, "").replace(/^\+/, "");

  const passengerLines = (bookingData.passengers ?? []).map((p, i) =>
    `  ${i + 1}. ${p.first_name} ${p.last_name}\n     Pasaporte: ${p.passport_number} (vence: ${p.passport_expiry_date}) | Nac.: ${p.nationality}`
  ).join('\n');

  const fl = bookingData.flight;
  const origCode = fl?.origin_airport?.iata_code || '';
  const destCode = fl?.destination_airport?.iata_code || '';
  const origCity = fl?.origin_airport?.city || origCode;
  const destCity = fl?.destination_airport?.city || destCode;
  const depDate = fl?.departure_datetime
    ? new Date(fl.departure_datetime.slice(0, 10) + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const routeDisplay = origCity && destCity
    ? `${origCity}${origCode ? ` (${origCode})` : ''} → ${destCity}${destCode ? ` (${destCode})` : ''}`
    : '';

  const methodLabel = METHOD_LABELS[selectedMethod];

  const whatsappMsgText = [
    `Hola, quiero coordinar el pago de mi reserva.`,
    ``,
    `📋 RESERVA: ${displayCode}`,
    routeDisplay ? `✈️ RUTA: ${routeDisplay}` : '',
    depDate ? `📅 Fecha: ${depDate}` : '',
    bookingData.passengers?.length ? `👤 Pasajeros: ${bookingData.passengers.length}` : '',
    totalAmount ? `💰 Total: $${totalAmount.toFixed(2)} USD` : '',
    ``,
    `💳 Metodo de pago: ${methodLabel}`,
    ``,
    `Quedo atento a los datos bancarios para realizar la transferencia.`,
  ].filter(Boolean).join('\n');

  const whatsappUrl = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMsgText)}`
    : '';

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-3xl p-6 pt-24 pb-16">
        <Card variant="bordered" className="p-6 space-y-6">
          <h1 className="text-xl font-semibold">Pagar Reserva</h1>

          {/* Booking Summary */}
          <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-500 uppercase font-medium">Reserva</p>
              <p className="text-lg font-bold font-mono text-brand-600">{displayCode}</p>
              {routeDisplay && (
                <p className="text-sm text-neutral-600 mt-1">{routeDisplay}</p>
              )}
              {depDate && (
                <p className="text-xs text-neutral-500">{depDate}</p>
              )}
            </div>
            {totalAmount !== null && (
              <div className="text-right">
                <p className="text-xs text-neutral-500 uppercase font-medium">Total a pagar</p>
                <p className="text-2xl font-extrabold text-neutral-900">${totalAmount.toFixed(2)}</p>
                <p className="text-xs text-neutral-500">USD</p>
              </div>
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-3">
            <h2 className="font-semibold text-neutral-800">Selecciona tu metodo de pago</h2>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                const isSelected = selectedMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all text-center ${
                      isSelected
                        ? "border-brand-600 bg-brand-50 shadow-sm"
                        : "border-neutral-200 bg-white hover:border-neutral-300"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${isSelected ? "text-brand-600" : "text-neutral-400"}`} />
                    <span className={`text-sm font-semibold ${isSelected ? "text-brand-700" : "text-neutral-700"}`}>
                      {m.label}
                    </span>
                    <span className="text-xs text-neutral-500">{m.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 1: Contact via WhatsApp */}
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white text-sm font-bold">1</span>
              <h2 className="font-bold text-emerald-800">Contacta por WhatsApp para recibir los datos de pago</h2>
            </div>
            <p className="text-sm text-emerald-700">
              Un agente te enviara los datos para realizar tu pago por <strong>{PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label}</strong>.
              {selectedMethod === "square" && " Te enviaremos un link de pago para que pagues con tarjeta."}
            </p>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white px-5 py-3 font-semibold text-sm transition-colors shadow-sm"
              >
                <MessageCircle className="h-5 w-5" />
                Contactar por WhatsApp
              </a>
            ) : (
              <p className="text-sm text-emerald-700">Contactenos directamente para recibir los datos de pago.</p>
            )}
          </div>

          {/* Step 2: Upload Proof (not for Square since they pay via link) */}
          {selectedMethod !== "square" && (
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">2</span>
                <h2 className="font-bold text-blue-800">Sube tu comprobante de pago</h2>
              </div>
              <p className="text-sm text-blue-700">
                Una vez realizada la transferencia, sube el comprobante e ingresa los datos de la transaccion.
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
                    placeholder="Numero de confirmacion"
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {proofUrl ? (
                <div className="rounded-lg bg-white p-4 border border-emerald-300 space-y-2">
                  <p className="text-sm font-semibold text-emerald-700">
                    Comprobante subido exitosamente
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
          )}

          {/* Info */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p>
              <strong>Que sucede despues?</strong> Un agente verificara tu pago y
              confirmara tu reserva. Recibiras una notificacion por correo cuando este listo.
              Tiempo estimado: <strong>2-4 horas</strong>.
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
