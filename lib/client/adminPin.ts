'use client';

/* Admin session, remembered for 30 minutes so a batch of actions doesn't
   prompt on every request.

   What is remembered is the important part. This used to hold the admin PIN
   itself in localStorage, which any script on the page could read — and a PIN
   is not a token: it never expires on its own and it opens every admin
   endpoint. Now the PIN is exchanged once for an HttpOnly cookie the server
   signs (usePinCheck already verifies through /pin/verify, which is where the
   cookie is issued — see server/services/session.ts), and localStorage keeps
   only a flag saying a session was opened. There is nothing left in storage
   worth stealing.

   The flag can drift from the cookie — cleared site data, a redeploy, a
   changed ADMIN_PIN. So it is a hint, not the authority: the server decides,
   and a stale flag costs one rejected call that clears it and re-prompts. */

import { mutations } from './queries';

const STORAGE_KEY = 'mhnk_admin_session';
const LEGACY_KEY = 'mhnk_payment_pin';
const TTL_MS = 30 * 60 * 1000;

/* Admin calls still carry a `pin` field, so callers need something to put in
   it. The cookie is what authorises; this placeholder can never equal a real
   PIN, so a request made without the cookie fails cleanly with 401 instead of
   quietly going through. */
const SESSION_PLACEHOLDER = String.fromCharCode(0) + 'admin-session';

interface Stored {
  timestamp: number;
}

function drop(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

function hasMarker(): boolean {
  if (typeof window === 'undefined') return false;

  // A PIN left behind by an older build is a credential sitting in storage.
  drop(LEGACY_KEY);

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const { timestamp } = JSON.parse(raw) as Stored;
    if (Date.now() - timestamp < TTL_MS) return true;

    drop(STORAGE_KEY);
  } catch {
    drop(STORAGE_KEY);
  }
  return false;
}

/** What to put in a request's `pin` field — null when not in admin mode. */
export function readPin(): string | null {
  return hasMarker() ? SESSION_PLACEHOLDER : null;
}

/**
 * Records that an admin session is open.
 *
 * Call only after the PIN has been checked — `usePinCheck` does that, and the
 * server sets the cookie as part of the same call, so there is nothing to
 * send here.
 */
export function openAdminSession(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now() } satisfies Stored));
  } catch {
    /* storage unavailable — admin mode simply won't survive a reload */
  }
}

export function clearPin(): void {
  drop(STORAGE_KEY);
  drop(LEGACY_KEY);
  // Only the server can clear an HttpOnly cookie; if the call never lands the
  // session is left to expire on its own.
  void mutations.adminLogout().catch(() => {});
}

export function isAdminMode(): boolean {
  return hasMarker();
}

/** Confirms the session is still live server-side, so admin mode can't linger
    on a cookie that has expired or a PIN that has since changed. Costs no PIN
    attempt. A request that never landed is not an answer, so the session
    survives it. */
export async function verifyStoredPin(): Promise<boolean> {
  if (!hasMarker()) return false;

  try {
    const { valid } = await mutations.adminSession();
    if (!valid) drop(STORAGE_KEY);
    return valid;
  } catch {
    return true;
  }
}
