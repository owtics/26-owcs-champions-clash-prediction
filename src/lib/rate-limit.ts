/**
 * In-memory sliding-window rate limiter.
 *
 * NOTE: Each serverless function instance maintains its own counter, so this
 * is "best-effort" rather than globally exact. For strict enforcement use an
 * external store (Redis/Upstash). For this app's traffic level this is fine.
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

/** Occasionally prune expired entries to avoid unbounded memory growth. */
function prune() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * Check and increment a rate limit counter.
 * Returns `{ allowed: true }` or `{ allowed: false, retryAfter: seconds }`.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();

  // Prune ~1% of calls to keep the map from growing forever.
  if (Math.random() < 0.01) prune();

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { allowed: true };
}
