'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { mutations } from '@/lib/client/queries';
import { PinField, PIN_LENGTH } from './PinField';

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-lg border border-accent/25 bg-[#1a1a2e] p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

/**
 * Checks a PIN against the server, then hands it to `onSubmit`. The check
 * happens before the prompt closes — otherwise a wrong code looks accepted
 * until the first admin action fails.
 *
 * Returns `null` on success so callers can `await` a shared gate; the hook is
 * only the plumbing, the markup belongs to whoever renders the field.
 */
export function usePinCheck(onSubmit: (pin: string) => void) {
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (candidate: string) => {
      if (!candidate || checking) return;

      setChecking(true);
      setError(null);

      try {
        const result = await mutations.verifyPin(candidate);
        if (!result.valid) {
          setError(result.message);
          setChecking(false);
          setPin(''); // wrong code: clear the slots so the next attempt is typed fresh
          return;
        }
      } catch (err) {
        // Locked out, PIN not configured, or the request never landed.
        setError((err as Error).message);
        setChecking(false);
        setPin('');
        return;
      }

      onSubmit(candidate);
    },
    [checking, onSubmit]
  );

  const change = useCallback((next: string) => {
    setPin(next);
    setError(null);
  }, []);

  return { pin, change, submit, checking, error };
}

export function PinModal({
  title = 'กรุณาระบุรหัสผ่าน',
  onSubmit,
  onCancel,
  /** Shown instead of a plain cancel when there is nowhere to fall back to. */
  backHref,
}: {
  title?: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
  backHref?: string;
}) {
  const { pin, change, submit, checking, error } = usePinCheck(onSubmit);

  return (
    <Backdrop onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(pin);
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-[#f77f07]">🔐 {title}</h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="ปิด"
            className="cursor-pointer text-xl leading-none text-ink-dim hover:text-ink"
          >
            ×
          </button>
        </div>

        <PinField
          value={pin}
          onChange={change}
          onComplete={(value) => void submit(value)}
          wrong={Boolean(error)}
          label={title}
        />

        {error && (
          <p role="alert" className="mt-3 text-center text-sm font-medium text-danger">
            ❌ {error}
          </p>
        )}

        <div className="mt-4 flex gap-2.5">
          {backHref ? (
            <Link
              href={backHref}
              className="flex-1 rounded-sm bg-white/10 py-2.5 text-center text-sm font-semibold text-ink-dim transition hover:bg-white/15"
            >
              ← กลับหน้าหลัก
            </Link>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 cursor-pointer rounded-sm bg-white/10 py-2.5 text-sm font-semibold text-ink-dim transition hover:bg-white/15"
            >
              ยกเลิก
            </button>
          )}
          <button
            type="submit"
            disabled={pin.length < PIN_LENGTH || checking}
            className="flex-1 cursor-pointer rounded-sm bg-[#f77f07] py-2.5 text-sm font-semibold text-night transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {checking ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
          </button>
        </div>
      </form>
    </Backdrop>
  );
}

export function ConfirmModal({
  count,
  total,
  weeks,
  onConfirm,
  onCancel,
}: {
  count: number;
  total: number;
  weeks: string[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Backdrop onClose={onCancel}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-gold">🔐 ยืนยันการดำเนินการ</h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label="ปิด"
          className="cursor-pointer text-xl leading-none text-ink-dim hover:text-ink"
        >
          ×
        </button>
      </div>

      <div className="mb-4 text-center text-sm text-ink-dim">
        <p>
          ยืนยันการจ่ายเงิน <strong className="text-gold">{count}</strong> รายการ
        </p>
        <p className="mt-2 flex items-center justify-center gap-2">
          <span>จำนวนเงิน</span>
          <strong className="text-lg text-gold">฿ {total.toLocaleString()}</strong>
          <CopyButton value={String(total)} label="คัดลอกจำนวนเงิน" />
        </p>
      </div>

      {weeks.length > 0 && (
        <ul className="mb-5 max-h-48 space-y-2 overflow-y-auto">
          {weeks.map((week) => (
            <li
              key={week}
              className="flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-2.5 py-2"
            >
              <span className="flex-1 truncate text-xs text-gold">{week}</span>
              <CopyButton value={week} label={`คัดลอก ${week}`} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 cursor-pointer rounded-sm bg-white/10 py-2.5 text-sm font-semibold text-ink-dim transition hover:bg-white/15"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 cursor-pointer rounded-sm bg-gold py-2.5 text-sm font-semibold text-night transition hover:brightness-110"
        >
          ยืนยัน
        </button>
      </div>
    </Backdrop>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch {
      /* clipboard blocked — nothing useful to show */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={label}
      aria-label={label}
      className={`cursor-pointer rounded border px-1.5 py-1 text-xs transition ${
        copied
          ? 'border-success bg-success/20 text-success'
          : 'border-current/40 bg-current/10 opacity-80 hover:opacity-100'
      }`}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}
