"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bookingsService } from "@/services/bookings.service";

type FlightRow = { id: string };

export default function QuickPayDevPage() {
  const router = useRouter();
  const [flightId, setFlightId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // 1) Cargar un vuelo automáticamente (el primero que encuentre)
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("flights").select("id").limit(1);
      if (error || !data?.length) {
        setMsg("No encontré vuelos en la tabla flights. Cargá/seed un vuelo primero.");
        return;
      }
      setFlightId((data[0] as FlightRow).id);
    })();
  }, []);

  // 2) Crear booking dummy + redirigir a /pay
  async function handleCreateAndPay() {
    setLoading(true);
    setMsg("");
    try {
      if (!flightId) throw new Error("Falta flightId");

      const booking = await bookingsService.create({
        flight_id: flightId,
        passengers: [
          {
            first_name: "Test",
            last_name: "User",
            date_of_birth: "1995-01-01",
            nationality: "AR",
            passport_number: "X12345678",
            passport_expiry_date: "2030-01-01",
          },
        ],
      });

      router.push(`/pay?booking_id=${booking.id}&method=stripe`);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Error creando booking";
      setMsg(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>DEV: Quick Pay</h1>
      <p style={{ marginTop: 8 }}>
        Esto crea una booking dummy y te manda al checkout visual (Stripe).
      </p>

      <div style={{ marginTop: 16 }}>
        <label>flight_id</label>
        <input
          value={flightId}
          onChange={(e) => setFlightId(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 6, border: "1px solid #ddd", borderRadius: 8 }}
        />
      </div>

      <button
        onClick={handleCreateAndPay}
        disabled={loading}
        style={{ marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
      >
        {loading ? "Creando booking..." : "Crear booking y abrir pago (Stripe)"}
      </button>

      {msg && <p style={{ marginTop: 12, color: "crimson" }}>{msg}</p>}
    </div>
  );
}
