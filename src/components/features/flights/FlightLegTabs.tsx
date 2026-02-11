// src/components/features/flights/FlightLegTabs.tsx
import { Plane } from 'lucide-react';

interface FlightLegTabsProps {
  legs: { origin: string; destination: string; date: string }[]; 
  activeLeg: number; 
  onLegChange: (index: number) => void;
}

export default function FlightLegTabs({ legs, activeLeg, onLegChange }: FlightLegTabsProps) {
  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
      {legs.map((leg, index) => {
        const isActive = activeLeg === index;
        return (
          <button
            key={index}
            onClick={() => onLegChange(index)}
            className={`relative flex items-center gap-3 px-6 py-3 rounded-xl border transition-all min-w-[200px] ${isActive ? 'bg-[#0F2545] border-[#0F2545] text-white shadow-lg' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-[#FF4757] text-white' : 'bg-gray-200 text-gray-500'}`}>
              {index + 1}
            </div>
            <div className="text-left">
              <p className={`text-xs uppercase tracking-wider ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>
                {index === 0 ? 'Vuelo de Ida' : 'Vuelo de Regreso'}
              </p>
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>{leg.origin}</span>
                <Plane className={`w-3 h-3 ${isActive ? 'text-[#FF4757]' : 'text-gray-400'}`} />
                <span>{leg.destination}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}