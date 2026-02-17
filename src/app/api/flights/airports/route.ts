/**
 * GET /api/flights/airports?q=madrid
 *
 * Proxies to SkyScrapper auto-complete endpoint.
 * Returns a normalized list of airports/cities for the search form autocomplete.
 *
 * Response shape:
 * { results: [{ entityId, skyId, type, name, iata, city, country, subtitle }] }
 */
import { NextResponse, type NextRequest } from "next/server";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? "";
const RAPIDAPI_HOST =
  process.env.RAPIDAPI_HOST ?? "flights-sky.p.rapidapi.com";

interface AutocompleteResult {
  entityId: string;
  skyId: string;
  type: "AIRPORT" | "CITY" | "COUNTRY";
  name: string;
  iata: string;
  city: string;
  country: string;
  subtitle: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  if (!RAPIDAPI_KEY) {
    return NextResponse.json(
      { error: "RAPIDAPI_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const url = `https://${RAPIDAPI_HOST}/flights/auto-complete?query=${encodeURIComponent(q)}`;

    const res = await fetch(url, {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(
        `[airports/autocomplete] SkyScrapper ${res.status}`,
        await res.text().catch(() => "")
      );
      return NextResponse.json({ results: [] });
    }

    const json: unknown = await res.json();
    if (!isRecord(json)) return NextResponse.json({ results: [] });

    const dataArr = Array.isArray(json.data) ? json.data : [];
    const results: AutocompleteResult[] = [];

    for (const item of dataArr) {
      if (!isRecord(item)) continue;

      const presentation = isRecord(item.presentation)
        ? item.presentation
        : null;
      const navigation = isRecord(item.navigation) ? item.navigation : null;

      if (!presentation || !navigation) continue;

      const entityId = str(presentation.id);
      const skyId = str(presentation.skyId);
      const title = str(presentation.title);
      const subtitle = str(presentation.subtitle);
      const entityType = str(navigation.entityType);

      // Extract IATA from relevantFlightParams or skyId
      const flightParams = isRecord(navigation.relevantFlightParams)
        ? navigation.relevantFlightParams
        : null;
      const flightSkyId = flightParams ? str(flightParams.skyId) : "";
      const iata = flightSkyId || skyId;

      // Extract city/country from subtitle (format: "City, Country")
      const subtitleParts = subtitle.split(",").map((s) => s.trim());
      const city = subtitleParts[0] ?? "";
      const country = subtitleParts.slice(1).join(", ");

      // Only include airports and cities (not generic places)
      if (
        entityType === "AIRPORT" ||
        entityType === "CITY" ||
        entityType === "COUNTRY"
      ) {
        results.push({
          entityId,
          skyId,
          type: entityType as "AIRPORT" | "CITY" | "COUNTRY",
          name: title,
          iata: iata.toUpperCase(),
          city,
          country,
          subtitle,
        });
      }
    }

    return NextResponse.json(
      { results },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[airports/autocomplete] error:", msg);
    return NextResponse.json({ results: [] });
  }
}