/**
 * @fileoverview Price Summary Card — Shows only the total to pay.
 * Gateway fee, markup and volatility buffer are included in the total silently.
 * @module components/features/checkout/PriceBreakdownCard
 */
import Card from '@/components/ui/Card';
import type { PriceBreakdown } from '@/types/models';
import { Receipt } from 'lucide-react';

interface Props {
  breakdown: PriceBreakdown;
}

export default function PriceBreakdownCard({ breakdown }: Props) {
  return (
    <Card variant="bordered" className="bg-neutral-50">
      <h4 className="mb-4 flex items-center gap-2 font-bold text-neutral-800">
        <Receipt className="h-5 w-5 text-brand-600" />
        Resumen del Pago
      </h4>

      <div className="space-y-2 text-sm">
        {/* Passengers count only */}
        {breakdown.passengers > 1 && (
          <div className="flex justify-between text-neutral-500">
            <span>Pasajeros</span>
            <span>{breakdown.passengers}</span>
          </div>
        )}

        {/* Single total */}
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
