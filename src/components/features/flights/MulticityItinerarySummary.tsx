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

  // BUG 2 FIX: derive pending indices by diffing all possible indices vs selected ones.
  // The old formula (selectedLegs.length + i) assumed selected legs are always contiguous
  // from the start, which breaks when e.g. legs 0 and 2 are selected but 1 is missing.
  const selectedIndices = new Set(sorted.map((l) => l.legIndex));
  const pendingIndices = Array.from({ length: totalLegs }, (_, i) => i).filter(
    (i) => !selectedIndices.has(i),
  );

  return (
    <div className="mt-6 rounded-2xl border border-blue-200 bg-white shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-[#0F2545] px-4 py-3 flex items-center justify-between gap-2 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Plane className="w-4 h-4 text-[#FF4757] shrink-0 sm:w-5 sm:h-5" />
          <h3 className="text-white font-bold text-sm sm:text-base truncate">
            Tu itinerario multidestino
          </h3>
        </div>
        <span className="text-xs text-gray-300 shrink-0 sm:text-sm">
          {selectedLegs.length}/{totalLegs}
        </span>
      </div>

      {/* Legs list */}
      <div className="divide-y divide-gray-100">
        {sorted.map((leg) => (
          <div
            key={leg.legIndex}
            className="flex items-center gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4"
          >
            {/* Leg number */}
            <div className="w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 sm:w-7 sm:h-7">
              {leg.legIndex + 1}
            </div>

            {/* Route */}
            <div className="flex items-center gap-1 flex-1 min-w-0 sm:gap-2">
              <span className="font-bold text-xs text-gray-800 sm:text-sm">
                {leg.legMeta.origin}
              </span>
              <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0 sm:w-4 sm:h-4" />
              <span className="font-bold text-xs text-gray-800 sm:text-sm">
                {leg.legMeta.destination}
              </span>
              <span className="text-xs text-gray-400 ml-1 hidden sm:inline">
                {leg.legMeta.date}
              </span>
            </div>

            {/* Airline + flight */}
            <div className="hidden lg:block text-sm text-gray-500 flex-shrink-0 max-w-[140px] truncate">
              {leg.flightData.airline}
              {leg.flightData.flightNumber
                ? ` · ${leg.flightData.flightNumber}`
                : ''}
            </div>

            {/* Price */}
            <div className="text-xs font-bold text-[#0F2545] flex-shrink-0 sm:text-sm">
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

        {/* Pending legs placeholder — shows exactly which legs are still missing */}
        {pendingIndices.map((pendingIndex) => (
          <div
            key={`pending-${pendingIndex}`}
            className="flex items-center gap-2 px-3 py-3 opacity-40 sm:gap-4 sm:px-6 sm:py-4"
          >
            <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0 sm:w-7 sm:h-7">
              {pendingIndex + 1}
            </div>
            <span className="text-xs text-gray-400 italic sm:text-sm">
              Pendiente de selección
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-3 py-3 flex items-center justify-between gap-3 sm:px-6 sm:py-4 sm:gap-4">
        <div>
          <p className="text-xs text-gray-500">
            Total ({passengerCount}{' '}
            {passengerCount === 1 ? 'pas.' : 'pas.'})
          </p>
          <p className="text-lg font-extrabold text-[#0F2545] sm:text-xl">
            ${totalAll.toFixed(2)}{' '}
            <span className="text-xs font-normal text-gray-400">USD</span>
          </p>
          {passengerCount > 1 && (
            <p className="text-xs text-gray-400">
              ${totalPerPerson.toFixed(2)}/persona
            </p>
          )}
        </div>

        <Button
          onClick={onContinue}
          disabled={!allSelected}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all sm:px-8 sm:py-3 sm:text-sm ${
            allSelected
              ? 'bg-[#FF4757] hover:bg-[#e03e4e] text-white shadow-md'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {allSelected
            ? 'Ir al checkout'
            : `Faltan ${totalLegs - selectedLegs.length}`}
        </Button>
      </div>
    </div>
  );
}
