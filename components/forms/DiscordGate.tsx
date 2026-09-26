'use client';

/* eslint-disable @next/next/no-img-element */

/* The login box for a page gated by a Discord id allowlist rather than a PIN.

   Replaced AdminShell's AdminLoginBox, a two-step gate that ended in a PIN
   field. Both admin consoles share this one unchanged: which list a page reads
   is the server's business, and naming the sheet and cell here only told the
   one person who can do nothing with them.

   Styling reuses each page's existing .login-box / .dc-* classes, so the gate
   looks as it did with the PIN step taken out. */

import Link from 'next/link';
import { CopyInline } from '@/components/ui/CopyInline';
import { avatarUrlFor, type DiscordUser } from '@/lib/client/useDiscordAuth';
import { DiscordIcon } from './DiscordIcon';

/* Shown when there is no profile to draw on — a browser that has not been
   through the OAuth redirect, or one with storage blocked. An empty src would
   make the browser re-request the page itself. */
const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

/**
 * The name and avatar to label a session with — but only when the cached
 * profile belongs to the account the server actually verified. The cache is
 * per-browser and survives a change of account, and labelling a session with
 * someone else's name is worse than showing no name at all.
 */
function displayFor(userId: string | null, user: DiscordUser | null) {
  const match = userId && user && user.userId === userId ? user : null;
  return {
    name: match?.name ?? '',
    avatar: avatarUrlFor(match) ?? DEFAULT_AVATAR,
  };
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export interface GateState {
  /** The Discord id the server read from the session cookie, not from the URL:
      null means "not signed in". */
  userId: string | null;
  allowed: boolean;
  /** Set when the allowlist itself could not be trusted, so a misconfigured
      sheet does not read to the user as "you were removed". */
  problem: string;
}

/**
 * Shown above a console once access is granted. The gate itself disappears at
 * that point, which used to leave no way to see which account was signed in —
 * or to leave, on a shared machine.
 */
export function DiscordSessionBar({
  userId,
  user,
  onLogout,
}: {
  /** The id the server verified — the authority for who this is. */
  userId: string;
  /** Cached display profile, used only if it matches that id. */
  user: DiscordUser | null;
  onLogout: () => void;
}) {
  const shown = displayFor(userId, user);

  return (
    <div className="dc-bar">
      <img className="dc-avatar" src={shown.avatar} alt="" />
      <div className="dc-info">
        <span className="dc-name">
          {shown.name ? `@${shown.name}` : 'เชื่อมต่อ Discord แล้ว'}
        </span>
        <span className="dc-id">ID: {userId}</span>
      </div>
      <button type="button" className="btn-secondary btn-sm dc-bar-logout" onClick={onLogout}>
        ออกจากระบบ
      </button>
    </div>
  );
}

export function DiscordGate({
  loginUrl,
  checking,
  gate,
  failed,
  user,
  onLogout,
}: {
  loginUrl: string;
  checking: boolean;
  gate: GateState | null;
  failed: boolean;
  /** Cached display profile. Cosmetic — the id in `gate` is what authorises. */
  user: DiscordUser | null;
  onLogout: () => void;
}) {
  const signedIn = gate?.userId != null;
  const shown = displayFor(gate?.userId ?? null, user);

  return (
    <div className="login-box">
      <div className="dc-section">
        <span className="dc-section-label">🔗 เข้าสู่ระบบด้วย Discord</span>

        {checking && <div style={{ color: '#888', fontSize: 13 }}>กำลังตรวจสอบสิทธิ์…</div>}

        {!checking && !signedIn && (
          <>
            <Link
              href={loginUrl}
              className="btn-discord"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <DiscordIcon size={20} />
              เชื่อมต่อ Discord
            </Link>
            {failed && (
              <div style={{ marginTop: 10, color: '#ef4444', fontSize: 13 }}>
                ❌ เชื่อมต่อ Discord ไม่สำเร็จ กรุณาลองอีกครั้ง
              </div>
            )}
          </>
        )}

        {!checking && signedIn && (
          <div>
            <div className="dc-user">
              <img className="dc-avatar" src={shown.avatar} alt="" />
              <div className="dc-info">
                <span className="dc-name">{shown.name ? `@${shown.name}` : 'บัญชี Discord'}</span>
                <span className="dc-id">ID: {gate!.userId}</span>
              </div>
              <button
                type="button"
                className="dc-disconnect"
                title="ออกจากระบบ"
                onClick={onLogout}
              >
                <CloseIcon />
              </button>
            </div>

            <div style={{ marginTop: 14, textAlign: 'left', fontSize: 13, lineHeight: 1.7 }}>
              <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: 6 }}>
                ⛔ บัญชีนี้ยังไม่มีสิทธิ์ใช้งานหน้านี้
              </div>

              {/* The id is shown either way: whatever went wrong, it is the
                  one thing the person has to hand to whoever edits the sheet. */}
              <div style={{ color: '#888' }}>
                ส่ง Discord ID ด้านล่างให้ผู้ดูแล เพื่อขอ ADMIN
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 10px',
                    background: '#0f0f1a',
                    border: '1px solid #2a2a4a',
                    borderRadius: 6,
                    color: '#e0e0e0',
                    fontFamily: 'monospace',
                  }}
                >
                  {gate!.userId}
                  <CopyInline value={gate!.userId ?? ''} title="คัดลอก Discord ID" />
                </div>
              </div>

              {gate!.problem && (
                <div style={{ marginTop: 10, color: '#f59e0b' }}>⚠️ {gate!.problem}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
