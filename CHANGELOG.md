# Fase 1 — Correcciones Completas

## Resumen

8 archivos corregidos → Fase 1 al **100%** de implementación.

---

## 🔴 Bug Crítico Corregido

### `makeRouteKeys` — función faltante (rompía cache + invalidación)

**Archivo:** `src/app/api/flights/search/[sessionId]/route.ts`

La función `makeRouteKeys(session.request)` se llamaba en línea 202 pero **nunca existió**.
Esto causaba un `ReferenceError` en runtime que:

1. Impedía escribir resultados al cache correctamente
2. Dejaba `route_keys = '{}'`, haciendo que el trigger de invalidación fuera inerte
3. Silenciosamente fallaba — parecía funcionar pero el cache nunca se actualizaba

**Fix:** Función añadida que genera keys como `["MAD-BCN-2025-06-15"]` desde los legs del request.
También añadida en `search/route.ts` para consistencia.

---

## Archivos Modificados

### 1. `src/app/api/flights/search/[sessionId]/route.ts` ← **CRÍTICO**
- ✅ `makeRouteKeys()` function added
- ✅ Cache write now logs errors (antes fallaba silenciosamente)
- ✅ Session expiry uses Date comparison (no string compare)
- ✅ `Cache-Control: no-store` consistente en estados no-complete
- ✅ Refactored response builder (`buildPayload`)

### 2. `src/app/api/flights/search/route.ts`
- ✅ HMAC secret **ya no usa** `SUPABASE_SERVICE_ROLE_KEY` como fallback (C0.3)
- ✅ Fallback seguro: hash con salt estático cuando no hay HMAC secret
- ✅ Warning en dev cuando falta `RATE_LIMIT_HMAC_SECRET`
- ✅ `makeRouteKeys()` añadida para consistencia (no se usa aquí, pero disponible)
- ✅ Validación: origen ≠ destino, máximo 6 tramos
- ✅ Rate limit constants extraídas

### 3. `src/app/api/flights/route.ts` ← **Deprecación**
- ✅ Elimina bug de `createClient()` duplicado
- ✅ Añade headers `Deprecation`, `Sunset`, `Link` (RFC 8594)
- ✅ Funciona para backward compat pero señala migración al flujo nuevo

### 4. `src/lib/flights/providers/skyScrapperProvider.ts`
- ✅ Backoff ajustado a spec de auditoría: `[1500, 3000, 6000]` ms (era [1000,2000,4000])
- ✅ Deduplicación in-flight para resolución de places (evita llamadas duplicadas)
- ✅ Logging mejorado con tiempos en cada etapa

### 5. `src/lib/flights/providers/skyScrapper.client.ts`
- ✅ Response size guard (5MB max, previene OOM)
- ✅ Mejor mensaje de timeout con endpoint context

### 6. `src/lib/flights/orchestrator/flightsOrchestrator.ts`
- ✅ Logging mejorado con timing breakdown (agency vs external)
- ✅ Código más limpio (mismo comportamiento)

### 7. `src/lib/flights/orchestrator/providerCircuitBreaker.ts`
- ✅ Reset proactivo del circuito cuando expira (no espera al siguiente fallo)
- ✅ Limpieza periódica de registros stale (sessions, cache, rate limits)
- ✅ Logging de transiciones de estado del breaker
- ✅ Cleanup cada ~1 hora (por proceso, best-effort)

### 8. `src/hooks/useFlightSearch.ts`
- ✅ Soporte multi-leg (`resultsByLeg` + `results` para compat)
- ✅ Metadata expuesta: `source`, `providersUsed`
- ✅ `retry()` function para reintentar la última búsqueda
- ✅ No limpia resultados en error (mantiene stale-cache visible)
- ✅ Polling interval subido a 1.5s (reduce carga en server)

### 9. `src/services/flights.service.ts`
- ✅ Mejor detección de abort errors
- ✅ pollSearchSession retorna stale results en `failed` si existen
- ✅ Polling interval default: 1.5s
- ✅ Sleep con cleanup correcto del listener

---

## Variables de Entorno Requeridas

Agregar a `.env.local`:

```bash
# C1.3: HMAC secret para rate limiting (NUNCA usar service_role key)
# Genera con: openssl rand -hex 32
RATE_LIMIT_HMAC_SECRET=<tu-string-aleatorio-de-64-chars>
```

---

## Migraciones Requeridas

Verificar que estas migraciones estén aplicadas en Supabase (Dashboard → SQL Editor):

1. `006_flight_search_sessions_and_breaker.sql` — sessions, breaker, rate limits tables
2. `007_flight_search_cache_invalidation.sql` — fresh_until, route_keys, trigger

---

## Cómo Aplicar

```bash
# Desde la raíz del proyecto GlobalSolutionsApp-edua:

# 1. Backup
cp -r src/app/api/flights src/app/api/flights.bak
cp -r src/lib/flights src/lib/flights.bak
cp src/hooks/useFlightSearch.ts src/hooks/useFlightSearch.ts.bak
cp src/services/flights.service.ts src/services/flights.service.ts.bak

# 2. Copiar archivos corregidos (desde la carpeta fase1-fix/)
cp fase1-fix/src/app/api/flights/search/route.ts src/app/api/flights/search/route.ts
cp fase1-fix/src/app/api/flights/search/\[sessionId\]/route.ts src/app/api/flights/search/\[sessionId\]/route.ts
cp fase1-fix/src/app/api/flights/route.ts src/app/api/flights/route.ts
cp fase1-fix/src/lib/flights/providers/skyScrapperProvider.ts src/lib/flights/providers/skyScrapperProvider.ts
cp fase1-fix/src/lib/flights/providers/skyScrapper.client.ts src/lib/flights/providers/skyScrapper.client.ts
cp fase1-fix/src/lib/flights/orchestrator/flightsOrchestrator.ts src/lib/flights/orchestrator/flightsOrchestrator.ts
cp fase1-fix/src/lib/flights/orchestrator/providerCircuitBreaker.ts src/lib/flights/orchestrator/providerCircuitBreaker.ts
cp fase1-fix/src/hooks/useFlightSearch.ts src/hooks/useFlightSearch.ts
cp fase1-fix/src/services/flights.service.ts src/services/flights.service.ts

# 3. Agregar RATE_LIMIT_HMAC_SECRET al .env.local
echo "RATE_LIMIT_HMAC_SECRET=$(openssl rand -hex 32)" >> .env.local

# 4. Verificar build
npm run build
```

---

## Checklist de Verificación Post-Deploy

- [ ] `npm run build` compila sin errores
- [ ] Migración 006 aplicada en Supabase
- [ ] Migración 007 aplicada en Supabase
- [ ] `RATE_LIMIT_HMAC_SECRET` configurado en `.env.local` y en Vercel
- [ ] Buscar un vuelo → devuelve resultados (verificar que no hay 500)
- [ ] Segunda búsqueda idéntica → llega más rápido (cache hit)
- [ ] Cambiar `available_seats` en un vuelo → cache se invalida
- [ ] Circuit breaker: si SkyScrapper está caído, la búsqueda devuelve solo agency inventory
- [ ] Rate limit: 6ta búsqueda en 30s → HTTP 429
