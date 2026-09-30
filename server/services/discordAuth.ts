/* Discord OAuth2 — login redirect and code exchange */

import { config } from '@/server/config';

/**
 * Must match a redirect registered in the Discord Developer Portal
 * character for character. A trailing slash on APP_URL would otherwise
 * produce a double slash here and Discord would reject every login.
 */
function redirectUri(): string {
  return `${config.APP_URL.replace(/\/+$/, '')}/auth/discord/callback`;
}

/** Where to send the browser back to after auth, keyed by the state param.

    `profile:<name>` is the one form that carries a payload: the officer whose
    page the login started from, already percent-encoded by the caller. It is
    checked against the characters encodeURIComponent can produce and dropped
    if it holds anything else, so the state can only ever fill a query value —
    never steer the path or append parameters of its own. */
export function fallbackPage(state: string | null): string {
  if (state === 'medical') return '/medical';
  if (state === 'admin') return '/proctor';
  if (state === 'roster') return '/rostermanage';
  if (state === 'home') return '/';
  if (state === 'police') return '/police';
  if (state === 'regulation') return '/regulation';

  if (state?.startsWith('profile:')) {
    const name = state.slice('profile:'.length);
    return /^[A-Za-z0-9\-_.!~*'()%]+$/.test(name) ? `/profile?name=${name}` : '/profile';
  }

  return '/register';
}

/** Adds the callback's own params to a page that may already carry some. */
export function pageWithParams(page: string, params: string): string {
  return `${page}${page.includes('?') ? '&' : '?'}${params}`;
}

export function authUrl(state: string): string {
  if (!config.DISCORD_CLIENT_ID || !config.DISCORD_CLIENT_SECRET) {
    throw new Error('Discord OAuth is not configured');
  }

  const params = new URLSearchParams({
    client_id: config.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'identify',
    prompt: 'consent',
  });

  if (state) params.set('state', state);

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      client_secret: config.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
    }),
    signal: AbortSignal.timeout(config.REQUEST_TIMEOUT),
  });

  const json = (await res.json().catch(() => null)) as {
    access_token?: string;
    error_description?: string;
  } | null;

  if (!json?.access_token) {
    throw new Error(json?.error_description || 'Failed to get access token');
  }
  return json.access_token;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  displayName: string;
}

export async function getUserInfo(accessToken: string): Promise<DiscordUser> {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(config.REQUEST_TIMEOUT),
  });

  const json = (await res.json().catch(() => null)) as {
    id?: string;
    username?: string;
    discriminator?: string;
    avatar?: string;
    global_name?: string;
  } | null;

  if (!json?.id) throw new Error('Failed to get user info');

  return {
    id: json.id,
    username: json.username ?? '',
    discriminator: json.discriminator ?? '0',
    avatar: json.avatar ?? '',
    displayName: json.global_name || json.username || '',
  };
}
