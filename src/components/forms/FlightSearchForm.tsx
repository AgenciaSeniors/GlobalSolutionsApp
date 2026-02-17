/**
 * @fileoverview Flight search form with airport autocomplete, dates, passengers and submit.
 * Accepts initialValues to pre-fill the form (e.g. from URL params on search results page).
 * @module components/forms/FlightSearchForm
 */
'use client';

import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, Users, Search } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import AirportAutocomplete from '@/components/forms/AirportAutocomplete';
import MultiLegEditor from '@/components/forms/MultiLegEditor';
import { ROUTES } from '@/lib/constants/routes';

type TripType = 'roundtrip' | 'oneway';

type FlightSearchParams = {
  from: string;
  to: string;
  departure: string;
  passengers: string;
  return?: string;
};

type InitialValues = {
  origin?: string;
  destination?: string;
  departure?: string;
  returnDate?: string;
  passengers?: string;
};

type Props = {
  /** Pre-fill form fields (e.g. from URL search params) */
  initialValues?: InitialValues;
  /**
   * If provided, the form will call this callback instead of navigating
   * to /flights/search. Useful for same-page results + scroll.
   */
  onSearch?: (params: FlightSearchParams) => void;
};

export default function FlightSearchForm({ initialValues, onSearch }: Props) {
  const router = useRouter();
  const [tripType, setTripType] = useState<TripType>('roundtrip');
  const [form, setForm] = useState({
    origin: '',
    destination: '',
    departure: '',
    returnDate: '',
    passengers: '1',
  });

  const [useStopsMode, setUseStopsMode] = useState(false);
  const [stops, setStops] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Populate form from initialValues on first render
  useEffect(() => {
    if (initialized || !initialValues) return;

    setForm({
      origin: initialValues.origin || '',
      destination: initialValues.destination || '',
      departure: initialValues.departure || '',
      returnDate: initialValues.returnDate || '',
      passengers: initialValues.passengers || '1',
    });

    // Set trip type based on whether there's a return date
    if (!initialValues.returnDate) {
      setTripType('oneway');
    } else {
      setTripType('roundtrip');
    }

    setInitialized(true);
  }, [initialValues, initialized]);

  const update =
    (field: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const updateField = (field: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!form.origin || !form.destination) return;

    const payload: FlightSearchParams = {
      from: form.origin,
      to: form.destination,
      departure: form.departure,
      passengers: form.passengers,
    };

    if (tripType === 'roundtrip' && form.returnDate) {
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

    if (payload.return) {
      params.set('return', payload.return);
    }

    router.push(`${ROUTES.FLIGHT_SEARCH}?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl shadow-black/[0.06]"
    >
      {/* Trip type toggle */}
      <div className="mb-7 inline-flex gap-1 rounded-xl bg-neutral-100 p-1">
        <button
          type="button"
          onClick={() => setTripType('roundtrip')}
          className={`rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
            tripType === 'roundtrip'
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Ida y Vuelta
        </button>

        <button
          type="button"
          onClick={() => setTripType('oneway')}
          className={`rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
            tripType === 'oneway'
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Solo Ida
        </button>
      </div>

      {/* Stops toggle */}
      <button
        type="button"
        onClick={() => {
          setUseStopsMode((prev) => !prev);
          if (useStopsMode) setStops([]);
        }}
        className={`mb-6 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
          useStopsMode
            ? 'bg-white text-brand-600 shadow-sm'
            : 'text-neutral-600 hover:text-neutral-900'
        }`}
      >
        Escalas
      </button>

      {/* Fields grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Origin */}
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <MapPin className="h-3.5 w-3.5 text-brand-500" /> Origen
          </label>
          <AirportAutocomplete
            value={form.origin}
            onChange={updateField('origin')}
            placeholder="Escribe país, ciudad o código"
            required
            excludeCodes={form.destination ? [form.destination] : []}
          />
        </div>

        {/* Destination */}
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <MapPin className="h-3.5 w-3.5 text-brand-500" /> Destino
          </label>
          <AirportAutocomplete
            value={form.destination}
            onChange={updateField('destination')}
            placeholder="Escribe país, ciudad o código"
            required
            excludeCodes={form.origin ? [form.origin] : []}
          />
        </div>

        {/* Departure */}
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <Calendar className="h-3.5 w-3.5 text-brand-500" /> Fecha de Ida
          </label>
          <Input type="date" value={form.departure} onChange={update('departure')} required />
        </div>

        {/* Return */}
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <Calendar className="h-3.5 w-3.5 text-brand-500" />{' '}
            {tripType === 'oneway' ? 'Fecha de Vuelta (N/A)' : 'Fecha de Vuelta'}
          </label>
          <Input
            type="date"
            value={form.returnDate}
            onChange={update('returnDate')}
            disabled={tripType === 'oneway'}
          />
        </div>
      </div>

      {useStopsMode && (
        <MultiLegEditor
          stops={stops}
          onChange={setStops}
          origin={form.origin}
          destination={form.destination}
        />
      )}

      {/* Passengers + Search */}
      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end">
        <div className="w-40">
          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <Users className="h-3.5 w-3.5 text-brand-500" /> Pasajeros
          </label>
          <select
            value={form.passengers}
            onChange={update('passengers')}
            className="h-12 w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 text-[15px]
                       focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} pasajero{n > 1 && 's'}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="submit"
          size="lg"
          className="flex-1 h-12 justify-center gap-2.5
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