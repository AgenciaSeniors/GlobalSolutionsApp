/**
 * @fileoverview Price Summary Card — Shows subtotal, gateway tax, and total.
 * Gateway fee is displayed as "Tax" and updates dynamically per payment method.
 * @module components/features/checkout/PriceBreakdownCard
 */
import Card from '@/components/ui/Card';
import type { PriceBreakdown } from '@/types/models';
import { Receipt } from 'lucide-react';

type Gateway = 'stripe' | 'paypal' | 'zelle';

const GATEWAY_LABELS: Record<Gateway, string> = {
  stripe: 'Tarjeta',
  paypal: 'PayPal',
  zelle: 'Zelle',
};

interface Props {
  breakdown: PriceBreakdown;
  gateway: Gateway;
}

export default function PriceBreakdownCard({ breakdown, gateway }: Props) {
  const subtotalWithBuffer = breakdown.subtotal + (breakdown.volatility_buffer ?? 0);
  const showTax = gateway !== 'zelle' && breakdown.gateway_fee > 0;

  // Build tax label: "Tax (Tarjeta 2.9% + $0.30)"
  const gatewayLabel = GATEWAY_LABELS[gateway] ?? gateway;
  const taxParts: string[] = [];
  if (breakdown.gateway_fee_pct > 0) taxParts.push(`${breakdown.gateway_fee_pct}%`);
  if (breakdown.gateway_fixed_fee > 0) taxParts.push(`$${breakdown.gateway_fixed_fee.toFixed(2)}`);
  const taxDetail = taxParts.length > 0 ? ` (${gatewayLabel} ${taxParts.join(' + ')})` : '';

  return (
    <Card variant="bordered" className="bg-neutral-50">
      <h4 className="mb-4 flex items-center gap-2 font-bold text-neutral-800">
        <Receipt className="h-5 w-5 text-brand-600" />
        Resumen del Pago
      </h4>

      <div className="space-y-2 text-sm">
        {/* Passengers count */}
        {breakdown.passengers > 1 && (
          <div className="flex justify-between text-neutral-500">
            <span>Pasajeros</span>
            <span>{breakdown.passengers}</span>
          </div>
        )}

        {/* Passenger type breakdown (if available) */}
        {breakdown.passenger_details && breakdown.passenger_details.length > 0 && (
          <>
            {breakdown.passenger_details.map((p) => {
              const typeLabel =
                p.type === 'infant' ? 'Infante' : p.type === 'child' ? 'Niño' : 'Adulto';
              return (
                <div key={p.index} className="flex justify-between text-neutral-500">
                  <span>
                    Pasajero {p.index + 1}{' '}
                    <span className="text-xs text-neutral-400">({typeLabel})</span>
                  </span>
                  <span>${p.price.toFixed(2)}</span>
                </div>
              );
            })}
          </>
        )}

        {/* Subtotal */}
        <div className="flex justify-between text-neutral-700">
          <span>Subtotal</span>
          <span>${subtotalWithBuffer.toFixed(2)}</span>
        </div>

        {/* Gateway tax */}
        {showTax && (
          <div className="flex justify-between text-neutral-500">
            <span className="truncate max-w-[200px]">Tax{taxDetail}</span>
            <span>${breakdown.gateway_fee.toFixed(2)}</span>
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between border-t-2 border-brand-200 pt-3 mt-1">
          <span className="text-lg font-bold text-neutral-900">TOTAL A PAGAR</span>
          <span className="text-lg font-bold text-brand-600">
            ${breakdown.total.toFixed(2)}
          </span>
        </div>
      </div>
    </Card>
  );
}
