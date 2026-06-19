import { describe, it, expect } from 'vitest';
import { TtlCache, SlidingWindowLimiter } from './inMemoryCache';

/** A controllable clock so tests are deterministic (no real timers). */
function makeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('TtlCache', () => {
  it('stores and retrieves a value before it expires', () => {
    const clock = makeClock();
    const cache = new TtlCache<string>(10, 1000, clock.now);

    cache.set('a', 'value');
    expect(cache.get('a')).toBe('value');
  });

  it('returns undefined for unknown keys', () => {
    const cache = new TtlCache<string>(10, 1000);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('expires entries after the default TTL', () => {
    const clock = makeClock();
    const cache = new TtlCache<string>(10, 1000, clock.now);

    cache.set('a', 'value');
    clock.advance(999);
    expect(cache.get('a')).toBe('value'); // still fresh
    clock.advance(1);
    expect(cache.get('a')).toBeUndefined(); // exactly at TTL → expired
  });

  it('honours a per-entry TTL override', () => {
    const clock = makeClock();
    const cache = new TtlCache<string>(10, 60_000, clock.now);

    cache.set('short', 'v', 100);
    clock.advance(150);
    expect(cache.get('short')).toBeUndefined();
  });

  it('evicts the oldest entry when maxEntries is exceeded (FIFO)', () => {
    const cache = new TtlCache<number>(2, 60_000);

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // should evict 'a'

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.size).toBe(2);
  });

  it('clear() empties the cache', () => {
    const cache = new TtlCache<number>(10, 60_000);
    cache.set('a', 1);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});

describe('SlidingWindowLimiter', () => {
  it('allows up to maxHits within a window and blocks the next', () => {
    const clock = makeClock();
    const limiter = new SlidingWindowLimiter(3, 1000, clock.now);

    expect(limiter.allow('ip1')).toBe(true);
    expect(limiter.allow('ip1')).toBe(true);
    expect(limiter.allow('ip1')).toBe(true);
    expect(limiter.allow('ip1')).toBe(false); // 4th over the budget
  });

  it('tracks each key independently', () => {
    const limiter = new SlidingWindowLimiter(1, 1000);

    expect(limiter.allow('ip1')).toBe(true);
    expect(limiter.allow('ip1')).toBe(false);
    expect(limiter.allow('ip2')).toBe(true); // different key, own budget
  });

  it('resets the budget after the window elapses', () => {
    const clock = makeClock();
    const limiter = new SlidingWindowLimiter(2, 1000, clock.now);

    expect(limiter.allow('ip1')).toBe(true);
    expect(limiter.allow('ip1')).toBe(true);
    expect(limiter.allow('ip1')).toBe(false);

    clock.advance(1000); // window elapsed
    expect(limiter.allow('ip1')).toBe(true);
  });
});
