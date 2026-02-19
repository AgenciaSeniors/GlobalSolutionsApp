// src/app/api/flights/search/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, makeCacheKey } from './route';

// 1. Mock de la base de datos (Supabase Admin)
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }), // Fuerza "Cache Miss" y "Rate Limit OK"
  })
}));

// 2. Mock del orquestador (Simula SkyScrapper/Agency)
vi.mock('@/lib/flights/orchestrator/flightsOrchestrator', () => ({
  flightsOrchestrator: {
    id: 'agency-first-orchestrator',
    search: vi.fn().mockResolvedValue([
      {
        legIndex: 0,
        flights: [{ id: 'mock-flight-1', provider: 'sky-scrapper', price: 500 }]
      }
    ])
  }
}));

describe('POST /api/flights/search', () => {
  
  describe('Unit: makeCacheKey', () => {
    it('Debe generar la llave de caché básica correctamente', () => {
      const body = {
        legs: [{ origin: 'HAV', destination: 'MAD', departure_date: '2026-05-01' }],
        passengers: 2
      };
      const key = makeCacheKey(body);
      expect(key).toBe('flights:HAV-MAD-2026-05-01:p2');
    });

    it('Debe incluir filtros en la llave si se proveen', () => {
      const body = {
        legs: [{ origin: 'HAV', destination: 'MAD', departure_date: '2026-05-01' }],
        passengers: 1,
        filters: { maxStops: 0, minPrice: 100 }
      };
      const key = makeCacheKey(body);
      expect(key).toContain('min=100');
      expect(key).toContain('stops=0');
    });
  });

  describe('Integration: API Route', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('Debe retornar error 400 si los parámetros son inválidos', async () => {
      const req = new Request('http://localhost:3000/api/flights/search', {
        method: 'POST',
        body: JSON.stringify({ legs: [] }) // Request inválido (sin piernas)
      });

      const res = await POST(req);
      const data = await res.json() as { error: string };

      expect(res.status).toBe(400);
     expect(data.error).toContain('IATA inválido');
    });

    it('Debe procesar la búsqueda exitosamente y mockear SkyScrapper (Orchestrator)', async () => {
      const req = new Request('http://localhost:3000/api/flights/search', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '127.0.0.1', // Para simular rate limit IP
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          legs: [{ origin: 'HAV', destination: 'MAD', departure_date: '2026-05-01' }],
          passengers: 1
        })
      });

      const res = await POST(req);
      const data = await res.json() as { source: string; providersUsed: string[]; results: unknown[] };

      expect(res.status).toBe(200);
      expect(data.source).toBe('live'); // Indica que no usó caché
      expect(data.providersUsed).toContain('sky-scrapper'); // Verifica que detectó el proveedor mockeado
      expect(data.results).toHaveLength(1);
    });
  });
});