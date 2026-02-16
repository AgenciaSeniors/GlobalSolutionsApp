type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [k: string]: JsonValue };

export class SkyScrapperClient {
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly host: string;

  constructor() {
    const key = process.env.RAPIDAPI_KEY;
    const host =
      process.env.RAPIDAPI_HOST || "flights-sky.p.rapidapi.com";

    if (!key) {
      throw new Error("Missing RAPIDAPI_KEY env var");
    }

    this.key = key;
    this.host = host;
    this.baseUrl = `https://${host}`;
  }

  private headers(): Record<string, string> {
    return {
      "x-rapidapi-key": this.key,
      "x-rapidapi-host": this.host,
    };
  }

  async get(pathAndQuery: string): Promise<JsonValue> {
    const url = `${this.baseUrl}${pathAndQuery}`;

    console.log("SkyScrapper CALL:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: this.headers(),
    });

    const text = await res.text();

    console.log("SkyScrapper STATUS:", res.status);
    console.log("SkyScrapper BODY:", text.slice(0, 400));

    if (!res.ok) {
      throw new Error(
        `SkyScrapper HTTP ${res.status}`
      );
    }

    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      throw new Error("Invalid JSON response");
    }
  }
}
