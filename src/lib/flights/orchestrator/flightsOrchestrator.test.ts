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

    // AA|1234|HAV|MAD|2026-05-01T14:30|0
    expect(key).toBe('AA|1234|HAV|MAD|2026-05-01T14:30|0');
  });

  it('Debe usar fallbacks (NAIR, NFN) si faltan datos', () => {
    const emptyFlight = {} as unknown as Flight;
    const key = flightDedupeKey(emptyFlight);

    expect(key).toBe('NAIR|NFN|NORIG|NDEST||0');
  });

  it('Dos itinerarios del mismo vuelo con diferente precio deben tener llaves distintas', () => {
    const base = {
      airline: { iata_code: 'CM' },
      flight_number: 'CM201',
      origin_iata: 'PTY',
      destination_iata: 'HAV',
      departure_datetime: '2026-06-10T08:00:00.000Z',
    };
    const cheap = { ...base, final_price: 180 } as unknown as Flight;
    const pricier = { ...base, final_price: 220 } as unknown as Flight;

    expect(flightDedupeKey(cheap)).not.toBe(flightDedupeKey(pricier));
  });
});