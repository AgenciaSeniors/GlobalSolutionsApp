'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Flame, MapPin, Calendar } from 'lucide-react';
import type { SpecialOffer } from '@/types/models';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { calcDiscount, formatCurrency, formatDate } from '@/lib/utils/formatters';

function tagLabel(tag: string) {
  if (tag === 'exclusive') return 'Exclusivo';
  if (tag === 'flash_24h') return 'Flash 24h';
  if (tag === 'few_seats') return 'Pocos cupos';
  if (tag === 'fire') return 'Fuego';
  return tag;
}

export default function OffersCalendarExplorer({ offers }: { offers: SpecialOffer[] }) {
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const dateToOffers = useMemo(() => {
    const map = new Map<string, SpecialOffer[]>();
    for (const o of offers) {
      for (const d of o.valid_dates ?? []) {
        const list = map.get(d) ?? [];
        list.push(o);
        map.set(d, list);
      }
    }
    return map;
  }, [offers]);

  const allOfferDatesSorted = useMemo(() => {
    return Array.from(dateToOffers.keys()).sort((a, b) => a.localeCompare(b));
  }, [dateToOffers]);

  const defaultSelected = useMemo(() => {
    const next = allOfferDatesSorted.find((d) => new Date(d) >= todayMid);
    return next ?? allOfferDatesSorted[0] ?? null;
  }, [allOfferDatesSorted, todayMid]);

  const [selectedDate, setSelectedDate] = useState<string | null>(defaultSelected);

  const [currentMonth, setCurrentMonth] = useState(
    selectedDate ? new Date(selectedDate).getMonth() : today.getMonth()
  );
  const [currentYear, setCurrentYear] = useState(
    selectedDate ? new Date(selectedDate).getFullYear() : today.getFullYear()
  );

  const monthName = new Date(currentYear, currentMonth).toLocaleString('es', {
    month: 'long',
    year: 'numeric',
  });

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  const days = useMemo(() => {
    const out: Array<{ date: number; dateStr: string; hasOffers: boolean; isPast: boolean; count: number }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(currentYear, currentMonth, d);
      const dateStr = dateObj.toISOString().split('T')[0];
      const hasOffers = dateToOffers.has(dateStr);
      const isPast = dateObj < todayMid;
      const count = (dateToOffers.get(dateStr) ?? []).length;
      out.push({ date: d, dateStr, hasOffers, isPast, count });
    }
    return out;
  }, [currentYear, currentMonth, daysInMonth, dateToOffers, todayMid]);

  const offersForSelected = selectedDate ? dateToOffers.get(selectedDate) ?? [] : [];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
      {/* Calendar */}
      <Card variant="bordered" className="lg:col-span-3">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={prevMonth} className="rounded-lg p-2 transition hover:bg-neutral-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500">Calendario</p>
            <p className="font-semibold capitalize text-brand-950">{monthName}</p>
          </div>
          <button onClick={nextMonth} className="rounded-lg p-2 transition hover:bg-neutral-100">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold text-neutral-400">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOfWeek }, (_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {days.map(({ date, dateStr, hasOffers, isPast, count }) => {
            const isSelected = selectedDate === dateStr;
            const disabled = isPast || !hasOffers;

            return (
              <button
                key={dateStr}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedDate(dateStr)}
                className={[
                  'relative flex h-12 w-full flex-col items-center justify-center rounded-xl text-sm font-medium transition',
                  hasOffers && !isPast
                    ? isSelected
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-[1.03]'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:scale-[1.03] border border-emerald-200'
                    : 'text-neutral-300 cursor-default',
                ].join(' ')}
                title={hasOffers ? `${count} oferta(s)` : 'Sin oferta'}
              >
                <span>{date}</span>
                {hasOffers && !isPast && (
                  <>
                    <Flame className={`absolute -top-1 -right-1 h-3.5 w-3.5 ${isSelected ? 'text-amber-300' : 'text-orange-500'}`} />
                    <span className="text-[10px] opacity-80">{count}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-600" />
            <span>
              {selectedDate ? (
                <>
                  Seleccionado: <strong>{formatDate(selectedDate)}</strong>
                </>
              ) : (
                'Selecciona una fecha con oferta'
              )}
            </span>
          </div>
          <span className="text-xs text-neutral-500">
            Solo se iluminan días con ofertas activas.
          </span>
        </div>
      </Card>

      {/* List */}
      <div className="lg:col-span-2 space-y-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-amber-700">
            Ofertas del día
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-brand-950">
            {selectedDate ? formatDate(selectedDate) : '—'}
          </h2>
        </div>

        {offersForSelected.length === 0 ? (
          <Card variant="bordered" className="text-center">
            <p className="text-neutral-600">No hay ofertas para esta fecha.</p>
            <p className="mt-1 text-sm text-neutral-500">Elige otro día iluminado.</p>
          </Card>
        ) : (
          offersForSelected.map((o) => {
            const seatsLeft = Math.max(0, o.max_seats - o.sold_seats);
            const discount = calcDiscount(o.original_price, o.offer_price);

            return (
              <Card key={o.id} variant="elevated" className="p-5">
                <div className="flex gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl bg-neutral-100">
                    {o.destination_img ? (
                      <img
                        src={o.destination_img}
                        alt={o.destination}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-brand-200 to-brand-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-bold text-brand-950">
                      <MapPin className="h-4 w-4 text-brand-600" />
                      <span className="truncate">{o.destination}</span>
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="success" className="text-xs font-extrabold">
                        -{discount}%
                      </Badge>
                      {o.tags?.slice(0, 3).map((t) => (
                        <Badge key={t} variant={t === 'fire' ? 'warning' : 'outline'} className="text-xs">
                          {tagLabel(t)}
                        </Badge>
                      ))}
                      {seatsLeft <= 5 && (
                        <Badge variant="destructive" className="text-xs font-bold">
                          ¡{seatsLeft} cupos!
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-sm text-neutral-400 line-through">
                        {formatCurrency(o.original_price)}
                      </span>
                      <span className="text-2xl font-extrabold text-brand-700">
                        {formatCurrency(o.offer_price)}
                      </span>
                    </div>

                    <div className="mt-4">
                      <Link href={`/offers/${o.id}`}>
                        <Button className="w-full">Ver oferta</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
