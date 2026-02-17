/**
 * SkyScrapperClient — HTTP client for RapidAPI flights-sky provider.
 *
 * v4 — Improvements:
 *  1. Response body size guard (prevents OOM on malformed responses)
 *  2. Better timeout error messages with endpoint context
 *  3. AbortController cleanup guaranteed (no memory leaks)
 */

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [k: string]: JsonValue };

/** Max response size in bytes (5 MB) — prevents OOM on malformed API responses */
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;

export class SkyScrapperClient {
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly host: string;
  private readonly defaultTimeoutMs: number;

  constructor(opts?: { timeoutMs?: number }) {
    const key = process.env.RAPIDAPI_KEY;
    const host =
      process.env.RAPIDAPI_HOST || "flights-sky.p.rapidapi.com";

    if (!key) {
      throw new Error("Missing RAPIDAPI_KEY env var");
    }

    this.key = key;
    this.host = host;
    this.baseUrl = `https://${host}`;
    this.defaultTimeoutMs = opts?.timeoutMs ?? 15_000;
  }

  private headers(): Record<string, string> {
    return {
      "x-rapidapi-key": this.key,
      "x-rapidapi-host": this.host,
    };
  }

  /**
   * GET con timeout vía AbortController.
   * @param pathAndQuery  — ruta + querystring
   * @param overrideTimeoutMs — timeout específico para esta llamada (opcional)
   * @param externalSignal — AbortSignal opcional para abortar desde un nivel superior
   */
  async get(
    pathAndQuery: string,
    overrideTimeoutMs?: number,
    externalSignal?: AbortSignal
  ): Promise<JsonValue> {
    const url = `${this.baseUrl}${pathAndQuery}`;
    const endpoint = url.split("?")[0];
    const timeoutMs = overrideTimeoutMs ?? this.defaultTimeoutMs;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const onAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener("abort", onAbort, { once: true });
    }

    const t0 = Date.now();

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.headers(),
        signal: controller.signal,
      });

      const elapsed = Date.now() - t0;

      // Guard against enormous responses
      const contentLength = res.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
        throw new SkyScrapperHttpError(
          res.status,
          `Response too large: ${contentLength} bytes`
        );
      }

      const text = await res.text();

      if (text.length > MAX_RESPONSE_SIZE) {
        throw new SkyScrapperHttpError(
          res.status,
          `Response body too large: ${text.length} chars`
        );
      }

      if (!res.ok) {
        console.warn(
          `[SkyScrapper] ERROR ${res.status} ${endpoint} (${elapsed}ms)`,
          text.slice(0, 200)
        );
        throw new SkyScrapperHttpError(res.status, text.slice(0, 200));
      }

      console.log(
        `[SkyScrapper] OK ${res.status} ${endpoint} (${elapsed}ms)`
      );

      try {
        return JSON.parse(text) as JsonValue;
      } catch {
        throw new Error("Invalid JSON response from SkyScrapper");
      }
    } catch (err: unknown) {
      const elapsed = Date.now() - t0;

      if (
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        console.warn(
          `[SkyScrapper] TIMEOUT ${endpoint} after ${elapsed}ms (limit: ${timeoutMs}ms)`
        );
        throw new SkyScrapperTimeoutError(timeoutMs, endpoint);
      }

      if (
        err instanceof SkyScrapperHttpError ||
        err instanceof SkyScrapperTimeoutError
      ) {
        throw err;
      }

      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[SkyScrapper] NETWORK ERROR ${endpoint} (${elapsed}ms): ${msg}`
      );
      throw new Error(`SkyScrapper network error: ${msg}`);
    } finally {
      clearTimeout(timer);
      if (externalSignal) {
        try {
          externalSignal.removeEventListener("abort", onAbort);
        } catch {
          // ignore
        }
      }
    }
  }
}

/* -------------------------------------------------- */
/*  Custom error classes                              */
/* -------------------------------------------------- */

export class SkyScrapperTimeoutError extends Error {
  readonly timeoutMs: number;
  readonly endpoint: string;

  constructor(timeoutMs: number, endpoint: string) {
    super(`SkyScrapper timeout after ${timeoutMs}ms on ${endpoint}`);
    this.name = "SkyScrapperTimeoutError";
    this.timeoutMs = timeoutMs;
    this.endpoint = endpoint;
  }
}

export class SkyScrapperHttpError extends Error {
  readonly statusCode: number;
  readonly body: string;

  constructor(statusCode: number, body: string) {
    super(`SkyScrapper HTTP ${statusCode}`);
    this.name = "SkyScrapperHttpError";
    this.statusCode = statusCode;
    this.body = body;
  }
}
