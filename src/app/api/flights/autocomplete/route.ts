/**
 * @fileoverview Airport/City autocomplete endpoint (Hybrid: DB + External API).
 * GET /api/flights/autocomplete?query=Hav
 *
 * Strategy:
 *   1. Search local `airports` table first (fast, supports 73+ airports).
 *   2. If local results < threshold OR query looks like it needs broader search,
 *      also query the external SkyScrapper API for worldwide coverage.
 *   3. Merge results: local DB results first, then API results (deduped by IATA).
 *   4. Optionally upsert new airports from the API into the DB for future speed.
 *
 * Supports:
 *   - IATA code search: "HAV" → La Habana
 *   - City name search: "Habana" → La Habana (HAV)
 *   - Country name (ES/EN): "Cuba" → all CUB airports, "CUB" → all CUB airports
 *   - Accent-insensitive: "Panama" matches "Panamá"
 *   - Trigram fuzzy: "Miam" → Miami
 *
 * @module api/flights/autocomplete
 * @author Dev B
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* ─────────────────────────────────────────────
 * Constants
 * ───────────────────────────────────────────── */

/** Minimum query length to trigger a search */
const MIN_QUERY_LENGTH = 2;

/** If local results are fewer than this, also query the external API */
const LOCAL_RESULTS_THRESHOLD = 5;

/** Maximum results to return to the client */
const MAX_RESULTS = 20;

/** External API timeout in ms */
const API_TIMEOUT_MS = 5_000;

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? '';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST ?? 'flights-sky.p.rapidapi.com';

/* ─────────────────────────────────────────────
 * Country name ↔ ISO code maps (Spanish + English)
 * ───────────────────────────────────────────── */

const COUNTRY_NAME_TO_ISO: Record<string, string[]> = {
  cuba: ['CUB'],
  'estados unidos': ['USA'],
  eeuu: ['USA'],
  'ee.uu.': ['USA'],
  usa: ['USA'],
  turquia: ['TUR'],
  turquía: ['TUR'],
  españa: ['ESP'],
  espana: ['ESP'],
  spain: ['ESP'],
  mexico: ['MEX'],
  méxico: ['MEX'],
  panama: ['PAN'],
  panamá: ['PAN'],
  colombia: ['COL'],
  brasil: ['BRA'],
  brazil: ['BRA'],
  canada: ['CAN'],
  canadá: ['CAN'],
  argentina: ['ARG'],
  peru: ['PER'],
  perú: ['PER'],
  chile: ['CHL'],
  ecuador: ['ECU'],
  venezuela: ['VEN'],
  'república dominicana': ['DOM'],
  dominicana: ['DOM'],
  'costa rica': ['CRI'],
  honduras: ['HND'],
  guatemala: ['GTM'],
  nicaragua: ['NIC'],
  'el salvador': ['SLV'],
  jamaica: ['JAM'],
  haiti: ['HTI'],
  haití: ['HTI'],
  francia: ['FRA'],
  france: ['FRA'],
  alemania: ['DEU'],
  germany: ['DEU'],
  italia: ['ITA'],
  italy: ['ITA'],
  portugal: ['PRT'],
  'reino unido': ['GBR'],
  inglaterra: ['GBR'],
  england: ['GBR'],
  rusia: ['RUS'],
  china: ['CHN'],
  japon: ['JPN'],
  japón: ['JPN'],
  uruguay: ['URY'],
  paraguay: ['PRY'],
  bolivia: ['BOL'],
  bahamas: ['BHS'],
  aruba: ['ABW'],
  curazao: ['CUW'],
  curaçao: ['CUW'],
  'san martín': ['SXM'],
  'sint maarten': ['SXM'],
  holanda: ['NLD'],
  'países bajos': ['NLD'],
  suiza: ['CHE'],
};

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  CUB: 'Cuba',
  USA: 'EE.UU.',
  TUR: 'Turquía',
  ESP: 'España',
  MEX: 'México',
  PAN: 'Panamá',
  COL: 'Colombia',
  BRA: 'Brasil',
  CAN: 'Canadá',
  ARG: 'Argentina',
  PER: 'Perú',
  CHL: 'Chile',
  ECU: 'Ecuador',
  VEN: 'Venezuela',
  DOM: 'Rep. Dominicana',
  CRI: 'Costa Rica',
  HND: 'Honduras',
  GTM: 'Guatemala',
  NIC: 'Nicaragua',
  SLV: 'El Salvador',
  JAM: 'Jamaica',
  HTI: 'Haití',
  FRA: 'Francia',
  DEU: 'Alemania',
  ITA: 'Italia',
  PRT: 'Portugal',
  GBR: 'Reino Unido',
  RUS: 'Rusia',
  CHN: 'China',
  JPN: 'Japón',
  URY: 'Uruguay',
  PRY: 'Paraguay',
  BOL: 'Bolivia',
  BHS: 'Bahamas',
  ABW: 'Aruba',
  CUW: 'Curazao',
  SXM: 'Sint Maarten',
  NLD: 'Países Bajos',
  CHE: 'Suiza',
};

