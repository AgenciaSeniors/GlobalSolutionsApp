/**
 * @fileoverview Flight search form with airport selectors, date pickers,
 *               passenger count and trip-type toggle.
 * @module components/forms/FlightSearchForm
 */
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, Users, Search } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { AIRPORTS } from '@/lib/constants/config';
import { ROUTES } from '@/lib/constants/routes';

type TripType = 'roundtrip' | 'oneway';

export default function FlightSearchForm() {
  const router = useRouter();
  const [tripType, setTripType] = useState<TripType>('roundtrip');
  const [form, setForm] = useState({
    origin: '',
    destination: '',
    departure: '',
    returnDate: '',
    passengers: '1',
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const params = new URLSearchParams({
      from: form.origin,
      to: form.destination,
      departure: form.departure,
      passengers: form.passengers,
    });

    if (tripType === 'roundtrip' && form.returnDate) {
      params.set('return', form.returnDate);
    }

    router.push(`${ROUTES.FLIGHT_SEARCH}?${params.toString()}`);
  }

  const update = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl shadow-black/[0.06]"
    >
      {/* Trip type toggle */}
      <div className="mb-7 inline-flex gap-1 rounded-xl bg-neutral-100 p-1">
        {(['roundtrip', 'oneway'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTripType(t)}
            className={`rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
              tripType === t
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {t === 'roundtrip' ? 'Ida y Vuelta' : 'Solo Ida'}
          </button>
        ))}
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Origin */}
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <MapPin className="h-3.5 w-3.5 text-brand-500" /> Origen
          </label>
          <select
            value={form.origin}
            onChange={update('origin')}
            required
            className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-3 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="">Seleccionar aeropuerto</option>
            {AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.city} ({a.code}) – {a.country}
              </option>
            ))}
          </select>
        </div>

        {/* Destination */}
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <MapPin className="h-3.5 w-3.5 text-brand-500" /> Destino
          </label>
          <select
            value={form.destination}
            onChange={update('destination')}
            required
            className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-3 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="">Seleccionar aeropuerto</option>
            {AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.city} ({a.code}) – {a.country}
              </option>
            ))}
          </select>
        </div>

        {/* Departure */}
        <Input
          label="Fecha de Ida"
          icon={<Calendar className="h-3.5 w-3.5" />}
          type="date"
          value={form.departure}
          onChange={update('departure')}
          required
        />

        {/* Return */}
        <Input
          label={`Fecha de Vuelta ${tripType === 'oneway' ? '(N/A)' : ''}`}
          icon={<Calendar className="h-3.5 w-3.5" />}
          type="date"
          value={form.returnDate}
          onChange={update('returnDate')}
          disabled={tripType === 'oneway'}
        />
      </div>

      {/* Passengers + Search */}
      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end">
        <div className="w-40">
          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <Users className="h-3.5 w-3.5 text-brand-500" /> Pasajeros
          </label>
          <select
            value={form.passengers}
            onChange={update('passengers')}
            className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-3 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} pasajero{n > 1 && 's'}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" size="lg" className="flex-1 gap-2.5">
          <Search className="h-5 w-5" />
          Buscar Vuelos
        </Button>
      </div>
    </form>
  );
}
