// src/lib/payments/refundCalculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateRefundAmount, type RefundInput } from './refundCalculator';

describe('calculateRefundAmount', () => {
  it('Regla 1: Debe devolver el 100% de la base reembolsable + $20 bono si cancela la aerolínea', () => {
    const input: RefundInput = {
      totalPaid: 500.00,
      hoursSinceBooking: 72, // El tiempo no importa si es la aerolínea
      isAirlineCancel: true,
      gatewayFee: 15.00
    };

    const result = calculateRefundAmount(input);

    // Base reembolsable: 500 - 15 = 485
    // Total a reembolsar: 485 + 20 (bono) = 505
    expect(result.refund_percentage).toBe(100);
    expect(result.compensation_bonus).toBe(20.00);
    expect(result.gateway_fee_retained).toBe(15.00);
    expect(result.refund_amount).toBe(505.00);
    expect(result.penalty_amount).toBe(0);
    expect(result.cents.refund_amount).toBe(50500);
  });

  it('Regla 2: Debe devolver el 100% de la base reembolsable sin penalidad si el cliente cancela en < 48 horas', () => {
    const input: RefundInput = {
      totalPaid: 300.00,
      hoursSinceBooking: 24, // Menor a 48h
      isAirlineCancel: false,
      gatewayFee: 9.00
    };

    const result = calculateRefundAmount(input);

    // Base reembolsable: 300 - 9 = 291
    expect(result.refund_percentage).toBe(100);
    expect(result.compensation_bonus).toBe(0);
    expect(result.gateway_fee_retained).toBe(9.00);
    expect(result.refund_amount).toBe(291.00);
    expect(result.penalty_amount).toBe(0);
  });

  it('Regla 3: Debe devolver el 50% de la base reembolsable si el cliente cancela en >= 48 horas', () => {
    const input: RefundInput = {
      totalPaid: 300.00,
      hoursSinceBooking: 50, // Mayor a 48h
      isAirlineCancel: false,
      gatewayFee: 10.00
    };

    const result = calculateRefundAmount(input);

    // Base reembolsable: 300 - 10 = 290
    // Reembolso 50% de 290 = 145. Penalidad = 145.
    expect(result.refund_percentage).toBe(50);
    expect(result.refund_amount).toBe(145.00);
    expect(result.penalty_amount).toBe(145.00);
    expect(result.gateway_fee_retained).toBe(10.00);
  });

  it('Debe usar gatewayFee en 0 por defecto si no se provee', () => {
    const input: RefundInput = {
      totalPaid: 100.00,
      hoursSinceBooking: 10,
      isAirlineCancel: false
      // No mandamos gatewayFee
    };

    const result = calculateRefundAmount(input);

    expect(result.gateway_fee_retained).toBe(0);
    expect(result.refund_amount).toBe(100.00);
  });

  it('Debe lanzar un error si se pasan valores negativos', () => {
    const input: RefundInput = {
      totalPaid: -50,
      hoursSinceBooking: 10,
      isAirlineCancel: false
    };

    expect(() => calculateRefundAmount(input)).toThrowError('totalPaid must be >= 0');
  });
});