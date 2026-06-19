/**
 * In-memory helpers for the public flight autocomplete endpoint.
 *
 * Why in-memory: the app runs as a single long-lived Node process (pm2 fork),
 * so a process-local cache / rate-limiter is reliable and avoids a DB round-trip
 * on every keystroke. These are NOT suitable for multi-instance/serverless
 * deployments — use the DB-backed pattern (`search_rate_limits`) there instead.
 *
 * Both classes are pure (no `server-only`) so they can be unit-tested directly.
 */

type Clock = () => number;

interface TtlEntry<V> {
  value: V;
  /** Absolute epoch-ms after which the entry is considered stale. */
  expiresAt: number;
}

/**
 * A small TTL cache with a bounded number of entries.
 *
 * Eviction is FIFO: when `maxEntries` is exceeded, the oldest inserted key is
 * dropped. Expired entries are removed lazily on `get`. This is intentionally
 * simple — it only needs to coalesce identical upstream requests, not be an LRU.
 */
export class TtlCache<V> {
  private readonly store = new Map<string, TtlEntry<V>>();

  constructor(
    private readonly maxEntries: number,
    private readonly defaultTtlMs: number = 5 * 60_000,
    private readonly now: Clock = Date.now,
  ) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V, ttlMs?: number): void {
    // Refreshing an existing key should not skew FIFO ordering oddly — delete
    // first so re-insertion moves it to the newest position.
    this.store.delete(key);

    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }

    this.store.set(key, {
      value,
      expiresAt: this.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  /** Current number of (possibly expired) entries. Mainly for tests. */
  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

interface WindowEntry {
  count: number;
  /** Absolute epoch-ms when the current window started. */
  windowStart: number;
}

/**
 * Fixed-window rate limiter keyed by an arbitrary string (e.g. client IP).
 *
 * Each key gets `maxHits` allowed calls per `windowMs`. The window resets the
 * first time a key is seen after its previous window elapsed.
 */
export class SlidingWindowLimiter {
  private readonly windows = new Map<string, WindowEntry>();

  constructor(
    private readonly maxHits: number,
    private readonly windowMs: number,
    private readonly now: Clock = Date.now,
  ) {}

  /**
   * Records a hit for `key` and returns whether it is allowed (within the
   * per-window budget). Returns `false` once the budget is exhausted.
   */
  allow(key: string): boolean {
    const now = this.now();
    const entry = this.windows.get(key);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.windows.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.maxHits) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  clear(): void {
    this.windows.clear();
  }
}
