// src/components/features/flights/FlightLegTabs.tsx
import { Plane, CheckCircle2 } from 'lucide-react';

interface FlightLegTabsProps {
  legs: { origin: string; destination: string; date: string }[];
  activeLeg: number;
  onLegChange: (index: number) => void;
  tripType?: 'oneway' | 'roundtrip' | 'multicity';
  /** Indices of legs already confirmed (multicity only) */
  selectedLegs?: number[];
}

export default function FlightLegTabs({
  legs,
  activeLeg,
  onLegChange,
  tripType,
  selectedLegs = [],
}: FlightLegTabsProps) {
  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
      {legs.map((leg, index) => {
        const isActive = activeLeg === index;
        const isConfirmed = selectedLegs.includes(index);

        let containerClass =
          'relative flex items-center gap-3 px-6 py-3 rounded-xl border transition-all min-w-[200px] ';
        let badgeClass =
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ';
        let planeClass = 'w-3 h-3 ';
        let labelClass = 'text-xs uppercase tracking-wider ';

        if (isActive) {
          containerClass += 'bg-[#0F2545] border-[#0F2545] text-white shadow-lg';
          badgeClass += 'bg-[#FF4757] text-white';
          planeClass += 'text-[#FF4757]';
          labelClass += 'text-gray-300';
        } else if (isConfirmed) {
          containerClass += 'bg-green-50 border-green-400 text-green-800';
          badgeClass += 'bg-green-500 text-white';
          planeClass += 'text-green-500';
          labelClass += 'text-green-600';
        } else {
          containerClass += 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50';
          badgeClass += 'bg-gray-200 text-gray-500';
          planeClass += 'text-gray-400';
          labelClass += 'text-gray-400';
        }

        return (
          <button
            key={index}
            onClick={() => onLegChange(index)}
            className={containerClass}
          >
            <div className={badgeClass}>
              {isConfirmed && !isActive ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            <div className="text-left">
              <p className={labelClass}>
                {tripType === 'multicity'
                  ? `Tramo ${index + 1}`
                  : index === 0
                    ? 'Vuelo de Ida'
                    : 'Vuelo de Regreso'}
              </p>
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>{leg.origin}</span>
                <Plane className={planeClass} />
                <span>{leg.destination}</span>
              </div>
            </div>
            {isConfirmed && !isActive && (
              <span className="absolute top-1 right-2 text-[10px] font-semibold text-green-600 uppercase tracking-wide">
                Seleccionado
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}