/* ─────────────────────────────────────────────
 * Result type (same shape the component expects)
 * ───────────────────────────────────────────── */

interface AutocompleteResult {
  code: string;        // IATA code
  name: string;        // Airport name
  city: string;        // City name
  country: string;     // Country display name (e.g. "Cuba")
  countryCode?: string; // ISO 3-letter code (for DB upsert)
  timezone?: string;
  label: string;       // "La Habana (HAV) – Cuba"
  source: 'local' | 'api'; // internal — stripped before response
}

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

/** Strip common Spanish/Portuguese diacritics for accent-insensitive matching */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findCountryCodes(query: string): string[] {
  const lower = query.toLowerCase().trim();
  const lowerStripped = stripAccents(lower);

  // Direct match (with or without accents)
  if (COUNTRY_NAME_TO_ISO[lower]) return COUNTRY_NAME_TO_ISO[lower];
  if (COUNTRY_NAME_TO_ISO[lowerStripped]) return COUNTRY_NAME_TO_ISO[lowerStripped];

  // Partial match: check if any key starts with the query or vice versa
  const codes: string[] = [];
  for (const [name, isoCodes] of Object.entries(COUNTRY_NAME_TO_ISO)) {
    const nameStripped = stripAccents(name);
    if (
      name.startsWith(lower) || lower.startsWith(name) ||
      nameStripped.startsWith(lowerStripped) || lowerStripped.startsWith(nameStripped)
    ) {
      codes.push(...isoCodes);
    }
  }
  return [...new Set(codes)];
}

function countryDisplayName(code: string): string {
  return COUNTRY_CODE_TO_NAME[code] ?? code;
}

function buildLabel(city: string, iata: string, country: string): string {
  return `${city} (${iata}) – ${country}`;
}

/**
 * Type guard for safe access to unknown JSON objects
 */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/* ─────────────────────────────────────────────
 * 1. Local DB search
 * ───────────────────────────────────────────── */

async function searchLocalAirports(query: string): Promise<AutocompleteResult[]> {
  try {
    const supabase = await createClient();

    // Build OR filter for ilike matching on city, name, iata_code, country
    // Also include accent-stripped version so "Panama" matches "Panamá", "Turquia" matches "Turquía", etc.
    const queryStripped = stripAccents(query);
    const terms = [...new Set([query, queryStripped])]; // dedupe if no accents in query

    const filters: string[] = [];
    for (const term of terms) {
      filters.push(
        `city.ilike.%${term}%`,
        `name.ilike.%${term}%`,
        `iata_code.ilike.%${term}%`,
        `country.ilike.%${term}%`,
      );
    }

    // Also check if the query matches a known country name → ISO code
    const mappedCodes = findCountryCodes(query);
    for (const code of mappedCodes) {
      filters.push(`country.eq.${code}`);
    }

    const { data, error } = await supabase
      .from('airports')
      .select('id, iata_code, name, city, country, timezone')
      .or(filters.join(','))
      .order('city', { ascending: true })
      .limit(MAX_RESULTS);

    if (error) {
      console.error('[autocomplete] Supabase error:', error);
      return [];
    }

    return (data ?? []).map((airport) => {
      const countryName = countryDisplayName(airport.country);
      return {
        code: airport.iata_code,
        name: airport.name,
        city: airport.city,
        country: countryName,
        countryCode: airport.country,
        timezone: airport.timezone,
        label: buildLabel(airport.city, airport.iata_code, countryName),
        source: 'local' as const,
      };
    });
  } catch (err) {
    console.error('[autocomplete] Local search error:', err);
    return [];
  }
}

/* ─────────────────────────────────────────────
 * 2. External API search (SkyScrapper)
 * ───────────────────────────────────────────── */

