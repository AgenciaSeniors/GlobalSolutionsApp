/**
 * @fileoverview Restricted jurisdictions — blocked per US OFAC sanctions
 * and Stripe's prohibited businesses policy.
 *
 * Covers: Cuba, Iran, North Korea, Syria, and Crimea (occupied territory).
 *
 * This is the SINGLE SOURCE OF TRUTH for all restriction checks.
 * All layers (autocomplete, schema validation, search API) import from here.
 */

/* ─────────────────────────────────────────────
 * Restricted country ISO 3166-1 alpha-3 codes
 * ───────────────────────────────────────────── */

export const RESTRICTED_COUNTRY_CODES = new Set<string>([
  'CUB', // Cuba
  'IRN', // Iran
  'PRK', // North Korea (Democratic People's Republic of Korea)
  'SYR', // Syria
  // Note: Crimea airports are under Ukraine (UKR) ISO code but listed
  // individually below by IATA since the country code would block all of Ukraine.
]);

/* ─────────────────────────────────────────────
 * Restricted airport IATA codes
 * Includes all known airports in restricted jurisdictions + Crimea
 * ───────────────────────────────────────────── */

export const RESTRICTED_IATA_CODES = new Set<string>([
  // ── Cuba ──
  'HAV', // La Habana - José Martí International
  'VRA', // Varadero - Juan Gualberto Gómez
  'CCC', // Cayo Coco - Jardines del Rey
  'SCU', // Santiago de Cuba - Antonio Maceo
  'HOG', // Holguín - Frank País
  'CMW', // Camagüey - Ignacio Agramonte
  'CFG', // Cienfuegos - Jaime González
  'SNU', // Santa Clara - Abel Santamaría
  'BCA', // Baracoa - Gustavo Rizo
  'GAO', // Guantánamo - Mariana Grajales
  'MZO', // Manzanillo - Sierra Maestra
  'SNJ', // San Julián

  // ── Iran ──
  'IKA', // Tehran - Imam Khomeini International
  'THR', // Tehran - Mehrabad International
  'MHD', // Mashhad - Shahid Hashemi Nejad
  'SYZ', // Shiraz - Shahid Dastgheib
  'IFN', // Isfahan - Isfahan International
  'TBZ', // Tabriz - Tabriz International
  'AWZ', // Ahvaz - Ahvaz International
  'KSH', // Kermanshah - Shahid Ashrafi Esfahani
  'OMH', // Urmia - Urmia Airport
  'BND', // Bandar Abbas - Bandar Abbas International
  'KER', // Kerman - Kerman Airport
  'ZBR', // Zahedan - Zahedan International
  'GBT', // Gorgan - Gorgan Airport
  'RAS', // Rasht - Sardar Jangal
  'KHD', // Khorramabad - Khorramabad Airport
  'AJK', // Araک - Arak Airport
  'SDG', // Sanandaj - Sanandaj Airport

  // ── North Korea ──
  'FNJ', // Pyongyang - Sunan International
  'WOS', // Wonsan - Kalma Airport

  // ── Syria ──
  'DAM', // Damascus - Damascus International
  'ALP', // Aleppo - Aleppo International (currently closed)
  'LTK', // Latakia - Bassel Al-Assad International
  'DEZ', // Deir ez-Zor - Deir ez-Zor Airport
  'KAC', // Kamishly - Kamishly Airport

  // ── Crimea (Ukraine - occupied territory) ──
  'SIP', // Simferopol - Simferopol International (currently closed)
]);

/* ─────────────────────────────────────────────
 * Keywords to block in autocomplete text queries
 * (Spanish + English, accent-insensitive)
 * ───────────────────────────────────────────── */

export const RESTRICTED_KEYWORDS = [
  // Cuba
  'cuba', 'cubano', 'cubana', 'habana', 'havana', 'varadero',
  'holguin', 'holguín', 'camaguey', 'camagüey', 'cienfuegos',
  'santiago de cuba', 'cayo coco',
  // Iran
  'iran', 'irán', 'irani', 'iraní', 'tehran', 'teheran', 'teherán',
  'mashhad', 'shiraz', 'isfahan', 'tabriz',
  // North Korea
  'corea del norte', 'north korea', 'corea norte', 'pyongyang',
  // Syria
  'siria', 'syria', 'sirio', 'damasco', 'damascus', 'aleppo',
  'alepo', 'latakia', 'lataquía',
  // Crimea
  'crimea', 'crimeia', 'simferopol',
];

/* ─────────────────────────────────────────────
 * Helper functions
 * ───────────────────────────────────────────── */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Returns true if an IATA code belongs to a restricted airport.
 */
export function isRestrictedIATA(iata: string): boolean {
  return RESTRICTED_IATA_CODES.has(iata.toUpperCase());
}

/**
 * Returns true if a country ISO 3-letter code is restricted.
 */
export function isRestrictedCountry(countryCode: string): boolean {
  return RESTRICTED_COUNTRY_CODES.has(countryCode.toUpperCase());
}

/**
 * Returns true if an airport should be blocked.
 * Checks both IATA code and country ISO code.
 */
export function isRestrictedAirport(iata: string, countryCode?: string): boolean {
  if (RESTRICTED_IATA_CODES.has(iata.toUpperCase())) return true;
  if (countryCode && RESTRICTED_COUNTRY_CODES.has(countryCode.toUpperCase())) return true;
  return false;
}

/**
 * Returns true if a free-text query references a restricted jurisdiction.
 * Used to block autocomplete queries before hitting the DB or external API.
 */
export function isRestrictedQuery(query: string): boolean {
  const q = normalize(query);
  return RESTRICTED_KEYWORDS.some((kw) => q.includes(normalize(kw)));
}
