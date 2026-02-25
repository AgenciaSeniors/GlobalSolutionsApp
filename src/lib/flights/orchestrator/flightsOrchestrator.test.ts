// src/lib/flights/orchestrator/flightsOrchestrator.test.ts
import { describe, it, expect } from 'vitest';
import { flightDedupeKey } from './flightsOrchestrator';
import type { Flight } from '@/lib/flights/providers/types';

describe('flightDedupeKey', () => {
  it('Debe generar una llave única correcta extrayendo datos normalizados', () => {
    // Usamos as unknown as Flight para mockear solo las propiedades necesarias estrictamente
    const mockFlight = {
      airline: { iata_code: 'AA' }, // Formato de agencia
      flight_number: '1234',
      origin_iata: 'HAV',
      destination_airport: { iata_code: 'MAD' }, // Formato alternativo
      departure_datetime: '2026-05-01T14:30:00.000Z'
    } as unknown as Flight;

    const key = flightDedupeKey(mockFlight);

    // Price removed from key: same physical flight with different pricing must NOT duplicate.
    // The departure is normalized to Cuba time (America/Havana, UTC-4 DST in May).
    // 2026-05-01T14:30:00Z UTC → 10:30 Cuba time (UTC-4 during DST).
    // AA|1234|HAV|MAD|2026-05-01T10:30
    expect(key).toBe('AA|1234|HAV|MAD|2026-05-01T10:30');
  });

  it('Debe usar fallbacks (NAIR, NFN) si faltan datos', () => {
    const emptyFlight = {} as unknown as Flight;
    const key = flightDedupeKey(emptyFlight);

    expect(key).toBe('NAIR|NFN|NORIG|NDEST|');
  });

  it('Dos itinerarios del mismo vuelo con diferente precio deben tener la MISMA llave (fix: evitar duplicados)', () => {
    // FIX: price removed from key — same flight with different pricing options
    // must be collapsed into a single entry (keeping the best price via sort).
    const base = {
      airline: { iata_code: 'CM' },
      flight_number: 'CM201',
      origin_iata: 'PTY',
      destination_iata: 'HAV',
      departure_datetime: '2026-06-10T08:00:00.000Z',
    };
    const cheap = { ...base, final_price: 180 } as unknown as Flight;
    const pricier = { ...base, final_price: 220 } as unknown as Flight;

    expect(flightDedupeKey(cheap)).toBe(flightDedupeKey(pricier));
  });

  it('Vuelos con distinta hora de salida deben tener llaves distintas', () => {
    const base = {
      airline: { iata_code: 'IB' },
      flight_number: 'IB6847',
      origin_iata: 'MAD',
      destination_iata: 'HAV',
    };
    const morning = { ...base, departure_datetime: '2026-07-01T08:00:00.000Z' } as unknown as Flight;
    const evening = { ...base, departure_datetime: '2026-07-01T20:00:00.000Z' } as unknown as Flight;

    expect(flightDedupeKey(morning)).not.toBe(flightDedupeKey(evening));
  });
});