/**
 * @fileoverview Interactive visual offer calendar.
 * Per spec §3.2: "Only offer days are illuminated (green/fire icon).
 * Non-offer days appear disabled/gray."
 * @module components/features/offers/OfferCalendar
 */
'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Flame, Plane } from 'lucide-react';
import Button from '@/components/ui/Button';

interface OfferCalendarProps {
  validDates: string[];          // ISO date strings (offer days)
  offerPrice: number;
  originalPrice: number;
  destination: string;
  onSelectDate?: (date: string) => void;
}

export default function OfferCalendar({
  validDates,
  offerPrice,
  originalPrice,
  destination,
  onSelectDate,
}: OfferCalendarProps) {
  const today = new Date();

  // Find the first upcoming offer date (or the earliest one if all are past)
  const firstOfferDate = useMemo(() => {
    if (!validDates.length) return null;
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const sorted = [...validDates].sort((a, b) => a.localeCompare(b));
    const nextUpcoming = sorted.find((d) => new Date(d + 'T12:00:00') >= todayMid);
    return nextUpcoming ?? sorted[0] ?? null;
  }, [validDates]);

  // Initialize calendar on the month of the first offer date, not the current month
  const initialMonth = firstOfferDate ? new Date(firstOfferDate + 'T12:00:00').getMonth() : today.getMonth();
  const initialYear = firstOfferDate ? new Date(firstOfferDate + 'T12:00:00').getFullYear() : today.getFullYear();

  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [currentYear, setCurrentYear] = useState(initialYear);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const offerSet = useMemo(() => new Set(validDates), [validDates]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  const monthName = new Date(currentYear, currentMonth).toLocaleString('es', { month: 'long', year: 'numeric' });

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  }

  function handleSelect(dateStr: string) {
    setSelectedDate(dateStr);
    onSelectDate?.(dateStr);
  }

  // Build calendar grid
  const days: Array<{ date: number; dateStr: string; isOffer: boolean; isPast: boolean }> = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(currentYear, currentMonth, d);
    const dateStr = dateObj.toISOString().split('T')[0];
    days.push({
      date: d,
      dateStr,
      isOffer: offerSet.has(dateStr),
      isPast: dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    });
  }

  const savings = originalPrice - offerPrice;
  const savingsPct = Math.round((savings / originalPrice) * 100);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4 text-center">
        <h3 className="text-lg font-bold text-brand-950">
          <Plane className="mr-1.5 inline h-5 w-5 text-brand-600" />
          Fechas disponibles para {destination}
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          Selecciona un día iluminado para reservar
        </p>
      </div>

      {/* Price callout */}
      <div className="mb-5 flex items-center justify-center gap-4 rounded-xl bg-gradient-to-r from-emerald-50 to-brand-50 p-3">
        <div className="text-center">
          <p className="text-xs text-neutral-500 line-through">${originalPrice}</p>
          <p className="text-2xl font-extrabold text-emerald-600">${offerPrice}</p>
        </div>
        <div className="rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-700">
          Ahorras ${savings} ({savingsPct}%)
        </div>
      </div>

      {/* Month nav */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-lg p-2 hover:bg-neutral-100 transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-semibold capitalize text-brand-900">{monthName}</span>
        <button onClick={nextMonth} className="rounded-lg p-2 hover:bg-neutral-100 transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold text-neutral-400">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDayOfWeek }, (_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {days.map(({ date, dateStr, isOffer, isPast }) => {
          const isSelected = selectedDate === dateStr;
          const isDisabled = isPast || !isOffer;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => handleSelect(dateStr)}
              className={`
                relative flex h-12 w-full flex-col items-center justify-center rounded-xl text-sm font-medium transition-all
                ${isOffer && !isPast
                  ? isSelected
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:scale-105 border border-emerald-200 cursor-pointer'
                  : 'text-neutral-300 cursor-default'
                }
              `}
            >
              <span>{date}</span>
              {isOffer && !isPast && (
                <Flame className={`absolute -top-1 -right-1 h-3.5 w-3.5 ${isSelected ? 'text-amber-300' : 'text-orange-500'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-neutral-500">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-emerald-100 border border-emerald-300" />
          <span>Oferta disponible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Flame className="h-3 w-3 text-orange-500" />
          <span>Fecha de oferta</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-neutral-100" />
          <span>No disponible</span>
        </div>
      </div>

      {/* CTA */}
      {selectedDate && (
        <div className="mt-5">
          <Button className="w-full gap-2" onClick={() => onSelectDate?.(selectedDate)}>
            <Plane className="h-4 w-4" />
            Reservar para {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long' })} — ${offerPrice}
          </Button>
        </div>
      )}
    </div>
  );
}
