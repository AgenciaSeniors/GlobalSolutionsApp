/**
 * @fileoverview Airport/City autocomplete endpoint.
 * GET /api/flights/autocomplete?query=Cuba
 * Returns matching airports by city, country, name, or IATA code.
 * Supports searching by country name in Spanish (maps to ISO codes).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Map common country names (Spanish) to their ISO 3-letter codes
 * used in the airports table. This allows users to type "Cuba"
 * and find airports with country='CUB'.
 */
const COUNTRY_NAME_TO_ISO: Record<string, string[]> = {
  cuba: ['CUB'],
  'estados unidos': ['USA'],
  'eeuu': ['USA'],
  'ee.uu.': ['USA'],
  usa: ['USA'],
  turquia: ['TUR'],
  'turquía': ['TUR'],
  españa: ['ESP'],
  espana: ['ESP'],
  spain: ['ESP'],
  mexico: ['MEX'],
  'méxico': ['MEX'],
  panama: ['PAN'],
  'panamá': ['PAN'],
  colombia: ['COL'],
  brasil: ['BRA'],
  brazil: ['BRA'],
  canada: ['CAN'],
  'canadá': ['CAN'],
  argentina: ['ARG'],
  peru: ['PER'],
  'perú': ['PER'],
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
  'haití': ['HTI'],
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
  'japón': ['JPN'],
  uruguay: ['URY'],
  paraguay: ['PRY'],
  bolivia: ['BOL'],
  bahamas: ['BHS'],
  aruba: ['ABW'],
  curazao: ['CUW'],
  'curaçao': ['CUW'],
  'san martín': ['SXM'],
  'sint maarten': ['SXM'],
  holanda: ['NLD'],
  'países bajos': ['NLD'],
  suiza: ['CHE'],
  miami: ['USA'],
  'nueva york': ['USA'],
};

function findCountryCodes(query: string): string[] {
  const lower = query.toLowerCase().trim();
  
  // Direct match
  if (COUNTRY_NAME_TO_ISO[lower]) {
    return COUNTRY_NAME_TO_ISO[lower];
  }
  
  // Partial match: check if any key starts with the query or vice versa
  const codes: string[] = [];
  for (const [name, isoCodes] of Object.entries(COUNTRY_NAME_TO_ISO)) {
    if (name.startsWith(lower) || lower.startsWith(name)) {
      codes.push(...isoCodes);
    }
  }
  return [...new Set(codes)];
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query')?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const supabase = await createClient();

    // Build the OR filter for ilike matching on city, name, iata_code
    const filters = [
      `city.ilike.%${query}%`,
      `name.ilike.%${query}%`,
      `iata_code.ilike.%${query}%`,
      `country.ilike.%${query}%`,
    ];

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
      .limit(20);

    if (error) {
      console.error('[autocomplete] Supabase error:', error);
      return NextResponse.json({ error: 'Error buscando aeropuertos' }, { status: 500 });
    }

    // Map country codes back to readable names for display
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

    const results = (data ?? []).map((airport) => {
      const countryName = COUNTRY_CODE_TO_NAME[airport.country] ?? airport.country;
      return {
        code: airport.iata_code,
        name: airport.name,
        city: airport.city,
        country: countryName,
        timezone: airport.timezone,
        label: `${airport.city} (${airport.iata_code}) – ${countryName}`,
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[autocomplete] Unexpected error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}