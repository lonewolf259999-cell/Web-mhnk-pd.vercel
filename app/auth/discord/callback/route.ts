import { NextResponse } from 'next/server';
import { exchangeCode, fallbackPage, getUserInfo } from '@/server/services/discordAuth';
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken } from '@/server/services/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const state = params.get('state');
  const back = fallbackPage(state);

  const code = params.get('code');
  if (params.get('error') || !code) {
    return NextResponse.redirect(new URL(`${back}?auth=failed`, request.url));
  }

  try {
    const user = await getUserInfo(await exchangeCode(code));

    // Legacy usernames carry a #1234 discriminator; modern ones use "0".
    const discordId =
      user.discriminator && user.discriminator !== '0'
        ? `${user.username}#${user.discriminator}`
        : user.username;

    const result = new URLSearchParams({
      discord_id: discordId,
      discord_userId: user.id,
      discord_name: user.displayName,
      discord_avatar: user.avatar,
      auth: 'success',
    });

    const response = NextResponse.redirect(new URL(`${back}?${result.toString()}`, request.url));

    // The query params above are only for what the page displays. Anything the
    // API authorises on is read from this cookie instead, which the browser
    // cannot read or edit — see server/services/session.ts.
    response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), {
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(request.url).protocol === 'https:',
      path: '/',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL(`${back}?auth=failed`, request.url));
  }
}
