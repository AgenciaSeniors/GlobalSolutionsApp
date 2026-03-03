'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface FilterState {
  stops: string[]; // 'direct', '1stop', '2stops'
  priceRange: { min: number; max: number };
  airlines: string[];
}

interface FlightFiltersProps {
  onFilterChange: (filters: FilterState) => void;
  /** Lista dinámica de aerolíneas disponibles en los resultados actuales */
  availableAirlines?: string[];
}

const DEFAULT_FILTERS: FilterState = {
  stops: [],
  priceRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
  airlines: [],
};

export default function FlightFilters({ onFilterChange, availableAirlines = [] }: FlightFiltersProps) {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

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
    let value: number;

    if (raw === '') {
      value = key === 'max' ? Number.MAX_SAFE_INTEGER : 0;
    } else {
      const n = Number(raw);
      value = Number.isFinite(n) ? n : 0;
    }

    const newPriceRange = { ...filters.priceRange, [key]: value };
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
          <h3 className="font-bold text-[#0F2545] text-lg">{t('flights.filters.title')}</h3>
          <button className="text-xs text-[#FF4757] hover:underline" onClick={clearAll}>
            {t('flights.filters.clearAll')}
          </button>
        </div>

        {/* 1. Stops filter */}
        <div className="mb-6 border-b border-gray-100 pb-4">
          <h4 className="font-medium text-sm text-gray-700 mb-3">{t('flights.filters.stops')}</h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-[#FF4757] focus:ring-[#FF4757]"
                checked={filters.stops.includes('direct')}
                onChange={() => handleCheckboxChange('stops', 'direct')}
              />
              <span className="text-sm text-gray-600 group-hover:text-[#0F2545]">
                {t('flights.filters.direct')}
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-[#FF4757] focus:ring-[#FF4757]"
                checked={filters.stops.includes('1stop')}
                onChange={() => handleCheckboxChange('stops', '1stop')}
              />
              <span className="text-sm text-gray-600 group-hover:text-[#0F2545]">{t('flights.filters.oneStop')}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-[#FF4757] focus:ring-[#FF4757]"
                checked={filters.stops.includes('2stops')}
                onChange={() => handleCheckboxChange('stops', '2stops')}
              />
              <span className="text-sm text-gray-600 group-hover:text-[#0F2545]">{t('flights.filters.twoStops')}</span>
            </label>
          </div>
        </div>

        {/* 2. Price range */}
        <div className="mb-6 border-b border-gray-100 pb-4">
          <h4 className="font-medium text-sm text-gray-700 mb-3">{t('flights.filters.price')}</h4>
          <div className="flex items-center gap-2">
            <div className="w-1/2">
              <label className="text-xs text-gray-400">{t('flights.filters.min')}</label>
              <Input
                type="number"
                placeholder="0"
                value={filters.priceRange.min || ''}
                onChange={(e) => handlePriceChange('min', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="w-1/2">
              <label className="text-xs text-gray-400">{t('flights.filters.max')}</label>
              <Input
                type="number"
                placeholder={t('flights.filters.noLimit')}
                value={filters.priceRange.max === Number.MAX_SAFE_INTEGER ? '' : filters.priceRange.max}
                onChange={(e) => handlePriceChange('max', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>

        {/* 3. Airlines */}
        <div>
          <h4 className="font-medium text-sm text-gray-700 mb-3">{t('flights.filters.airlines')}</h4>
          {availableAirlines.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              {t('flights.filters.airlinesHint')}
            </p>
          ) : (
            <div className="space-y-2">
              {availableAirlines.map((airline) => (
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
          )}
        </div>
      </Card>
    </div>
  );
}
