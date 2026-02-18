'use client';

import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import type { SpecialOffer } from '@/types/models';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { calcDiscount, formatCurrency, formatDate } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

export default function HomeOffersCarousel({ offers }: { offers: SpecialOffer[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: offers.length > 1,
    align: 'start',
    dragFree: false,
  });

  const [selected, setSelected] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [isPaused, setIsPaused] = useState(false);


  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  useEffect(() => {
  if (!emblaApi) return;
  if (offers.length <= 1) return;
  if (isPaused) return;

  const id = window.setInterval(() => {
    if (document.hidden) return;

    if (emblaApi.canScrollNext()) emblaApi.scrollNext();
    else emblaApi.scrollTo(0);
  }, 2500);

  return () => window.clearInterval(id);
}, [emblaApi, offers.length, isPaused]);



  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (!offers?.length) return null;

  return (
    <div className="relative">

      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex gap-6">
          {offers.map((o) => {
            const seatsLeft = Math.max(0, o.max_seats - o.sold_seats);
            const discount = calcDiscount(o.original_price, o.offer_price);
            const firstDate = o.valid_dates?.[0];

            return (
              <div
                key={o.id}
                className="min-w-0 flex-[0_0_92%] sm:flex-[0_0_62%] lg:flex-[0_0_42%]"
              >
                <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  {/* Background */}
                  <div className="absolute inset-0">
                    {o.destination_img ? (
                      <img
                        src={o.destination_img}
                        alt={o.destination}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-brand-900 via-indigo-900 to-brand-700" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
                  </div>

                  {/* Content */}
                  <div className="relative flex h-[340px] flex-col justify-between p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="success" className="text-xs font-extrabold">
                          -{discount}%
                        </Badge>

                        {o.tags?.includes('fire') && (
                          <Badge variant="warning" className="text-xs font-bold">
                            <Flame className="h-3 w-3" /> Hot
                          </Badge>
                        )}

                        {seatsLeft <= 5 && (
                          <Badge variant="destructive" className="text-xs font-bold">
                            ¡{seatsLeft} cupos!
                          </Badge>
                        )}
                      </div>

                      <span className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur">
                        {o.valid_dates?.length ?? 0} fechas
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-3xl font-extrabold tracking-tight text-white">
                        {o.destination}
                      </h3>

                      {o.urgency_label && (
                        <p className="mt-1 text-sm font-semibold text-amber-300">
                          {o.urgency_label}
                        </p>
                      )}

                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-sm text-white/70 line-through">
                            {formatCurrency(o.original_price)}
                          </p>
                          <p className="text-4xl font-extrabold text-white">
                            {formatCurrency(o.offer_price)}
                          </p>
                          <p className="mt-1 text-xs text-white/70">
                            {firstDate ? `Desde ${formatDate(firstDate)}` : 'Fechas variables'}
                          </p>
                        </div>

                        <Link href={`/offers/${o.id}`} className="shrink-0">
                          <Button size="lg" className="gap-2.5">
                            Ver oferta <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={scrollPrev}
            disabled={!canPrev}
            className="rounded-xl border border-neutral-200 bg-white p-2.5 text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:opacity-40"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            disabled={!canNext}
            className="rounded-xl border border-neutral-200 bg-white p-2.5 text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:opacity-40"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {offers.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                'h-2.5 w-2.5 rounded-full transition',
                i === selected ? 'bg-brand-600' : 'bg-neutral-300 hover:bg-neutral-400',
              )}
              aria-label={`Ir a slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
