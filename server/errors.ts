import { timingSafeEqual } from 'node:crypto';
import { config } from './config';
import { clientKey } from './rateLimit';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number = 500
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Equal-length check first (unavoidable timing leak of length alone),
    then a constant-time byte comparison so a correct prefix can't be
    distinguished from a wrong one by response time. */
function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

const PIN_ATTEMPT_LIMIT = 10;
const PIN_ATTEMPT_WINDOW_MS = 15 * 60_000;
const pinAttempts = new Map<string, { count: number; resetAt: number }>();

/** Drops expired counters once the map gets large, the same guard rateLimit.ts
    uses. A Vercel instance is short-lived enough not to care, but the
    self-hosted target is one long-running Node process: without this, a client
    that guesses once and never returns keeps its entry for the life of the
    process, one per address, for as long as anyone keeps probing. */
function sweepPinAttempts(now: number): void {
  if (pinAttempts.size < 1000) return;
  for (const [key, attempt] of pinAttempts) {
    if (attempt.resetAt <= now) pinAttempts.delete(key);
  }
}

/** Admin PIN check. Rejects everything when no PIN is configured, and locks
    out a client (best-effort, per-instance) after repeated wrong PINs. */
export function requirePin(body: unknown, request?: Request): void {
  const pin = (body as { pin?: unknown } | null)?.pin;
  const key = clientKey(request, 'pin');

  const now = Date.now();
  sweepPinAttempts(now);

  const attempt = pinAttempts.get(key);
  if (attempt && attempt.resetAt > now && attempt.count >= PIN_ATTEMPT_LIMIT) {
    throw new ApiError('ใส่รหัส PIN ผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง', 429);
  }

  let expected: string;
  try {
    expected = config.ADMIN_PIN;
  } catch {
    throw new ApiError('ระบบยังไม่ได้ตั้งค่ารหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ', 500);
  }

  if (!timingSafeEqualString(typeof pin === 'string' ? pin : '', expected)) {
    pinAttempts.set(
      key,
      attempt && attempt.resetAt > now
        ? { count: attempt.count + 1, resetAt: attempt.resetAt }
        : { count: 1, resetAt: now + PIN_ATTEMPT_WINDOW_MS }
    );
    throw new ApiError('รหัส PIN ไม่ถูกต้อง', 401);
  }

  pinAttempts.delete(key);
}
