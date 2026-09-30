'use client';

/* eslint-disable @next/next/no-img-element */

/* Who this browser is signed in to Discord as, shown in the header badge row
   on every page that is not one of the two application forms — those carry
   their own connect panel and would say it twice.

   The id beside the name is the point of it: it is what the person has to hand
   to whoever keeps the allowlist, and until this existed the only way to see
   it was to be refused by a console. */

import Link from 'next/link';
import { displayFor, type DiscordUser } from '@/lib/client/useDiscordAuth';
import { DiscordIcon } from '@/components/forms/DiscordIcon';

export function DiscordStatus({
  userId,
  user,
  loginUrl,
  onLogout,
}: {
  /** The id the server verified — the authority for who this is. */
  userId: string | null;
  /** Cached display profile. Cosmetic, and used only if it matches `userId`. */
  user: DiscordUser | null;
  loginUrl: string;
  onLogout: () => void;
}) {
  if (!userId) {
    return (
      <Link
        href={loginUrl}
        className="flex items-center gap-1.5 rounded-[6px] border border-[#5865f2]/40 bg-[#5865f2]/15 px-2.5 py-1 text-[0.55rem] font-bold tracking-[0.5px] whitespace-nowrap text-[#aab4ff] transition hover:bg-[#5865f2]/30 hover:text-white"
      >
        <DiscordIcon size={13} />
        เชื่อมต่อ Discord
      </Link>
    );
  }

  const shown = displayFor(userId, user);

  return (
    <div className="flex items-center gap-2 rounded-full border border-accent/20 bg-black/30 py-1 pr-1 pl-1.5">
      <img src={shown.avatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />

      <span className="flex min-w-0 flex-col leading-tight">
        <span className="max-w-[120px] truncate text-[0.62rem] font-bold text-ink">
          {shown.name ? `@${shown.name}` : 'เชื่อมต่อ Discord แล้ว'}
        </span>
        <span className="max-w-[120px] truncate text-[0.55rem] text-ink-dim">{userId}</span>
      </span>

      <button
        type="button"
        onClick={onLogout}
        title="ออกจากระบบ Discord"
        aria-label="ออกจากระบบ Discord"
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-danger/40 bg-danger/15 text-danger transition hover:bg-danger/30 hover:text-white"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
