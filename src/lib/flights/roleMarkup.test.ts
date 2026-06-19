import { describe, it, expect } from 'vitest';
import { applyRoleMarkup, type FlightLegData } from './roleMarkup';

describe('applyRoleMarkup', () => {
  it('applies markup over base_price and overwrites price/final_price', () => {
    const legs: FlightLegData[] = [{ flights: [{ base_price: 100 }] }];
    const [leg] = applyRoleMarkup(legs, 10);
    const f = leg.flights![0];
    expect(f.base_price).toBe(100);
    expect(f.markup_percentage).toBe(10);
    expect(f.final_price).toBe(110);
    expect(f.price).toBe(110);
  });

  it('falls back to price/final_price when base_price is missing', () => {
    const legs: FlightLegData[] = [{ flights: [{ price: 200 }] }];
    const [leg] = applyRoleMarkup(legs, 25);
    expect(leg.flights![0].base_price).toBe(200);
    expect(leg.flights![0].final_price).toBe(250);
  });

  it('rounds to 2 decimals', () => {
    const legs: FlightLegData[] = [{ flights: [{ base_price: 99.99 }] }];
    const [leg] = applyRoleMarkup(legs, 7);
    // 99.99 * 1.07 = 106.9893 -> 106.99
    expect(leg.flights![0].final_price).toBe(106.99);
  });

  it('is idempotent on base_price (re-applying does not compound)', () => {
    const legs: FlightLegData[] = [{ flights: [{ base_price: 100 }] }];
    const once = applyRoleMarkup(legs, 10);
    const twice = applyRoleMarkup(once, 10);
    expect(twice[0].flights![0].final_price).toBe(110);
    expect(twice[0].flights![0].base_price).toBe(100);
  });

  it('treats a 0 markup as pass-through', () => {
    const legs: FlightLegData[] = [{ flights: [{ base_price: 100 }] }];
    const [leg] = applyRoleMarkup(legs, 0);
    expect(leg.flights![0].final_price).toBe(100);
  });

  it('handles missing/empty flights safely', () => {
    expect(applyRoleMarkup([{}], 10)).toEqual([{ flights: [] }]);
    expect(applyRoleMarkup([], 10)).toEqual([]);
  });
});
