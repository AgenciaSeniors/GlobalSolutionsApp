'use client';

import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import type { CustomerExperience } from '@/types/models';
import { cn } from '@/lib/utils/cn';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function CustomerExperienceCarousel({
  experiences,
}: {
  experiences: CustomerExperience[];
}) {
  const { t } = useLanguage();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: experiences.length > 1,
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

  /* Auto-play every 3 s — cycles through all */
  useEffect(() => {
    if (!emblaApi || experiences.length <= 1 || isPaused) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      if (emblaApi.canScrollNext()) emblaApi.scrollNext();
      else emblaApi.scrollTo(0);
    }, 3000);
    return () => window.clearInterval(id);
  }, [emblaApi, experiences.length, isPaused]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (!experiences.length) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex gap-5">
          {experiences.map((exp) => (
            <div
              key={exp.id}
              className="min-w-0 flex-[0_0_88%] sm:flex-[0_0_56%] lg:flex-[0_0_36%]"
            >
              <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                {/* Photo — shown only if present */}
                {exp.photo_url && (
                  <div className="h-52 w-full overflow-hidden">
                    <img
                      src={exp.photo_url}
                      alt="Experiencia de cliente"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Comment */}
                {exp.comment && (
                  <div className="flex flex-1 flex-col justify-center p-5">
                    <Quote className="mb-2 h-6 w-6 text-brand-300" strokeWidth={1.5} />
                    <p className="text-sm italic leading-relaxed text-neutral-600">
                      {exp.comment}
                    </p>
                  </div>
                )}

                {/* Card with only photo and no comment still renders cleanly */}
                {!exp.comment && exp.photo_url && (
                  <div className="h-2 w-full" />
                )}
              </article>
            </div>
          ))}
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
            aria-label={t('offers.carousel.prev')}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            disabled={!canNext}
            className="rounded-xl border border-neutral-200 bg-white p-2.5 text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:opacity-40"
            aria-label={t('offers.carousel.next')}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {experiences.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            {experiences.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => emblaApi?.scrollTo(i)}
                className={cn(
                  'h-2.5 w-2.5 rounded-full transition',
                  i === selected ? 'bg-brand-600' : 'bg-neutral-300 hover:bg-neutral-400',
                )}
                aria-label={`${t('offers.carousel.goToSlide')} ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