async function searchExternalAPI(query: string): Promise<AutocompleteResult[]> {
  if (!RAPIDAPI_KEY) {
    // API not configured — silently return empty (local-only mode)
    return [];
  }

  try {
    const url = `https://${RAPIDAPI_HOST}/flights/auto-complete?query=${encodeURIComponent(query)}`;

    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[autocomplete] External API returned ${res.status}`);
      return [];
    }

    const json: unknown = await res.json();
    if (!isRecord(json)) return [];

    const dataArr = Array.isArray(json.data) ? json.data : [];
    const results: AutocompleteResult[] = [];

    for (const item of dataArr) {
      if (!isRecord(item)) continue;

      const presentation = isRecord(item.presentation) ? item.presentation : null;
      const navigation = isRecord(item.navigation) ? item.navigation : null;
      if (!presentation || !navigation) continue;

      const entityType = str(navigation.entityType);
      // Only include airports — not generic cities/countries
      if (entityType !== 'AIRPORT') continue;

      const title = str(presentation.title);
      const subtitle = str(presentation.subtitle);
      const skyId = str(presentation.skyId);

      // Extract IATA from relevantFlightParams or skyId
      const flightParams = isRecord(navigation.relevantFlightParams)
        ? navigation.relevantFlightParams
        : null;
      const flightSkyId = flightParams ? str(flightParams.skyId) : '';
      const iata = (flightSkyId || skyId).toUpperCase();

      // Skip if no valid IATA code (must be 2–4 chars)
      if (!iata || iata.length < 2 || iata.length > 4) continue;

      // Extract city/country from subtitle (format: "City, Country")
      const subtitleParts = subtitle.split(',').map((s) => s.trim());
      const city = subtitleParts[0] ?? title;
      const country = subtitleParts.slice(1).join(', ') || '';

      results.push({
        code: iata,
        name: title,
        city,
        country,
        label: buildLabel(city, iata, country),
        source: 'api' as const,
      });
    }

    return results;
  } catch (err) {
    // Timeout or network errors — gracefully degrade
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[autocomplete] External API error:', msg);
    return [];
  }
}

/* ─────────────────────────────────────────────
 * 3. Merge & deduplicate
 * ───────────────────────────────────────────── */

function mergeResults(
  local: AutocompleteResult[],
  api: AutocompleteResult[],
): AutocompleteResult[] {
  const seen = new Set<string>();
  const merged: AutocompleteResult[] = [];

  // Local results take priority (enriched with country names, timezone, etc.)
  for (const r of local) {
    if (!seen.has(r.code)) {
      seen.add(r.code);
      merged.push(r);
    }
  }

  // Add API results that aren't already in local
  for (const r of api) {
    if (!seen.has(r.code)) {
      seen.add(r.code);
      merged.push(r);
    }
  }

  return merged.slice(0, MAX_RESULTS);
}

/* ─────────────────────────────────────────────
 * 4. Background upsert: save new airports from API to local DB
 *    This progressively enriches the local database so that
 *    repeated searches are served entirely from the DB.
 * ───────────────────────────────────────────── */

/**
 * Background upsert: save new airports from API to local DB.
 * Uses a service-role admin client to bypass RLS.
 * If the admin client is not available (missing env var), this is a no-op.
 */
async function upsertAirportsInBackground(apiResults: AutocompleteResult[]): Promise<void> {
  if (apiResults.length === 0) return;

  try {
    // Dynamically import admin client — if SUPABASE_SERVICE_ROLE_KEY is missing,
    // createAdminClient() throws and we silently skip the upsert.
    let adminClient;
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      adminClient = createAdminClient();
    } catch {
      // Service role key not configured — skip upsert silently
      return;
    }

    // Only insert airports with valid 3-char IATA codes
    const rows = apiResults
      .filter((r) => /^[A-Z]{3}$/.test(r.code))
      .map((r) => ({
        iata_code: r.code,
        name: r.name,
        city: r.city,
        country: r.countryCode ?? r.code,
      }));

    if (rows.length === 0) return;

    const { error } = await adminClient
      .from('airports')
      .upsert(rows, {
        onConflict: 'iata_code',
        ignoreDuplicates: true,
      });

    if (error) {
      // Log but don't crash — this is a nice-to-have optimization
      console.warn('[autocomplete] Background upsert skipped:', error.message);
    }
  } catch {
    // Completely non-critical — swallow silently
  }
}

/* ─────────────────────────────────────────────
 * GET handler
 * ───────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query')?.trim();

  if (!query || query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Step 1: Always search local DB first (fast, <50ms)
    const localResults = await searchLocalAirports(query);

    // Step 2: If local results are sparse, also hit the external API.
    // Require at least 3 characters before calling external API — shorter queries
    // always return HTTP 400 from the external provider and waste a round-trip.
    let apiResults: AutocompleteResult[] = [];
    const needsExternalSearch =
      localResults.length < LOCAL_RESULTS_THRESHOLD && query.length >= 3;

    if (needsExternalSearch && RAPIDAPI_KEY) {
      apiResults = await searchExternalAPI(query);
    }

    // Step 3: Merge and deduplicate (local results first)
    const merged = mergeResults(localResults, apiResults);

    // Step 4: Background upsert new airports into local DB (non-blocking)
    if (apiResults.length > 0) {
      const newAirports = apiResults.filter(
        (r) => !localResults.some((l) => l.code === r.code),
      );
      // Fire-and-forget — don't block the response
      void upsertAirportsInBackground(newAirports);
    }

    // Step 5: Build clean response (strip internal fields)
    const results = merged.map(({ code, name, city, country, timezone, label }) => ({
      code,
      name,
      city,
      country,
      timezone: timezone ?? null,
      label,
    }));

    return NextResponse.json(
      { results },
      {
        headers: {
          // Cache: 1 min browser, 5 min CDN
          'Cache-Control': 'public, max-age=60, s-maxage=300',
        },
      },
    );
  } catch (err) {
    console.error('[autocomplete] Unexpected error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
