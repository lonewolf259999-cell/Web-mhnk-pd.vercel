import { NextResponse } from 'next/server';
import { authUrl, fallbackPage, pageWithParams } from '@/server/services/discordAuth';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const state = new URL(request.url).searchParams.get('state') ?? '';

  try {
    return NextResponse.redirect(authUrl(state));
  } catch {
    const back = pageWithParams(fallbackPage(state), 'auth=failed&error=discord_not_configured');
    return NextResponse.redirect(new URL(back, request.url));
  }
}
