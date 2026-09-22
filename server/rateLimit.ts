/* Instance-local rate limiting — fixed-window counters per key.
   Same caveat as cache.ts/paymentStore.ts: not shared across serverless
   instances, so this throttles per-instance traffic, not globally. */

import { ApiError } from './errors';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Keeps the map from growing unbounded across a long-lived instance. */
function sweep(now: number): void {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Throws 429 once `key` exceeds `limit` hits inside `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    throw new ApiError('มีการร้องขอถี่เกินไป กรุณาลองใหม่อีกครั้งในภายหลัง', 429);
  }
}

/** Best-effort client identity from proxy headers; shared bucket when absent. */
export function clientKey(request: Request | undefined, scope: string): string {
  const ip =
    request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request?.headers.get('x-real-ip') ||
    'unknown';
  return `${scope}:${ip}`;
}
