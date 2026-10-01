'use client';

import { treaty } from '@elysiajs/eden';
import type { Api } from '@/server/app';

/**
 * Typed API client generated from the Elysia server type.
 *
 * Route paths, params and response shapes are inferred from `server/app.ts`,
 * so renaming or changing a route surfaces as a type error here rather than a
 * runtime 404. Only the type crosses the boundary — no server code is bundled.
 */
function baseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.APP_URL || 'http://localhost:3000';
}

/**
 * `parseDate: false` is not optional here.
 *
 * Eden walks every string in a response and silently replaces the ones that
 * look like dates with `Date` objects. Rendering one is React error #31
 * ("Objects are not valid as a React child"), which in a client component
 * takes the whole page down to Next's generic "Application error".
 *
 * It bit the log viewer, and the way it bit is the reason this is switched off
 * rather than worked around at the call site: its pattern accepts hours 1–12
 * only, so `2026-10-02 04:43:29` became a Date while `2026-10-02 13:43:29`
 * stayed a string. The same column, the same page, broken or not depending on
 * the time of day the row was written.
 *
 * Everything this API returns comes from a spreadsheet as text, and nothing
 * here asks for a `Date` back — so the conversion was never wanted.
 */
export const client = treaty<Api>(baseUrl(), { parseDate: false });

/** Eden returns { data, error }; this collapses it to a value-or-throw. */
export async function unwrap<T>(
  promise: Promise<{ data: T | null; error: { value: unknown } | null }>
): Promise<T> {
  const { data, error } = await promise;

  if (error) {
    const value = error.value;
    const message =
      typeof value === 'object' && value !== null && 'error' in value
        ? String((value as { error: unknown }).error)
        : 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
    throw new Error(message);
  }

  return data as T;
}
