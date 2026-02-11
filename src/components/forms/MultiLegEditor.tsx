'use client';

import React from 'react';

type Props = {
  stops: string[];
  onChange: (nextStops: string[]) => void;
  origin?: string;
  destination?: string;
};

export default function MultiLegEditor({
  stops,
  onChange,
  origin,
  destination,
}: Props) {
  function addStop() {
    onChange([...stops, '']);
  }

  function updateStop(index: number, value: string) {
    onChange(stops.map((stop, i) => (i === index ? value : stop)));
  }

  function removeStop(index: number) {
    onChange(stops.filter((_, i) => i !== index));
  }

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Escalas (stops)</p>
          <p className="text-xs text-neutral-600">
            Opcional. Origen: {origin || '—'} · Destino: {destination || '—'}
          </p>
        </div>

        <button
          type="button"
          onClick={addStop}
          className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
        >
          + Agregar escala
        </button>
      </div>

      {stops.length === 0 ? (
        <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
          No hay escalas agregadas.
        </div>
      ) : (
        <div className="space-y-2">
          {stops.map((stop, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={stop}
                onChange={(e) => updateStop(index, e.target.value)}
                placeholder={`Escala ${index + 1} (IATA)`}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
              />

              <button
                type="button"
                onClick={() => removeStop(index)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
