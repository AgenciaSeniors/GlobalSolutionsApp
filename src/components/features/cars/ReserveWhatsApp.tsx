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

function daysBetween(start: string, end: string) {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const ms = e.getTime() - s.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Number.isFinite(days) && days > 0 ? days : 0;
}

export default function ReserveWhatsApp({ car, carUrl }: ReserveWhatsAppProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

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
      car.pickup_location ? `• Lugar de recogida: ${car.pickup_location}` : null,
      startDate ? `• Desde: ${startDate}` : null,
      endDate ? `• Hasta: ${endDate}` : null,
      days ? `• Días: ${days}` : null,
      Number.isFinite(Number(car.daily_rate))
        ? `• Precio/día: ${car.daily_rate} ${car.currency}`
        : null,
      total != null ? `• Estimado total: ${total} ${car.currency}` : null,
      carUrl ? `• Link: ${carUrl}` : null,
    ].filter(Boolean);

    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [phone, car, carUrl, startDate, endDate, days, total]);

  const canReserve = Boolean(waUrl && startDate && endDate && days > 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">Desde *</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">Hasta *</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          />
        </label>
      </div>

      {startDate && endDate && days === 0 ? (
        <p className="text-sm text-red-600">
          La fecha “Hasta” debe ser posterior a “Desde”.
        </p>
      ) : null}

      {days > 0 ? (
        <p className="text-sm">
          Duración: <b>{days}</b> día(s)
          {total != null ? (
            <>
              {" "}
              · Estimado: <b>{total}</b> {car.currency}
            </>
          ) : null}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canReserve}
        onClick={() => waUrl && window.open(waUrl, "_blank", "noopener,noreferrer")}
        className="w-full rounded-md bg-green-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        Reservar por WhatsApp
      </button>

      {!phone ? (
        <p className="text-xs text-amber-700">
          Falta configurar <code>NEXT_PUBLIC_WHATSAPP_NUMBER</code> en{" "}
          <code>.env.local</code>.
        </p>
      ) : null}
    </div>
  );
}
