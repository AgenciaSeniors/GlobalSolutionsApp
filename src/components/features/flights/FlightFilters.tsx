import { useState } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

interface FilterState {
  stops: string[]; // 'direct', '1stop', '2stops'
  priceRange: { min: number; max: number };
  airlines: string[];
}

interface FlightFiltersProps {
  onFilterChange: (filters: FilterState) => void;
}

const DEFAULT_FILTERS: FilterState = {
  stops: [],
  priceRange: { min: 0, max: 2000 },
  airlines: [],
};

export default function FlightFilters({ onFilterChange }: FlightFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // ✅ NO llamar onFilterChange dentro del setState updater.
  const handleCheckboxChange = (category: keyof FilterState, value: string) => {
    const currentList = (filters[category] as string[]) ?? [];
    const newList = currentList.includes(value)
      ? currentList.filter((item) => item !== value)
      : [...currentList, value];

    const newFilters = { ...filters, [category]: newList } as FilterState;

    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handlePriceChange = (key: 'min' | 'max', raw: string) => {
    const n = Number(raw);
    const newPriceRange = { ...filters.priceRange, [key]: Number.isFinite(n) ? n : 0 };
    const newFilters = { ...filters, priceRange: newPriceRange };

    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearAll = () => {
    setFilters(DEFAULT_FILTERS);
    onFilterChange(DEFAULT_FILTERS);
  };

  return (
    <div className="w-full">
      <Card className="p-5 sticky top-24">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-[#0F2545] text-lg">Filtros</h3>
          <button className="text-xs text-[#FF4757] hover:underline" onClick={clearAll}>
            Limpiar todo
          </button>
        </div>

        {/* 1. Filtro de Escalas */}
        <div className="mb-6 border-b border-gray-100 pb-4">
          <h4 className="font-medium text-sm text-gray-700 mb-3">Escalas</h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-[#FF4757] focus:ring-[#FF4757]"
                checked={filters.stops.includes('direct')}
                onChange={() => handleCheckboxChange('stops', 'direct')}
              />
              <span className="text-sm text-gray-600 group-hover:text-[#0F2545]">
                Vuelo Directo
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-[#FF4757] focus:ring-[#FF4757]"
                checked={filters.stops.includes('1stop')}
                onChange={() => handleCheckboxChange('stops', '1stop')}
              />
              <span className="text-sm text-gray-600 group-hover:text-[#0F2545]">1 Escala</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-[#FF4757] focus:ring-[#FF4757]"
                checked={filters.stops.includes('2stops')}
                onChange={() => handleCheckboxChange('stops', '2stops')}
              />
              <span className="text-sm text-gray-600 group-hover:text-[#0F2545]">2+ Escalas</span>
            </label>
          </div>
        </div>

        {/* 2. Rango de Precio */}
        <div className="mb-6 border-b border-gray-100 pb-4">
          <h4 className="font-medium text-sm text-gray-700 mb-3">Precio</h4>
          <div className="flex items-center gap-2">
            <div className="w-1/2">
              <label className="text-xs text-gray-400">Min</label>
              <Input
                type="number"
                placeholder="0"
                value={filters.priceRange.min}
                onChange={(e) => handlePriceChange('min', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="w-1/2">
              <label className="text-xs text-gray-400">Max</label>
              <Input
                type="number"
                placeholder="2000"
                value={filters.priceRange.max}
                onChange={(e) => handlePriceChange('max', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>

        {/* 3. Aerolíneas (Ejemplo estático, luego vendrá de la API) */}
        <div>
          <h4 className="font-medium text-sm text-gray-700 mb-3">Aerolíneas</h4>
          <div className="space-y-2">
            {['American Airlines', 'Copa Airlines', 'Iberia'].map((airline) => (
              <label key={airline} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-[#FF4757] focus:ring-[#FF4757]"
                  checked={filters.airlines.includes(airline)}
                  onChange={() => handleCheckboxChange('airlines', airline)}
                />
                <span className="text-sm text-gray-600 group-hover:text-[#0F2545]">{airline}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
