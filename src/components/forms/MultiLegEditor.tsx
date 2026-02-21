'use client';

import { useMemo } from 'react';
import { MapPin, Calendar, Trash2, Plus, Plane } from 'lucide-react';
import AirportAutocomplete from '@/components/forms/AirportAutocomplete';
import Input from '@/components/ui/Input';

/* ── Types ───────────────────────────────────────── */

export type StopLeg = {
  origin: string;
  destination: string;
  date: string;
};

type Props = {
  legs: StopLeg[];
  onChange: (nextLegs: StopLeg[]) => void;
  /** Departure date from the main form — used as min for first leg */
  departureDate?: string;
  /** Today YYYY-MM-DD */
  today: string;
  /** Max allowed date YYYY-MM-DD */
  maxDate: string;
  /** Destination from the main form — auto-fills origin of the first additional leg */
  mainDestination?: string;
};

/* ── Component ───────────────────────────────────── */

export default function MultiLegEditor({ legs, onChange, departureDate, today, maxDate, mainDestination }: Props) {
  function addLeg() {
    const lastLeg = legs[legs.length - 1];
    // For the first additional leg, fall back to mainDestination (the main form's destination)
    const newOrigin = lastLeg?.destination || mainDestination || '';
    onChange([...legs, { origin: newOrigin, destination: '', date: '' }]);
  }

  function updateLeg(index: number, field: keyof StopLeg, value: string) {
    const next = legs.map((leg, i) => {
      if (i !== index) return leg;
      const updated = { ...leg, [field]: value };

      // If destination changes, auto-fill next leg's origin
      if (field === 'destination' && i < legs.length - 1) {
        // We'll handle this in the next map pass
      }

      return updated;
    });

    // Chain: if destination of leg N changed, update origin of leg N+1
    if (field === 'destination' && index < next.length - 1) {
      next[index + 1] = { ...next[index + 1], origin: value };
    }

    // If date changed, fix subsequent dates that became invalid
    if (field === 'date' && value) {
      for (let i = index + 1; i < next.length; i++) {
        if (next[i].date && next[i].date < value) {
          next[i] = { ...next[i], date: value };
        }
      }
    }

    onChange(next);
  }

  function removeLeg(index: number) {
    const next = legs.filter((_, i) => i !== index);

    // Re-chain: if we removed a middle leg, connect the surrounding legs
    if (index > 0 && index < next.length) {
      next[index] = { ...next[index], origin: next[index - 1].destination };
    }

    onChange(next);
  }

  return (
    <div className="mt-5 rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 p-4 sm:p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-brand-500" />
          <p className="text-sm font-semibold text-neutral-800">Tramos adicionales</p>
        </div>

        <button
          type="button"
          onClick={addLeg}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium
                     text-brand-600 shadow-sm ring-1 ring-neutral-200
                     transition-all hover:bg-brand-50 hover:ring-brand-300 active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar tramo
        </button>
      </div>

      {/* Legs list */}
      {legs.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 py-3">
          Agrega tramos para crear un itinerario multidestino.
        </p>
      ) : (
        <div className="space-y-4">
          {legs.map((leg, index) => {
            // Min date for this leg: max of (today, departureDate, previous leg date)
            const prevDate = index === 0 ? departureDate : legs[index - 1]?.date;
            const minDate = prevDate && prevDate > today ? prevDate : today;

            // Exclude codes: all other selected airports in this leg editor
            const allSelected = legs.flatMap((l, i) =>
              i === index ? [] : [l.origin, l.destination].filter(Boolean)
            );

            return (
              <div
                key={`leg-${index}`}
                className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                {/* Leg header */}
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600">
                    Tramo {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLeg(index)}
                    title="Eliminar tramo"
                    className="rounded-lg p-1.5 text-neutral-400 transition-colors
                               hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Airports + date grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* Origin */}
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-xs font-medium text-neutral-600">
                      <MapPin className="h-3 w-3" /> Desde
                    </label>
                    <AirportAutocomplete
                      value={leg.origin}
                      onChange={(v) => updateLeg(index, 'origin', v)}
                      placeholder="Origen"
                      excludeCodes={allSelected.filter((c) => c !== leg.origin)}
                    />
                  </div>

                  {/* Destination */}
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-xs font-medium text-neutral-600">
                      <MapPin className="h-3 w-3" /> Hasta
                    </label>
                    <AirportAutocomplete
                      value={leg.destination}
                      onChange={(v) => updateLeg(index, 'destination', v)}
                      placeholder="Destino"
                      excludeCodes={allSelected.filter((c) => c !== leg.destination)}
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-xs font-medium text-neutral-600">
                      <Calendar className="h-3 w-3" /> Fecha
                    </label>
                    <Input
                      type="date"
                      value={leg.date}
                      onChange={(e) => updateLeg(index, 'date', e.target.value)}
                      min={minDate}
                      max={maxDate}
                      required
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
