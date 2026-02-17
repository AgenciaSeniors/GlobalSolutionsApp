// src/lib/pricing/priceEngine.test.ts
import { describe, it, expect } from 'vitest';
import { priceEngine, type PriceEngineInput } from './priceEngine';

describe('priceEngine', () => {
  it('debe calcular el total correctamente cuando no hay comisiones (none)', () => {
    const input: PriceEngineInput = {
      base: { amount: 100.50, currency: 'USD' },
      markup: { type: 'none' },
      gateway_fee: { type: 'none' }
    };

    const result = priceEngine(input);

    expect(result.subtotal).toBe(100.50);
    expect(result.markup_amount).toBe(0);
    expect(result.gateway_fee_amount).toBe(0);
    expect(result.total_amount).toBe(100.50);
    expect(result.cents.total_amount).toBe(10050); // Validación en centavos
  });

  it('debe aplicar correctamente un markup fijo y en porcentaje (mixed)', () => {
    const input: PriceEngineInput = {
      base: { amount: 200.00, currency: 'USD' },
      markup: { type: 'mixed', percentage: 10, fixed_amount: 5.00 }, // 10% de 200 (20) + 5 = 25
      gateway_fee: { type: 'none' }
    };

    const result = priceEngine(input);

    expect(result.markup_amount).toBe(25.00);
    expect(result.total_amount).toBe(225.00);
  });

  it('debe calcular el gateway_fee basado en pre_fee_total (por defecto)', () => {
    const input: PriceEngineInput = {
      base: { amount: 100.00, currency: 'USD' },
      markup: { type: 'fixed', amount: 10.00 }, // Subtotal + markup = 110.00
      gateway_fee: { type: 'percentage', percentage: 5 } // 5% de 110 = 5.50
    };

    const result = priceEngine(input);

    expect(result.gateway_fee_amount).toBe(5.50);
    expect(result.total_amount).toBe(115.50);
  });

  it('debe calcular el gateway_fee basado exclusivamente en la base (base_only)', () => {
    const input: PriceEngineInput = {
      base: { amount: 100.00, currency: 'USD' },
      markup: { type: 'fixed', amount: 10.00 }, 
      gateway_fee: { type: 'percentage', percentage: 5 }, // 5% de la base (100) = 5.00
      gateway_fee_base: 'base_only'
    };

    const result = priceEngine(input);

    expect(result.gateway_fee_amount).toBe(5.00);
    expect(result.total_amount).toBe(115.00); // 100 + 10 + 5
  });

  it('debe lanzar un error si la moneda no es USD', () => {
    const input = {
      base: { amount: 100, currency: 'EUR' },
      markup: { type: 'none' },
      gateway_fee: { type: 'none' }
    } as unknown as PriceEngineInput; // Usamos as unknown para forzar el error de tipado y probar el runtime

    expect(() => priceEngine(input)).toThrowError('Unsupported currency: EUR');
  });

  it('debe lanzar un error si el monto base es negativo', () => {
    const input: PriceEngineInput = {
      base: { amount: -50, currency: 'USD' },
      markup: { type: 'none' },
      gateway_fee: { type: 'none' }
    };

    expect(() => priceEngine(input)).toThrowError('base.amount must be >= 0');
  });
});