'use client';

import { Clock, MapPin, Plane } from 'lucide-react';
import type { FlightSegment } from '@/types/models';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface FlightStopsDetailsProps {
  segments: FlightSegment[];
  isOpen: boolean;
}

function formatTime(value: string): string {
  if (!value) return '—';
  // Extract HH:MM directly from ISO string (airport-local time)
  const match = value.match(/T(\d{2}:\d{2})/);
  if (match) return match[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value: string, locale: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function calculateLayoverDuration(arrivalTime: string, nextDepartureTime: string): string {
  const arr = new Date(arrivalTime).getTime();
  const dep = new Date(nextDepartureTime).getTime();
  const diffMs = dep - arr;

  if (diffMs <= 0 || !Number.isFinite(diffMs)) return '—';

  const minutes = Math.round(diffMs / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h <= 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export default function FlightStopsDetails({ segments, isOpen }: FlightStopsDetailsProps) {
  const { t, language } = useLanguage();

  if (!isOpen || segments.length <= 1) return null;

  const stopCount = segments.length - 1;
  const stopWord = stopCount === 1 ? t('flights.stops.stop') : t('flights.stops.stops');

  return (
    <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
      <div className="rounded-xl bg-gradient-to-br from-neutral-50 to-neutral-100 p-5 shadow-inner">
        <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <MapPin className="h-4 w-4" />
          {t('flights.stops.itinerary')} ({stopCount} {stopWord})
        </h4>

        <div className="space-y-4">
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1;
            const nextSegment = !isLast ? segments[index + 1] : null;
            const layoverDuration = nextSegment
              ? calculateLayoverDuration(segment.arrivalTime, nextSegment.departureTime)
              : null;

            return (
              <div key={segment.id}>
                {/* Flight segment */}
                <div className="flex items-start gap-4">
                  {/* Vertical timeline */}
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                      <Plane className="h-4 w-4" />
                    </div>
                    {!isLast && (
                      <div className="h-16 w-0.5 bg-gradient-to-b from-brand-200 to-neutral-200" />
                    )}
                  </div>

                  {/* Segment details */}
                  <div className="flex-1 pb-2">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {/* Departure */}
                      <div>
                        <p className="text-xs font-medium text-neutral-500">{t('flights.stops.departure')}</p>
                        <p className="text-lg font-bold text-neutral-900">
                          {formatTime(segment.departureTime)}
                        </p>
                        <p className="text-sm font-semibold text-neutral-700">{segment.origin}</p>
                        {segment.originName && (
                          <p className="text-xs text-neutral-500">{segment.originName}</p>
                        )}
                        <p className="text-xs text-neutral-400">{formatDate(segment.departureTime, language)}</p>
                      </div>

                      {/* Duration */}
                      <div className="flex flex-col items-center justify-center">
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{t('flights.stops.duration')}: {segment.duration}</span>
                        </div>
                        <p className="mt-1 text-xs text-neutral-400">
                          {segment.airline.name} {segment.flightNumber}
                        </p>
                      </div>

                      {/* Arrival */}
                      <div className="text-right">
                        <p className="text-xs font-medium text-neutral-500">{t('flights.stops.arrival')}</p>
                        <p className="text-lg font-bold text-neutral-900">
                          {formatTime(segment.arrivalTime)}
                        </p>
                        <p className="text-sm font-semibold text-neutral-700">{segment.destination}</p>
                        {segment.destinationName && (
                          <p className="text-xs text-neutral-500">{segment.destinationName}</p>
                        )}
                        <p className="text-xs text-neutral-400">{formatDate(segment.arrivalTime, language)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Layover */}
                {!isLast && layoverDuration && (
                  <div className="ml-4 flex items-center gap-3 border-l-2 border-dashed border-neutral-300 py-3 pl-8">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-700">
                        {t('flights.stops.layoverAt')} {segment.destinationName ?? segment.destination}
                        {segment.destinationName && (
                          <span className="ml-1 font-normal text-amber-600">({segment.destination})</span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-600">
                        {t('flights.stops.waitTime')}: {layoverDuration}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
