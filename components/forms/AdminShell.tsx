'use client';

/* eslint-disable @next/next/no-img-element */

/* Pieces shared by the two admin consoles (public/proctor.html and
   public/rostermanage.html). Their markup is identical; only the page
   stylesheet and the PIN's destination differ. */

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import type { DiscordAuthState } from '@/lib/client/useDiscordAuth';
import { DiscordIcon } from './Field';

export type ToastKind = 'success' | 'error';

export interface ToastState {
  message: string;
  kind: ToastKind;
}

/** Top-right toast, auto-hidden after 3s — v2's `toast()`. */
export function PageToast({ toast }: { toast: ToastState | null }) {
  return (
    <div
      id="toast"
      className={`toast${toast ? ` ${toast.kind}` : ''}`}
      style={{ display: toast ? 'block' : 'none' }}
      role="status"
      aria-live="polite"
    >
      {toast?.message}
    </div>
  );
}

export function useToastState(): [ToastState | null, (message: string, kind?: ToastKind) => void] {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    setToast({ message, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  return [toast, show];
}

/** Rolling debug log, newest first — v2's `log()`. */
export function useDebugLog(): [string, (message: string) => void] {
  const [lines, setLines] = useState<string[]>([]);

  const log = useCallback((message: string) => {
    const at = new Date().toLocaleTimeString();
    setLines((prev) => [`[${at}] ${message}`, ...prev]);
  }, []);

  return [lines.length === 0 ? 'ยังไม่มี log' : lines.join('\n'), log];
}

export function DebugLog({ text }: { text: string }) {
  return (
    <div className="log-section">
      <details>
        <summary>📋 Log การทำงาน (Debug)</summary>
        <pre>{text}</pre>
      </details>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * Two-step gate: connect Discord, then enter the PIN. The PIN field stays
 * disabled until Discord is connected, which is what makes every approval
 * attributable to a named proctor.
 */
export function AdminLoginBox({
  auth,
  pin,
  onPinChange,
  onSubmit,
  busy,
}: {
  auth: DiscordAuthState;
  pin: string;
  onPinChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const connected = auth.user !== null;

  return (
    <div className="login-box">
      <div className="dc-section">
        <span className="dc-section-label">🔗 ขั้นตอนที่ 1: เชื่อมต่อ Discord</span>

        {!connected && (
          <Link
            href={auth.loginUrl}
            className="btn-discord"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <DiscordIcon size={20} />
            เชื่อมต่อ Discord
          </Link>
        )}

        {connected && (
          <div>
            <div className="dc-user">
              <img className="dc-avatar" src={auth.avatarUrl ?? ''} alt="" />
              <div className="dc-info">
                <span className="dc-name">@{auth.user!.name}</span>
                <span className="dc-id">ID: {auth.user!.userId}</span>
              </div>
              <button
                type="button"
                className="dc-disconnect"
                title="ยกเลิกการเชื่อมต่อ"
                onClick={auth.disconnect}
              >
                <CloseIcon />
              </button>
            </div>
            <div style={{ marginTop: 10, color: '#22c55e', fontSize: 13 }}>
              ✅ เชื่อมต่อ Discord สำเร็จ
            </div>
          </div>
        )}
      </div>

      <span className="dc-section-label">🔒 ขั้นตอนที่ 2: กรุณาใส่ PIN</span>
      <input
        type="password"
        value={pin}
        placeholder="Admin PIN"
        disabled={!connected}
        aria-label="Admin PIN"
        onChange={(e) => onPinChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
        }}
      />
      <button
        type="button"
        className="btn-primary"
        style={{ width: '100%' }}
        disabled={!connected || busy}
        onClick={onSubmit}
      >
        {busy ? 'กำลังเข้าสู่ระบบ' : 'เข้าสู่ระบบ'}
      </button>
    </div>
  );
}
