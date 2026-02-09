/**
 * @fileoverview Price Breakdown Card — Transparent commission display.
 * Per spec §5.1: "The price breakdown must be FULLY VISIBLE to the client
 * before paying." Shows: Base + Markup + Gateway Fee = Total.
 * @module components/features/checkout/PriceBreakdownCard
 */
import Card from '@/components/ui/Card';
import type { PriceBreakdown } from '@/types/models';
import { Receipt, Info } from 'lucide-react';

interface Props {
  breakdown: PriceBreakdown;
  gateway?: 'stripe' | 'paypal' | 'zelle';
}

export default function PriceBreakdownCard({ breakdown, gateway = 'stripe' }: Props) {
  const gatewayLabel: Record<string, string> = {
    stripe: 'Stripe',
    paypal: 'PayPal',
    zelle: 'Zelle (sin comisión)',
  };

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
        <div className="flex justify-between">
          <span className="text-neutral-600">Servicio agencia</span>
          <span className="font-medium">${breakdown.markup_amount.toFixed(2)}</span>
        </div>

        {/* Passengers multiplier */}
        {breakdown.passengers > 1 && (
          <div className="flex justify-between text-neutral-500">
            <span>× {breakdown.passengers} pasajeros</span>
            <span>${breakdown.subtotal.toFixed(2)}</span>
          </div>
        )}

        {/* Subtotal */}
        <div className="flex justify-between border-t border-neutral-200 pt-2">
          <span className="font-medium text-neutral-700">Subtotal</span>
          <span className="font-semibold">${breakdown.subtotal.toFixed(2)}</span>
        </div>

        {/* Gateway fee */}
        <div className="flex justify-between">
          <span className="flex items-center gap-1 text-neutral-600">
            Comisión {gatewayLabel[gateway]}
            <Info className="h-3 w-3 text-neutral-400" />
          </span>
          <span className="font-medium">
            {gateway === 'zelle' ? '$0.00' : `$${breakdown.gateway_fee.toFixed(2)}`}
          </span>
        </div>
        {gateway !== 'zelle' && (
          <p className="text-xs text-neutral-400">
            ({breakdown.gateway_fee_pct}% + ${breakdown.gateway_fixed_fee.toFixed(2)})
          </p>
        )}

        {/* TOTAL */}
        <div className="flex justify-between border-t-2 border-brand-200 pt-3">
          <span className="text-lg font-bold text-neutral-900">TOTAL A PAGAR</span>
          <span className="text-lg font-bold text-brand-600">
            ${gateway === 'zelle' ? breakdown.subtotal.toFixed(2) : breakdown.total.toFixed(2)}
          </span>
        </div>
      </div>
    </Card>
  );
}
