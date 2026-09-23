'use client';

import { useEffect, useRef, useState } from 'react';
import { mutations } from '@/lib/client/queries';

/** How many digit slots the PIN prompt draws. A shorter PIN simply fills fewer. */
const PIN_SLOTS = 6;

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

export function PinModal({
  title = 'กรุณาระบุรหัสผ่าน',
  onSubmit,
  onCancel,
}: {
  title?: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* The PIN only lives on the server, so the prompt asks before it closes —
     otherwise a wrong code looks accepted until the first admin action. */
  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!pin || checking) return;

    setChecking(true);
    setError(null);

    try {
      const result = await mutations.verifyPin(pin);
      if (!result.valid) {
        setError(result.message);
        setChecking(false);
        inputRef.current?.select();
        return;
      }
    } catch (err) {
      // Locked out, PIN not configured, or the request never landed.
      setError((err as Error).message);
      setChecking(false);
      return;
    }

    onSubmit(pin);
  }

  return (
    <Backdrop onClose={onCancel}>
      <form onSubmit={check}>
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

        {/* The slots are decoration over one real field: a single input keeps
            mobile keyboards, paste and autofill working, and keeps the value
            in one place. Clicking anywhere on the row focuses it. */}
        <div
          className={`pin-slots${error ? ' is-wrong' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          {Array.from({ length: PIN_SLOTS }, (_, i) => {
            const filled = i < pin.length;
            const active = focused && i === Math.min(pin.length, PIN_SLOTS - 1);

            return (
              <div
                key={i}
                aria-hidden
                className={[
                  'pin-slot',
                  filled ? 'is-filled' : '',
                  active && !filled ? 'is-active' : '',
                  error ? 'is-wrong' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {filled ? '•' : active ? <span className="pin-caret" /> : null}
              </div>
            );
          })}
        </div>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          value={pin}
          maxLength={PIN_SLOTS}
          onChange={(e) => {
            setPin(e.target.value.slice(0, PIN_SLOTS));
            setError(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="off"
          aria-label={title}
          /* Off-screen rather than hidden: display:none would make it
             unfocusable and kill typing altogether. */
          className="absolute h-px w-px opacity-0"
        />

        {error && (
          <p role="alert" className="mt-3 text-center text-sm font-medium text-danger">
            ❌ {error}
          </p>
        )}

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-sm bg-white/10 py-2.5 text-sm font-semibold text-ink-dim transition hover:bg-white/15"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!pin || checking}
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
