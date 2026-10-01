'use client';

import { useEffect, useState } from 'react';
import { DiscordIcon } from '@/components/forms/DiscordIcon';

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
 * Why an action is not available: sign in, or ask to be added to the list.
 * It replaced the PIN prompt, which could only ask a question and never
 * answer one.
 *
 * Someone already on the list rarely sees this — the ♛ Admin badge switches
 * editing straight on for them, and the Discord status beside it already
 * carries their name, their id and the way out. The `allowed` branch here is
 * what the profile page's payment button falls back to, and the one place the
 * `problem` diagnostic can reach an admin who can act on it.
 *
 * A refused account is shown its Discord id, because that is the one thing it
 * has to hand to whoever keeps the list — never where the list is kept.
 */
export function AdminGateModal({
  checking,
  userId,
  allowed,
  loginUrl,
  failed = false,
  problem = '',
  onLogout,
  onClose,
}: {
  checking: boolean;
  /** The id the server verified, or null when this browser is signed out. */
  userId: string | null;
  allowed: boolean;
  loginUrl: string;
  /** The last Discord round trip came back as a failure. */
  failed?: boolean;
  /** The allowlist could not be trusted. Only ever arrives with `allowed`, so
      it reaches an admin who can go and fix the sheet — and nobody else. */
  problem?: string;
  onLogout: () => void;
  onClose: () => void;
}) {
  const logoutButton = (
    <button
      type="button"
      onClick={onLogout}
      className="w-full cursor-pointer rounded-sm bg-white/10 py-2.5 text-sm font-semibold text-ink-dim transition hover:bg-white/15"
    >
      ออกจากระบบ Discord
    </button>
  );

  const idBox = (
    <div className="flex items-center gap-2 rounded-md border border-accent/20 bg-black/30 px-3 py-2">
      <code className="min-w-0 flex-1 truncate text-xs text-ink">{userId}</code>
      <CopyButton value={userId ?? ''} label="คัดลอก Discord ID" />
    </div>
  );

  return (
    <Backdrop onClose={onClose}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-[#f77f07]">🔐 โหมดผู้ดูแล</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="cursor-pointer text-xl leading-none text-ink-dim hover:text-ink"
        >
          ×
        </button>
      </div>

      {checking ? (
        <p className="py-4 text-center text-sm text-ink-dim">กำลังตรวจสอบสิทธิ์...</p>
      ) : !userId ? (
        <div className="space-y-3 text-sm">
          <p className="text-ink-dim">เชื่อมต่อ Discord เพื่อตรวจสอบสิทธิ์ผู้ดูแล</p>

          {/* Plain anchor: /auth/discord redirects off to discord.com, which
              next/link would try to prefetch cross-origin and fail on. */}
          <a
            href={loginUrl}
            className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#5865f2] py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <DiscordIcon size={18} />
            เชื่อมต่อ Discord
          </a>

          {failed && (
            <p role="alert" className="text-center text-sm font-medium text-danger">
              ❌ เชื่อมต่อ Discord ไม่สำเร็จ กรุณาลองอีกครั้ง
            </p>
          )}
        </div>
      ) : !allowed ? (
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-danger">⛔ บัญชีนี้ยังไม่มีสิทธิ์ผู้ดูแล</p>
          <p className="text-ink-dim">ส่ง Discord ID ด้านล่างให้ผู้ดูแล เพื่อขอสิทธิ์</p>
          {idBox}
          {logoutButton}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-success">✅ เข้าสู่ระบบในฐานะผู้ดูแล</p>
          {idBox}

          {problem && (
            <p className="rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-[0.78rem] leading-relaxed text-gold">
              ⚠️ {problem}
            </p>
          )}

          {logoutButton}
        </div>
      )}
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
