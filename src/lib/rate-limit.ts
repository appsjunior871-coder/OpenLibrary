/**
 * In-memory sliding-window rate limiter.
 * Suitable for a single server instance (MVP). For multi-instance deployments,
 * replace the store with Redis while keeping the same `checkRateLimit` contract.
 */
type Bucket = number[]; // timestamps (ms)

const store = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    const kept = bucket.filter((t) => now - t < windowMs);
    if (kept.length === 0) store.delete(key);
    else store.set(key, kept);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);
  const bucket = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (bucket.length >= limit) {
    const oldest = bucket[0];
    store.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  bucket.push(now);
  store.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.length, retryAfterSeconds: 0 };
}

/** Test helper. */
export function resetRateLimits() {
  store.clear();
}
