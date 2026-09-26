'use client';

/* Pieces shared by the two admin consoles (public/proctor.html and
   public/rostermanage.html). Their markup is identical; only the page
   stylesheet differs.

   The login box that used to live here went with ADMIN_PIN: both consoles now
   authorise on a Discord allowlist and share DiscordGate instead. */

import { useCallback, useRef, useState } from 'react';

export type ToastKind = 'success' | 'error';

interface ToastState {
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
