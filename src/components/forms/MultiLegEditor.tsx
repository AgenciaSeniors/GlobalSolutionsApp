'use client';

import { AIRPORTS } from '@/lib/constants/config';

type Props = {
  stops: string[];
  onChange: (next: string[]) => void;
  origin: string;
  destination: string;
};

export default function MultiLegEditor({ stops, onChange, origin, destination }: Props) {
  function addStop() {
    onChange([...stops, '']);
  }

  function removeStop(index: number) {
    const copy = [...stops];
    copy.splice(index, 1);
    onChange(copy);
  }

  function updateStop(index: number, value: string) {
    const copy = [...stops];
    copy[index] = value;
    onChange(copy);
  }

  const forbidden = new Set([origin, destination].filter(Boolean));

  return (
    <div className="mt-6 rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-800">Tramos / Escalas</p>

        <button
          type="button"
          onClick={addStop}
          className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-brand-600 shadow-sm hover:bg-neutral-50"
        >
          + Agregar escala
        </button>
      </div>

      {stops.length === 0 ? (
        <p className="text-sm text-neutral-600">
          No agregaste escalas. Si querés, podés agregar una o más.
        </p>
      ) : (
        <div className="space-y-3">
          {stops.map((stop, index) => (
            <div key={index} className="flex gap-3">
              <select
                value={stop}
                onChange={(e) => updateStop(index, e.target.value)}
                className="h-12 flex-1 rounded-xl border-2 border-neutral-200 bg-white px-4 text-[15px]
                           focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">Seleccionar escala</option>

                {AIRPORTS.map((a) => {
                  const disabled = forbidden.has(a.code);
                  return (
                    <option key={a.code} value={a.code} disabled={disabled}>
                      {a.city} ({a.code}) – {a.country}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={() => removeStop(index)}
                className="h-12 rounded-xl border-2 border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
