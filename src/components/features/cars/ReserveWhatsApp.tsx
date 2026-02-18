"use client";

import { useMemo, useState } from "react";

type ReserveWhatsAppProps = {
  car: {
    brand: string;
    model: string;
    daily_rate: number;
    currency: string;
    pickup_location?: string | null;
  };
  carUrl?: string;
};

// ===== Helpers de fechas =====

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addDaysISO(dateISO: string, days: number) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const ms = e.getTime() - s.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Number.isFinite(days) && days > 0 ? days : 0;
}

export default function ReserveWhatsApp({
  car,
  carUrl,
}: ReserveWhatsAppProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  const today = todayISO();
  const minEnd = startDate ? addDaysISO(startDate, 1) : today;

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return daysBetween(startDate, endDate);
  }, [startDate, endDate]);

  const total = useMemo(() => {
    if (!days) return null;
    const rate = Number(car.daily_rate);
    if (!Number.isFinite(rate)) return null;
    return Math.round(rate * days * 100) / 100;
  }, [days, car.daily_rate]);

  const waUrl = useMemo(() => {
    if (!phone) return null;

    const lines = [
      "Hola, quiero reservar este auto:",
      `• Auto: ${car.brand} ${car.model}`,
      car.pickup_location
        ? `• Lugar de recogida: ${car.pickup_location}`
        : null,
      startDate ? `• Desde: ${startDate}` : null,
      endDate ? `• Hasta: ${endDate}` : null,
      days ? `• Días: ${days}` : null,
      `• Precio/día: ${car.daily_rate} ${car.currency}`,
      total != null ? `• Estimado total: ${total} ${car.currency}` : null,
      carUrl ? `• Link: ${carUrl}` : null,
    ].filter(Boolean);

    return `https://wa.me/${phone}?text=${encodeURIComponent(
      lines.join("\n")
    )}`;
  }, [phone, car, carUrl, startDate, endDate, days, total]);

  const canReserve = Boolean(
    waUrl && startDate && endDate && days > 0
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">Desde *</span>
          <input
            type="date"
            min={today}
            value={startDate}
            onChange={(e) => {
              const nextStart = e.target.value;
              setStartDate(nextStart);

              // Si el endDate queda inválido, lo limpiamos
              if (endDate && nextStart) {
                const minValidEnd = addDaysISO(nextStart, 1);
                if (endDate < minValidEnd) {
                  setEndDate("");
                }
              }
            }}
            className="w-full rounded-md border px-3 py-2"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">Hasta *</span>
          <input
            type="date"
            min={minEnd}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={!startDate}
            className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
          />
        </label>
      </div>

      {startDate && endDate && days === 0 && (
        <p className="text-sm text-red-600">
          La fecha “Hasta” debe ser posterior a “Desde”.
        </p>
      )}

      {days > 0 && (
        <p className="text-sm">
          Duración: <b>{days}</b> día(s) · Estimado:{" "}
          <b>{total}</b> {car.currency}
        </p>
      )}

      <button
        type="button"
        disabled={!canReserve}
        onClick={() =>
          waUrl && window.open(waUrl, "_blank", "noopener,noreferrer")
        }
        className="w-full rounded-md bg-green-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        Reservar por WhatsApp
      </button>

      {!phone && (
        <p className="text-xs text-amber-700">
          Falta configurar <code>NEXT_PUBLIC_WHATSAPP_NUMBER</code> en
          .env.local
        </p>
      )}
    </div>
  );
}
