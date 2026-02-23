/**
 * @fileoverview Multi-passenger booking form with dynamic row adding.
 * @module components/forms/BookingForm
 */
'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { COUNTRIES } from '@/lib/data/countries';
import { useBooking } from '@/hooks/useBooking';
import type { PassengerPayload } from '@/types/api.types';

const EMPTY_PASSENGER: PassengerPayload = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  nationality: '',
  passport_number: '',
  passport_expiry_date: '',
};

interface BookingFormProps {
  flightId: string;
  maxPassengers?: number;
}

export default function BookingForm({ flightId, maxPassengers = 9 }: BookingFormProps) {
  const { create, isLoading } = useBooking();
  const [passengers, setPassengers] = useState<PassengerPayload[]>([{ ...EMPTY_PASSENGER }]);
  const [error, setError] = useState<string | null>(null);

  function addPassenger() {
    if (passengers.length < maxPassengers) {
      setPassengers((prev) => [...prev, { ...EMPTY_PASSENGER }]);
    }
  }

  function removePassenger(index: number) {
    setPassengers((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePassenger(index: number, field: keyof PassengerPayload, value: string) {
    setPassengers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await create({ flight_id: flightId, passengers });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear la reserva');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-red" role="alert">
          {error}
        </div>
      )}

      {passengers.map((pax, idx) => (
        <fieldset
          key={idx}
          className="rounded-2xl border border-neutral-200 bg-white p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <legend className="text-base font-bold text-neutral-900">
              Pasajero {idx + 1}
            </legend>
            {passengers.length > 1 && (
              <button
                type="button"
                onClick={() => removePassenger(idx)}
                className="text-sm font-medium text-accent-red hover:underline"
              >
                <Trash2 className="mr-1 inline h-4 w-4" />
                Eliminar
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Nombre"
              placeholder="María"
              value={pax.first_name}
              onChange={(e) => updatePassenger(idx, 'first_name', e.target.value)}
              required
            />
            <Input
              label="Apellido"
              placeholder="García"
              value={pax.last_name}
              onChange={(e) => updatePassenger(idx, 'last_name', e.target.value)}
              required
            />
            <Input
              label="Fecha de Nacimiento"
              type="date"
              value={pax.date_of_birth}
              onChange={(e) => updatePassenger(idx, 'date_of_birth', e.target.value)}
              required
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Nacionalidad <span className="text-red-500">*</span>
              </label>
              <select
                value={pax.nationality}
                onChange={(e) => updatePassenger(idx, 'nationality', e.target.value)}
                required
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">Selecciona un país…</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Nº Pasaporte"
              placeholder="A12345678"
              value={pax.passport_number}
              onChange={(e) => updatePassenger(idx, 'passport_number', e.target.value)}
              required
            />
            <Input
              label="Expiración Pasaporte"
              type="date"
              value={pax.passport_expiry_date}
              onChange={(e) => updatePassenger(idx, 'passport_expiry_date', e.target.value)}
              required
            />
          </div>
        </fieldset>
      ))}

      {passengers.length < maxPassengers && (
        <button
          type="button"
          onClick={addPassenger}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 py-3 text-sm font-medium text-neutral-600 transition-colors hover:border-brand-400 hover:text-brand-600"
        >
          <Plus className="h-4 w-4" />
          Agregar Pasajero
        </button>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full" size="lg">
        Confirmar Reserva
      </Button>
    </form>
  );
}
