'use client';

/* eslint-disable @next/next/no-img-element */

/* The login box for a page gated by a Discord id allowlist rather than a PIN.

   Replaced AdminShell's AdminLoginBox, a two-step gate that ended in a PIN
   field. Both admin consoles use this now; the cells their lists live in are
   the only thing that differs, which is what `sheetName`/`cellName` carry.

   Styling reuses each page's existing .login-box / .dc-* classes, so the gate
   looks as it did with the PIN step taken out. */

import Link from 'next/link';
import { CopyInline } from '@/components/ui/CopyInline';
import { DiscordIcon } from './DiscordIcon';

/* Shown when the avatar is unknown, which is the normal case after a refresh:
   the hash arrives in the OAuth redirect and only the id survives in the
   cookie. An empty src would make the browser re-request the page itself. */
const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

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

export function DiscordGate({
  loginUrl,
  checking,
  gate,
  failed,
  displayName,
  avatarUrl,
  sheetName,
  cellName,
  onLogout,
}: {
  loginUrl: string;
  checking: boolean;
  gate: GateState | null;
  failed: boolean;
  /** From the OAuth redirect; absent after a refresh, when only the id is
      known. Cosmetic either way — the id is what authorises. */
  displayName: string;
  avatarUrl: string | null;
  /** Where whoever grants access has to paste the id — told to the person
      being refused, so they can pass it on without having to ask. */
  sheetName: string;
  cellName: string;
  onLogout: () => void;
}) {
  const signedIn = gate?.userId != null;

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
              <img className="dc-avatar" src={avatarUrl ?? DEFAULT_AVATAR} alt="" />
              <div className="dc-info">
                <span className="dc-name">{displayName ? `@${displayName}` : 'บัญชี Discord'}</span>
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
                ส่ง Discord ID ด้านล่างให้ผู้ดูแล เพื่อเพิ่มลงในชีต{' '}
                <strong style={{ color: '#aaa' }}>{sheetName}</strong> ช่อง{' '}
                <strong style={{ color: '#aaa' }}>{cellName}</strong>
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
