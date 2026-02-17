'use client';

import AirportAutocomplete from '@/components/forms/AirportAutocomplete';

type Props = {
  stops: string[];
  onChange: (nextStops: string[]) => void;
  origin?: string;
  destination?: string;
};

export default function MultiLegEditor({ stops, onChange, origin, destination }: Props) {
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
    <div className="mt-6 rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-800">Tramos / Escalas</p>
          <p className="text-xs text-neutral-600">
            Opcional. Origen: {origin || '—'} · Destino: {destination || '—'}
          </p>
        </div>

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
          {stops.map((stop, index) => {
            // Exclude codes: origin, destination, and other selected stops (not the current one)
            const otherStops = stops.filter((_, i) => i !== index);
            const excludeCodes = [origin, destination, ...otherStops].filter(Boolean) as string[];

            return (
              <div key={`stop-${index}`} className="flex gap-3">
                <div className="flex-1">
                  <AirportAutocomplete
                    value={stop}
                    onChange={(code) => updateStop(index, code)}
                    placeholder="Buscar escala..."
                    excludeCodes={excludeCodes}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeStop(index)}
                  className="h-12 rounded-xl border-2 border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Eliminar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}