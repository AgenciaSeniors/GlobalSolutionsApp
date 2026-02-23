/**
 * @fileoverview Price Breakdown Card — Clean price display for clients.
 * Shows: Base + Markup + Age pricing + Volatility = Total.
 * Gateway fees are included silently in the total (not itemized).
 * @module components/features/checkout/PriceBreakdownCard
 */
import Card from '@/components/ui/Card';
import type { PriceBreakdown } from '@/types/models';
import { Receipt, Info, Users } from 'lucide-react';

interface Props {
  breakdown: PriceBreakdown;
}

const passengerTypeLabel: Record<string, string> = {
  adult: 'Adulto',
  child: 'Menor (2-11)',
  infant: 'Infante (0-1)',
};

export default function PriceBreakdownCard({ breakdown }: Props) {

  const hasPassengerDetails = breakdown.passenger_details && breakdown.passenger_details.length > 0;

  return (
    <Card variant="bordered" className="bg-neutral-50">
      <h4 className="mb-4 flex items-center gap-2 font-bold text-neutral-800">
        <Receipt className="h-5 w-5 text-brand-600" />
        Desglose del Precio
      </h4>

      <div className="space-y-2 text-sm">
        {/* Base price per person */}
        <div className="flex justify-between">
          <span className="text-neutral-600">Precio base (por persona)</span>
          <span className="font-medium">${breakdown.base_price.toFixed(2)}</span>
        </div>

        {/* Markup */}
        {breakdown.markup_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-neutral-600">Servicio agencia</span>
            <span className="font-medium">${breakdown.markup_amount.toFixed(2)}</span>
          </div>
        )}

        {/* Per-passenger breakdown (age-based pricing) */}
        {hasPassengerDetails ? (
          <div className="space-y-1 border-t border-neutral-200 pt-2">
            <div className="flex items-center gap-1 text-neutral-500">
              <Users className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Pasajeros ({breakdown.passengers})</span>
            </div>
            {breakdown.passenger_details!.map((p, i) => (
              <div key={i} className="flex justify-between pl-5">
                <span className="text-neutral-500">
                  {passengerTypeLabel[p.type] ?? p.type}
                  {p.multiplier < 1 && (
                    <span className="ml-1 text-xs text-emerald-600">({Math.round(p.multiplier * 100)}%)</span>
                  )}
                </span>
                <span className="font-medium">${p.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : breakdown.passengers > 1 ? (
          <div className="flex justify-between text-neutral-500">
            <span>x {breakdown.passengers} pasajeros</span>
            <span>${breakdown.subtotal.toFixed(2)}</span>
          </div>
        ) : null}

        {/* Subtotal */}
        <div className="flex justify-between border-t border-neutral-200 pt-2">
          <span className="font-medium text-neutral-700">Subtotal</span>
          <span className="font-semibold">${breakdown.subtotal.toFixed(2)}</span>
        </div>

        {/* Volatility buffer */}
        {breakdown.volatility_buffer != null && breakdown.volatility_buffer > 0 && (
          <div className="flex justify-between">
            <span className="flex items-center gap-1 text-neutral-600">
              Proteccion cambiaria (3%)
              <Info className="h-3 w-3 text-neutral-400" />
            </span>
            <span className="font-medium">${breakdown.volatility_buffer.toFixed(2)}</span>
          </div>
        )}

        {/* TOTAL (includes gateway fee silently) */}
        <div className="flex justify-between border-t-2 border-brand-200 pt-3">
          <span className="text-lg font-bold text-neutral-900">TOTAL A PAGAR</span>
          <span className="text-lg font-bold text-brand-600">
            ${breakdown.total.toFixed(2)}
          </span>
        </div>
      </div>
    </Card>
  );
}
