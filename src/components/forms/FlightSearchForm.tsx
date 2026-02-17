"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Users, Search, Armchair } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import AirportAutocomplete from "@/components/forms/AirportAutocomplete";
import { ROUTES } from "@/lib/constants/routes";

type TripType = "roundtrip" | "oneway";
type CabinClass = "economy" | "premium_economy" | "business" | "first";

const CABIN_OPTIONS: { value: CabinClass; label: string }[] = [
  { value: "economy", label: "Económica" },
  { value: "premium_economy", label: "Premium Economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "Primera Clase" },
];

type FlightSearchParams = {
  from: string;
  to: string;
  departure: string;
  passengers: string;
  return?: string;
  cabinClass?: string;
};

type Props = {
  onSearch?: (params: FlightSearchParams) => void;
};

export default function FlightSearchForm({ onSearch }: Props) {
  const router = useRouter();
  const [tripType, setTripType] = useState<TripType>("roundtrip");
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    departure: "",
    returnDate: "",
    passengers: "1",
    cabinClass: "economy" as CabinClass,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.origin || !form.departure) return;

    const payload: FlightSearchParams = {
      from: form.origin,
      to: form.destination,
      departure: form.departure,
      passengers: form.passengers,
      cabinClass: form.cabinClass,
    };

    if (tripType === "roundtrip" && form.returnDate) {
      payload.return = form.returnDate;
    }

    if (onSearch) {
      onSearch(payload);
      return;
    }

    const params = new URLSearchParams({
      from: payload.from,
      to: payload.to,
      departure: payload.departure,
      passengers: payload.passengers,
    });
    if (payload.cabinClass) params.set("cabinClass", payload.cabinClass);
    if (payload.return) params.set("return", payload.return);

    router.push(`${ROUTES.FLIGHT_SEARCH}?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl shadow-black/[0.06]"
    >
      <div className="mb-7 inline-flex gap-1 rounded-xl bg-neutral-100 p-1">
        <button
          type="button"
          onClick={() => setTripType("roundtrip")}
          className={`rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
            tripType === "roundtrip"
              ? "bg-white text-brand-600 shadow-sm"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          Ida y Vuelta
        </button>
        <button
          type="button"
          onClick={() => setTripType("oneway")}
          className={`rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
            tripType === "oneway"
              ? "bg-white text-brand-600 shadow-sm"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          Solo Ida
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <AirportAutocomplete
          id="origin"
          label="Origen"
          value={form.origin}
          onChange={(iata) => setForm((prev) => ({ ...prev, origin: iata }))}
          placeholder="Ciudad, país o código IATA..."
          required
        />

        <AirportAutocomplete
          id="destination"
          label="Destino"
          value={form.destination}
          onChange={(iata) => setForm((prev) => ({ ...prev, destination: iata }))}
          placeholder="Ciudad, país o código IATA..."
          required
        />

        <div>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <Calendar className="h-3.5 w-3.5 text-brand-500" /> Fecha de Ida
          </label>
          <Input
            type="date"
            value={form.departure}
            onChange={(e) => setForm((prev) => ({ ...prev, departure: e.target.value }))}
            required
          />
        </div>

        <div>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <Calendar className="h-3.5 w-3.5 text-brand-500" />{" "}
            {tripType === "oneway" ? "Fecha de Vuelta (N/A)" : "Fecha de Vuelta"}
          </label>
          <Input
            type="date"
            value={form.returnDate}
            onChange={(e) => setForm((prev) => ({ ...prev, returnDate: e.target.value }))}
            disabled={tripType === "oneway"}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end">
        <div className="w-40">
          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <Users className="h-3.5 w-3.5 text-brand-500" /> Pasajeros
          </label>
          <select
            value={form.passengers}
            onChange={(e) => setForm((prev) => ({ ...prev, passengers: e.target.value }))}
            className="h-12 w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 text-[15px]
                       focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} pasajero{n > 1 && "s"}
              </option>
            ))}
          </select>
        </div>

        <div className="w-48">
          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <Armchair className="h-3.5 w-3.5 text-brand-500" /> Clase
          </label>
          <select
            value={form.cabinClass}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, cabinClass: e.target.value as CabinClass }))
            }
            className="h-12 w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 text-[15px]
                       focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            {CABIN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-12 flex-1 justify-center gap-2.5
                     transition-all duration-200 ease-out
                     hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
        >
          <span className="flex items-center justify-center gap-2.5">
            <Search className="h-5 w-5" />
            <span>Buscar Vuelos</span>
          </span>
        </Button>
      </div>
    </form>
  );
}