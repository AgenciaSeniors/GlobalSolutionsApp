/**
 * @fileoverview Flight search form with airport autocomplete, dates, passengers and submit.
 * Accepts initialValues to pre-fill the form (e.g. from URL params on search results page).
 * @module components/forms/FlightSearchForm
 */
'use client';

import { useState, useEffect, useMemo, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, Users, Search, ArrowRightLeft, Plane, Armchair } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import AirportAutocomplete from '@/components/forms/AirportAutocomplete';
import MultiLegEditor, { type StopLeg } from '@/components/forms/MultiLegEditor';
import { ROUTES } from '@/lib/constants/routes';
import { flightSearchSchema } from '@/lib/validations/flight.schema';

type TripType = 'roundtrip' | 'oneway' | 'multicity';

type FlightSearchParams = {
  from: string;
  to: string;
  departure: string;
  passengers: string;
  cabinClass?: string;
  return?: string;
};

type InitialValues = {
  origin?: string;
  destination?: string;
  departure?: string;
  returnDate?: string;
  passengers?: string;
  cabinClass?: string;
  tripType?: TripType;
  legs?: Array<{ origin: string; destination: string; date: string }>;
};

type Props = {
  /** Pre-fill form fields (e.g. from URL search params) */
  initialValues?: InitialValues;
  /**
   * If provided, the form will call this callback instead of navigating
   * to /flights/search. Useful for same-page results + scroll.
   */
  onSearch?: (params: FlightSearchParams) => void;

  /**
   * When true, changing the cabin class will immediately trigger a new search.
   * - If `onSearch` exists: calls onSearch(updatedParams)
   * - Otherwise: updates the URL (router.replace)
   */
  autoSubmitOnClassChange?: boolean;
};

