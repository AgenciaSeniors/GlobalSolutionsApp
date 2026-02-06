/**
 * @fileoverview Offer card with gradient header, discount badge,
 *               urgency indicator and countdown.
 * @module components/features/flights/ExclusiveOfferCard
 */
import { Flame, Clock, MapPin, Plane } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatCurrency, calcDiscount } from '@/lib/utils/formatters';

export interface ExclusiveOfferCardProps {
  destination: string;
  route: string;
  airline: string;
  duration: string;
  originalPrice: number;
  offerPrice: number;
  availableSeats: number;
  gradient: string; // Tailwind gradient classes
}

export default function ExclusiveOfferCard({
  destination,
  route,
  airline,
  duration,
  originalPrice,
  offerPrice,
  availableSeats,
  gradient,
}: ExclusiveOfferCardProps) {
  const discount = calcDiscount(originalPrice, offerPrice);
  const urgent = availableSeats < 6;

  return (
    <article className="group overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm transition-all duration-400 hover:-translate-y-2 hover:shadow-xl">
      {/* ── Gradient Header ── */}
      <div
        className={`relative flex h-44 flex-col justify-between p-5 text-white ${gradient}`}
      >
        <div className="flex items-start justify-between">
          <Badge variant="success" className="text-sm font-extrabold">
            -{discount}%
          </Badge>
          {urgent && (
            <Badge variant="destructive" className="animate-pulse">
              <Flame className="h-3 w-3" />
              ¡{availableSeats} cupos!
            </Badge>
          )}
        </div>

        <div>
          <p className="text-sm text-white/70">{airline}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
            <Plane className="h-3.5 w-3.5" />
            {route} · {duration}
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
          <MapPin className="h-4 w-4 text-brand-500" />
          {destination}
        </h3>

        {/* Price */}
        <div className="mt-3 flex items-baseline gap-2.5">
          <span className="text-base text-neutral-400 line-through">
            {formatCurrency(originalPrice)}
          </span>
          <span className="text-3xl font-extrabold text-brand-600">
            {formatCurrency(offerPrice)}
          </span>
        </div>
        <p className="text-xs text-neutral-500">por persona · impuestos incluidos</p>

        {/* Countdown hint */}
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
          <Clock className="h-3.5 w-3.5" />
          Oferta válida por 48 horas
        </div>

        <Button className="mt-4 w-full">Reservar Ahora</Button>
      </div>
    </article>
  );
}
