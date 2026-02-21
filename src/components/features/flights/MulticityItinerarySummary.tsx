// src/components/features/flights/MulticityItinerarySummary.tsx
'use client';

import { Plane, X, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { SelectedLeg } from '@/types/models';

interface Props {
  selectedLegs: SelectedLeg[];
  totalLegs: number;
  passengerCount: number;
  onContinue: () => void;
  onClearLeg: (legIndex: number) => void;
}

export default function MulticityItinerarySummary({
  selectedLegs,
  totalLegs,
  passengerCount,
  onContinue,
  onClearLeg,
}: Props) {
  const allSelected = selectedLegs.length === totalLegs;

  const totalPerPerson = selectedLegs.reduce(
    (acc, leg) => acc + leg.flightData.price,
    0,
  );

  const totalAll = totalPerPerson * passengerCount;

  const sorted = [...selectedLegs].sort((a, b) => a.legIndex - b.legIndex);

  return (
    <div className="mt-6 rounded-2xl border border-blue-200 bg-white shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-[#0F2545] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Plane className="w-5 h-5 text-[#FF4757]" />
          <h3 className="text-white font-bold text-base">
            Tu itinerario multidestino
          </h3>
        </div>
        <span className="text-sm text-gray-300">
          {selectedLegs.length} de {totalLegs} tramos seleccionados
        </span>
      </div>

      {/* Legs list */}
      <div className="divide-y divide-gray-100">
        {sorted.map((leg) => (
          <div
            key={leg.legIndex}
            className="flex items-center gap-4 px-6 py-4"
          >
            {/* Leg number */}
            <div className="w-7 h-7 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
              {leg.legIndex + 1}
            </div>

            {/* Route */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-bold text-sm text-gray-800">
                {leg.legMeta.origin}
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="font-bold text-sm text-gray-800">
                {leg.legMeta.destination}
              </span>
              <span className="text-xs text-gray-400 ml-1 hidden sm:inline">
                {leg.legMeta.date}
              </span>
            </div>

            {/* Airline + flight */}
            <div className="hidden md:block text-sm text-gray-500 flex-shrink-0 max-w-[160px] truncate">
              {leg.flightData.airline}
              {leg.flightData.flightNumber
                ? ` · ${leg.flightData.flightNumber}`
                : ''}
            </div>

            {/* Price */}
            <div className="text-sm font-bold text-[#0F2545] flex-shrink-0">
              ${leg.flightData.price.toFixed(2)}
              <span className="text-xs font-normal text-gray-400">/p</span>
            </div>

            {/* Remove */}
            <button
              onClick={() => onClearLeg(leg.legIndex)}
              className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
              aria-label={`Quitar tramo ${leg.legIndex + 1}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {/* Pending legs placeholder */}
        {Array.from({ length: totalLegs - selectedLegs.length }, (_, i) => {
          const pendingIndex = totalLegs - (totalLegs - selectedLegs.length) + i;
          return (
            <div
              key={`pending-${pendingIndex}`}
              className="flex items-center gap-4 px-6 py-4 opacity-40"
            >
              <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {pendingIndex + 1}
              </div>
              <span className="text-sm text-gray-400 italic">
                Pendiente de selección
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500">
            Total estimado ({passengerCount}{' '}
            {passengerCount === 1 ? 'pasajero' : 'pasajeros'})
          </p>
          <p className="text-xl font-extrabold text-[#0F2545]">
            ${totalAll.toFixed(2)}{' '}
            <span className="text-xs font-normal text-gray-400">USD</span>
          </p>
          {passengerCount > 1 && (
            <p className="text-xs text-gray-400">
              ${totalPerPerson.toFixed(2)} por persona
            </p>
          )}
        </div>

        <Button
          onClick={onContinue}
          disabled={!allSelected}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${
            allSelected
              ? 'bg-[#FF4757] hover:bg-[#e03e4e] text-white shadow-md'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {allSelected
            ? 'Continuar al checkout'
            : `Faltan ${totalLegs - selectedLegs.length} tramo${totalLegs - selectedLegs.length > 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}
