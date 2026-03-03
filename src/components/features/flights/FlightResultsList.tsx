'use client';

import { FlightOffer } from '@/types/models';
import FlightCard from './FlightCard';
import { AlertCircle } from 'lucide-react';
import { FlightLoader } from '@/components/ui';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface FlightResultsListProps {
  flights: FlightOffer[];
  isLoading?: boolean;
  error?: string | null;
  onSelectFlight?: (flightId: string) => void;
  onRetry?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export default function FlightResultsList({
  flights,
  isLoading = false,
  error = null,
  onSelectFlight,
  onRetry,
  hasMore = false,
  onLoadMore,
}: FlightResultsListProps) {
  const { t } = useLanguage();

  console.log(`[FlightResultsList] isLoading=${isLoading} flights=${flights?.length ?? 0} error=${String(error)}`);

  // 1. Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
        <FlightLoader />
        <h3 className="mt-12 text-xl font-bold text-[#0F2545]">
          {t('flights.loading.title')}
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          {t('flights.loading.subtitle')}
        </p>
      </div>
    );
  }

  // 2. Error state
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="mb-2 text-lg font-bold text-red-900">{t('flights.error.title')}</h3>
        <p className="mb-4 text-sm text-red-700">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            {t('flights.error.retry')}
          </button>
        )}
      </div>
    );
  }

  // 3. Empty state
  if (!flights || flights.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
        <p className="text-[#0F2545] font-medium text-lg">{t('flights.empty.title')}</p>
        <p className="text-gray-400 text-sm">{t('flights.empty.subtitle')}</p>
      </div>
    );
  }

  // 4. Results list
  return (
    <div className="space-y-4">
      {flights.map((flight) => (
        <FlightCard
          key={flight.id}
          flight={flight}
          onSelect={onSelectFlight}
        />
      ))}
      {hasMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="w-full py-3 rounded-xl border border-brand-200 text-brand-600 text-sm font-medium hover:bg-brand-50 transition-colors"
        >
          {t('flights.loadMore')}
        </button>
      )}
    </div>
  );
}