export default function FlightSearchForm({ initialValues, onSearch, autoSubmitOnClassChange }: Props) {
  const router = useRouter();
  const [tripType, setTripType] = useState<TripType>('roundtrip');
  const [form, setForm] = useState({
    origin: '',
    destination: '',
    departure: '',
    returnDate: '',
    passengers: '1',
    cabinClass: 'economy',
  });

  const [legs, setLegs] = useState<StopLeg[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [dateError, setDateError] = useState('');

  const navigateToResults = (payload: FlightSearchParams, mode: 'push' | 'replace' = 'push') => {
    const params = new URLSearchParams({
      from: payload.from,
      to: payload.to,
      departure: payload.departure,
      passengers: payload.passengers,
    });

    if (payload.cabinClass) params.set('cabinClass', payload.cabinClass);
    if (payload.return) params.set('return', payload.return);

    const url = `${ROUTES.FLIGHT_SEARCH}?${params.toString()}`;
    if (mode === 'replace') router.replace(url);
    else router.push(url);
  };


  /* ── Date boundaries ─────────────────────────────── */
  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate())
      .toISOString()
      .split('T')[0];
  }, []);

  const maxDate = useMemo(() => {
    const n = new Date();
    n.setFullYear(n.getFullYear() + 1);
    return n.toISOString().split('T')[0];
  }, []);

  /** Minimum allowed return date = departure or today (whichever is later) */
  const minReturn = useMemo(() => {
    if (!form.departure || form.departure < today) return today;
    return form.departure;
  }, [form.departure, today]);

  // Populate form from initialValues on first render
  useEffect(() => {
    if (initialized || !initialValues) return;

    setForm({
      origin: initialValues.origin || '',
      destination: initialValues.destination || '',
      departure: initialValues.departure || '',
      returnDate: initialValues.returnDate || '',
      passengers: initialValues.passengers || '1',
      cabinClass: initialValues.cabinClass || 'economy',
    });

    if (initialValues.tripType === 'multicity') {
      setTripType('multicity');
      // legs[0] is the main leg (already in origin/destination/departure),
      // additional legs start from index 1
      if (initialValues.legs && initialValues.legs.length > 1) {
        setLegs(initialValues.legs.slice(1));
      } else {
        setLegs([{ origin: '', destination: '', date: '' }]);
      }
    } else if (!initialValues.returnDate) {
      setTripType('oneway');
    } else {
      setTripType('roundtrip');
    }

    setInitialized(true);
  }, [initialValues, initialized]);

  /* ── Trip type change handler ─────────────────────── */
  function handleTripTypeChange(type: TripType) {
    setTripType(type);
    setDateError('');

    // Clear return date when switching to oneway
    if (type === 'oneway' || type === 'multicity') {
      setForm((prev) => ({ ...prev, returnDate: '' }));
    }

    // Clear legs when leaving multicity
    if (type !== 'multicity') {
      setLegs([]);
    }

    // Add initial empty leg when entering multicity
    if (type === 'multicity' && legs.length === 0) {
      setLegs([{ origin: '', destination: '', date: '' }]);
    }
  }

  const update =
    (field: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setDateError('');

      setForm((prev) => {
        const next = { ...prev, [field]: value };

        // Si cambia la fecha de ida y la vuelta queda antes, auto-corregir
        if (field === 'departure' && next.returnDate && next.returnDate < value) {
          next.returnDate = value;
        }

        return next;
      });
    };

  const updateField = (field: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /* ── Swap origin <-> destination ──────────────────── */
  function swapAirports() {
    setForm((prev) => ({
      ...prev,
      origin: prev.destination,
      destination: prev.origin,
    }));
  }

  /* ── Submit ───────────────────────────────────────── */
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setDateError('');

    if (!form.origin || !form.destination) return;

    // Multicity: validate legs have dates and airports
    if (tripType === 'multicity') {
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        if (!leg.origin || !leg.destination) {
          setDateError(`Escala ${i + 1}: selecciona origen y destino`);
          return;
        }
        if (!leg.date) {
          setDateError(`Escala ${i + 1}: selecciona una fecha`);
          return;
        }
        if (leg.date < today) {
          setDateError(`Escala ${i + 1}: la fecha no puede ser en el pasado`);
          return;
        }
        // Validate date sequence: each leg date >= previous leg date
        if (i === 0 && form.departure && leg.date < form.departure) {
          setDateError(`Escala ${i + 1}: la fecha debe ser igual o posterior a la fecha de ida (${form.departure})`);
          return;
        }
        if (i > 0 && legs[i - 1].date && leg.date < legs[i - 1].date) {
          setDateError(`Escala ${i + 1}: la fecha debe ser igual o posterior a la escala anterior (${legs[i - 1].date})`);
          return;
        }
      }
    }

    // ── Multicity: serialize all legs into URL and navigate ──
    if (tripType === 'multicity') {
      if (!form.departure) {
        setDateError('Selecciona una fecha de ida');
        return;
      }

      // Build full legs array: main leg + additional legs from editor
      const allLegs = [
        { origin: form.origin, destination: form.destination, date: form.departure },
        ...legs,
      ];

      const legsParam = allLegs
        .map((l) => `${l.origin}-${l.destination}-${l.date}`)
        .join(',');

      const params = new URLSearchParams({
        from: form.origin,
        to: form.destination,
        departure: form.departure,
        passengers: form.passengers,
        tripType: 'multicity',
        legs: legsParam,
      });
      if (form.cabinClass) params.set('cabinClass', form.cabinClass);

      router.push(`${ROUTES.FLIGHT_SEARCH}?${params.toString()}`);
      return;
    }

    // ── Roundtrip / Oneway: validate with Zod and navigate ──
    const result = flightSearchSchema.safeParse({
      origin: form.origin,
      destination: form.destination,
      departure_date: form.departure,
      return_date: tripType === 'roundtrip' ? form.returnDate : undefined,
      passengers: form.passengers,
    });

    if (!result.success) {
      const firstError = result.error.issues[0]?.message ?? 'Datos invalidos';
      setDateError(firstError);
      return;
    }

    const payload: FlightSearchParams = {
      from: form.origin,
      to: form.destination,
      departure: form.departure,
      passengers: form.passengers,
      cabinClass: form.cabinClass,
    };

    if (tripType === 'roundtrip' && form.returnDate) {
      payload.return = form.returnDate;
    }

    if (onSearch) {
      onSearch(payload);
      return;
    }

    navigateToResults(payload, 'push');
  }

  function handleCabinClassChange(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setDateError('');

    setForm((prev) => ({ ...prev, cabinClass: value }));

    if (!autoSubmitOnClassChange) return;

    const next = { ...form, cabinClass: value };
    if (!next.origin || !next.destination || !next.departure) return;

    // ── Multicity: rebuild URL with all legs + new cabinClass ──
    if (tripType === 'multicity') {
      const allLegs = [
        { origin: next.origin, destination: next.destination, date: next.departure },
        ...legs,
      ];
      if (allLegs.some((l) => !l.origin || !l.destination || !l.date)) return;

      const legsParam = allLegs.map((l) => `${l.origin}-${l.destination}-${l.date}`).join(',');
      const params = new URLSearchParams({
        from: next.origin,
        to: next.destination,
        departure: next.departure,
        passengers: next.passengers,
        tripType: 'multicity',
        legs: legsParam,
        cabinClass: value,
      });
      router.replace(`${ROUTES.FLIGHT_SEARCH}?${params.toString()}`);
      return;
    }

    // ── Roundtrip / Oneway ──
    if (tripType === 'roundtrip' && !next.returnDate) return;

    const payload: FlightSearchParams = {
      from: next.origin,
      to: next.destination,
      departure: next.departure,
      passengers: next.passengers,
      cabinClass: next.cabinClass,
    };

    if (tripType === 'roundtrip' && next.returnDate) {
      payload.return = next.returnDate;
    }

    if (onSearch) onSearch(payload);
    else navigateToResults(payload, 'replace');
  }


  /* ── Render ───────────────────────────────────────── */
  const isRoundtrip = tripType === 'roundtrip';
  const isMulticity = tripType === 'multicity';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl shadow-black/[0.06] sm:p-8"
    >
      {/* ── Trip type toggle bar ──────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-1 rounded-xl bg-neutral-100 p-1">
          {([
            { key: 'roundtrip' as TripType, label: 'Ida y Vuelta' },
            { key: 'oneway' as TripType, label: 'Solo Ida' },
            { key: 'multicity' as TripType, label: 'Multidestino' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleTripTypeChange(key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tripType === key
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Airports row ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr]">
        {/* Origin */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <MapPin className="h-3.5 w-3.5 text-brand-500" /> Origen
          </label>
          <AirportAutocomplete
            value={form.origin}
            onChange={updateField('origin')}
            placeholder="Ciudad o codigo IATA"
            required
            excludeCodes={form.destination ? [form.destination] : []}
          />
        </div>

        {/* Swap button */}
        <div className="hidden md:flex items-end pb-1">
          <button
            type="button"
            onClick={swapAirports}
            title="Intercambiar origen y destino"
            className="rounded-full border-2 border-neutral-200 bg-white p-2.5 text-neutral-500
                       transition-all hover:border-brand-300 hover:text-brand-600 hover:shadow-sm
                       active:scale-95"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Destination */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <MapPin className="h-3.5 w-3.5 text-brand-500" /> Destino
          </label>
          <AirportAutocomplete
            value={form.destination}
            onChange={updateField('destination')}
            placeholder="Ciudad o codigo IATA"
            required
            excludeCodes={form.origin ? [form.origin] : []}
          />
        </div>
      </div>

      {/* Mobile swap button */}
      <div className="mt-2 flex justify-center md:hidden">
        <button
          type="button"
          onClick={swapAirports}
          className="rounded-full border-2 border-neutral-200 bg-white p-2 text-neutral-500
                     transition-all hover:border-brand-300 hover:text-brand-600
                     active:scale-95"
        >
          <ArrowRightLeft className="h-4 w-4 rotate-90" />
        </button>
      </div>

      {/* ── Dates row ─────────────────────────────────── */}
      <div className={`mt-5 grid gap-4 ${isRoundtrip ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-1 sm:max-w-xs'}`}>
        {/* Departure */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <Calendar className="h-3.5 w-3.5 text-brand-500" /> Fecha de Ida
          </label>
          <Input
            type="date"
            value={form.departure}
            onChange={update('departure')}
            min={today}
            max={maxDate}
            required
          />
        </div>

        {/* Return — only visible for roundtrip */}
        {isRoundtrip && (
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
              <Calendar className="h-3.5 w-3.5 text-brand-500" /> Fecha de Vuelta
            </label>
            <Input
              type="date"
              value={form.returnDate}
              onChange={update('returnDate')}
              min={minReturn}
              max={maxDate}
              required
            />
          </div>
        )}
      </div>

      {/* ── Date validation error ─────────────────────── */}
      {dateError && (
        <div className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
          {dateError}
        </div>
      )}

      {/* ── Multi-city legs ───────────────────────────── */}
      {isMulticity && (
        <MultiLegEditor
          legs={legs}
          onChange={setLegs}
          departureDate={form.departure}
          today={today}
          maxDate={maxDate}
        />
      )}

      {/* ── Passengers + Search ───────────────────────── */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="w-full sm:w-44">
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <Users className="h-3.5 w-3.5 text-brand-500" /> Pasajeros
          </label>
          <select
            value={form.passengers}
            onChange={update('passengers')}
            className="h-12 w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 text-[15px] font-medium
                       focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} pasajero{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>
        {/* <-- NUEVO: Selector de Clase --> */}
        <div className="w-full sm:w-48">
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
            <Armchair className="h-3.5 w-3.5 text-brand-500" /> Clase
          </label>
          <select
            value={form.cabinClass}
            onChange={handleCabinClassChange}
            className="h-12 w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 text-[15px] font-medium
                       focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="economy">Económica</option>
            <option value="premium_economy">Premium Económica</option>
            <option value="business">Ejecutiva</option>
            <option value="first">Primera</option>
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
