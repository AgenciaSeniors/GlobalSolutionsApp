import test from 'node:test';
import assert from 'node:assert/strict';

import { priceEngine } from './priceEngine';

test('percentage markup + buffer + gateway fee', () => {
  const result = priceEngine({
    base: { amount: 100, currency: 'USD' },
    markup: { type: 'percentage', percentage: 10 },
    volatility_buffer: { type: 'percentage', percentage: 3 },
    gateway_fee: { type: 'percentage', percentage: 2.9 },
  });

  assert.equal(result.subtotal, 100);
  assert.equal(result.markup_amount, 10);
  assert.equal(result.volatility_buffer_amount, 3);
  assert.equal(result.gateway_fee_amount, 3.28);
  assert.equal(result.total_amount, 116.28);
  assert.equal(result.cents.total_amount, 11628);
});

test('fixed markup + mixed gateway fee', () => {
  const result = priceEngine({
    base: { amount: 50, currency: 'USD' },
    markup: { type: 'fixed', amount: 5 },
    gateway_fee: {
      type: 'mixed',
      percentage: 2,
      fixed_amount: 0.3,
    },
  });

  assert.equal(result.gateway_fee_amount, 1.4);
  assert.equal(result.total_amount, 56.4);
});

test('throws on negative base amount', () => {
  assert.throws(() =>
    priceEngine({
      base: { amount: -1, currency: 'USD' },
      markup: { type: 'none' },
      gateway_fee: { type: 'none' },
    })
  );
});
