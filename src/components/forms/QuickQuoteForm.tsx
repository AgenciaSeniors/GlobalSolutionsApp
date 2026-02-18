'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import type {
  QuickQuoteGateway,
  QuickQuoteResponse,
} from '@/types/quickQuote';

type FormState = {
  net_price_per_person: string;
  passengers: string;
  markup_percentage: string;
  gateway: QuickQuoteGateway;
};

function parsePositiveNumber(v: string): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

function parsePositiveInt(v: string): number | null {
  const n = Number(v);
  if (!Number.isInteger(n)) return null;
  if (n <= 0) return null;
  return n;
}

function money(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function QuickQuoteForm() {
  const [form, setForm] = useState<FormState>({
    net_price_per_person: '',
    passengers: '1',
    markup_percentage: '10',
    gateway: 'stripe',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickQuoteResponse | null>(null);

  const validation = useMemo(() => {
    const net = parsePositiveNumber(form.net_price_per_person);
    const pax = parsePositiveInt(form.passengers);
    const markup = parsePositiveNumber(form.markup_percentage);

    const errors: Partial<Record<keyof FormState, string>> = {};

    if (net === null) errors.net_price_per_person = 'Ingresa un número válido (>= 0)';
    if (pax === null) errors.passengers = 'Ingresa un entero válido (>= 1)';
    if (markup === null) errors.markup_percentage = 'Ingresa un número válido (>= 0)';

    if (pax !== null && pax > 9) errors.passengers = 'Máximo 9 pasajeros (ajusta si tu negocio permite más)';

    return {
      net,
      pax,
      markup,
      errors,
      isValid: Object.keys(errors).length === 0,
    };
  }, [form]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!validation.isValid || validation.net === null || validation.pax === null || validation.markup === null) {
      setError('Revisa los campos marcados.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/internal/quick-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          net_price_per_person: validation.net,
          passengers: validation.pax,
          markup_percentage: validation.markup,
          gateway: form.gateway,
        }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const msg =
          typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
            ? (data as { error: string }).error
            : 'No se pudo calcular el precio.';
        throw new Error(msg);
      }

      setResult(data as QuickQuoteResponse);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-neutral-100 shadow-sm">
        <h2 className="text-lg font-bold text-neutral-900">Cotizador Rápido</h2>
        <p className="text-sm text-neutral-600 mt-1">
          Calcula <span className="font-medium">Neto + Markup + Comisión Pasarela</span> usando el motor de precios del servidor.
        </p>

        <form className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={onSubmit}>
          <Input
            label="Precio neto (por persona)"
            inputMode="decimal"
            value={form.net_price_per_person}
            onChange={(e) => setForm((p) => ({ ...p, net_price_per_person: e.target.value }))}
            error={validation.errors.net_price_per_person}
            placeholder="Ej: 220"
          />

          <Input
            label="Pasajeros"
            inputMode="numeric"
            value={form.passengers}
            onChange={(e) => setForm((p) => ({ ...p, passengers: e.target.value }))}
            error={validation.errors.passengers}
            placeholder="1"
          />

          <Input
            label="Markup (%)"
            inputMode="decimal"
            value={form.markup_percentage}
            onChange={(e) => setForm((p) => ({ ...p, markup_percentage: e.target.value }))}
            error={validation.errors.markup_percentage}
            placeholder="10"
          />

          <div className="w-full space-y-1">
            <label className="block text-sm font-medium text-brand-700">Pasarela</label>
            <select
              className="w-full rounded-xl border-2 px-4 py-3 text-[15px] font-medium border-brand-200 bg-white"
              value={form.gateway}
              onChange={(e) => setForm((p) => ({ ...p, gateway: e.target.value as QuickQuoteGateway }))}
            >
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
              <option value="zelle">Zelle</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-center gap-3 pt-2">
            <Button type="submit" disabled={submitting || !validation.isValid}>
              {submitting ? 'Calculando…' : 'Calcular'}
            </Button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </form>
      </Card>

      {result && (
        <Card className="p-6 border border-neutral-100 shadow-sm">
          <h3 className="text-base font-bold text-neutral-900">Resultado</h3>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-600">Neto por persona</span>
              <span className="font-semibold">{money(result.net_price_per_person)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-600">Pasajeros</span>
              <span className="font-semibold">{result.passengers}</span>
            </div>

            <div className="flex justify-between border-t pt-3 md:pt-0 md:border-t-0">
              <span className="text-neutral-600">Subtotal neto</span>
              <span className="font-semibold">{money(result.net_subtotal)}</span>
            </div>

            <div className="flex justify-between border-t pt-3 md:pt-0 md:border-t-0">
              <span className="text-neutral-600">Markup ({result.markup_percentage}%)</span>
              <span className="font-semibold">{money(result.breakdown.markup_amount)}</span>
            </div>

            <div className="flex justify-between md:col-span-2 border-t pt-3">
              <span className="text-neutral-600">Comisión pasarela ({result.gateway})</span>
              <span className="font-semibold">{money(result.breakdown.gateway_fee_amount)}</span>
            </div>

            <div className="flex justify-between md:col-span-2 border-t pt-3">
              <span className="text-neutral-900 font-bold">Total</span>
              <span className="text-neutral-900 font-bold">{money(result.breakdown.total_amount)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
