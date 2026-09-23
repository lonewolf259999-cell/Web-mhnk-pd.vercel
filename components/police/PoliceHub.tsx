'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { PinField, PIN_LENGTH } from '@/components/ui/PinField';
import { usePinCheck } from '@/components/ui/Modal';
import { clearPin, isAdminMode, savePin, verifyStoredPin } from '@/lib/client/adminPin';

/** 'checking' exists so a remembered PIN never flashes the lock screen. */
type Gate = 'checking' | 'locked' | 'open';

interface Entry {
  href: string;
  icon: string;
  title: string;
  description: string;
}

/* Grouped by who the page is for: the first two are the intake forms an
   applicant fills in, the last two are the consoles that act on them. */
const GROUPS: { label: string; entries: Entry[] }[] = [
  {
    label: 'ระบบรับสมัคร',
    entries: [
      {
        href: '/register',
        icon: '📝',
        title: 'สมัครเป็นตำรวจ',
        description: 'แบบฟอร์มสมัครเข้าเป็นเจ้าหน้าที่ตำรวจ MHNK',
      },
      {
        href: '/medical',
        icon: '🚑',
        title: 'สมัครเป็นแพทย์',
        description: 'แบบฟอร์มสมัครเข้าหน่วยแพทย์ MHNK',
      },
    ],
  },
  {
    label: 'ระบบผู้ดูแล',
    entries: [
      {
        href: '/rostermanage',
        icon: '📋',
        title: 'จัดการสถานะสมาชิก',
        description: 'ดูสถานะ / เปลี่ยนสถานะ / ย้ายออกจากระบบ',
      },
      {
        href: '/proctor',
        icon: '⚙️',
        title: 'Admin Panel',
        description: 'ตรวจสอบและอนุมัติใบสมัครของผู้สมัคร',
      },
    ],
  },
];

export function PoliceHub() {
  const [gate, setGate] = useState<Gate>('checking');

  /* A PIN in storage opens the page immediately and is re-checked against the
     server behind it — so arriving from the home page costs no extra wait,
     and a PIN that has since changed still closes the gate. */
  useEffect(() => {
    if (isAdminMode()) setGate('open');
    void verifyStoredPin().then((valid) => setGate(valid ? 'open' : 'locked'));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      {gate === 'open' ? (
        <Hub
          onLock={() => {
            clearPin();
            setGate('locked');
          }}
        />
      ) : (
        <PinGate checking={gate === 'checking'} onUnlock={() => setGate('open')} />
      )}

      <SiteFooter />
    </div>
  );
}

function PinGate({ checking, onUnlock }: { checking: boolean; onUnlock: () => void }) {
  const pinCheck = usePinCheck((pin) => {
    savePin(pin);
    onUnlock();
  });

  if (checking) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex items-center gap-3 text-sm text-ink-dim">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          กำลังตรวจสอบสิทธิ์...
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void pinCheck.submit(pinCheck.pin);
        }}
        className="w-full max-w-sm rounded-[16px] border border-accent/20 bg-[rgba(17,24,39,0.85)] p-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#f77f07]/30 bg-[#f77f07]/10 text-2xl">
          🔐
        </div>

        <h1 className="text-[1.05rem] font-bold text-ink">พื้นที่เฉพาะเจ้าหน้าที่</h1>
        <p className="mt-1.5 mb-6 text-[0.75rem] leading-relaxed text-ink-dim">
          ใส่ PIN {PIN_LENGTH} หลัก เพื่อเข้าศูนย์รวมระบบตำรวจ
        </p>

        <PinField
          value={pinCheck.pin}
          onChange={pinCheck.change}
          onComplete={(value) => void pinCheck.submit(value)}
          wrong={Boolean(pinCheck.error)}
          label="PIN ผู้ดูแล"
        />

        {/* The slot reserves its height so a rejected PIN never nudges the
            buttons down and out from under the cursor. */}
        <p
          role="alert"
          className={`mt-3 min-h-[1.25rem] text-sm font-medium text-danger transition-opacity ${
            pinCheck.error ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {pinCheck.error ? `❌ ${pinCheck.error}` : ''}
        </p>

        <div className="mt-3 flex gap-2.5">
          <Link
            href="/"
            className="flex-1 rounded-sm bg-white/10 py-2.5 text-center text-sm font-semibold text-ink-dim transition hover:bg-white/15"
          >
            ← กลับหน้าหลัก
          </Link>
          <button
            type="submit"
            disabled={pinCheck.pin.length < PIN_LENGTH || pinCheck.checking}
            className="flex-1 cursor-pointer rounded-sm bg-[#f77f07] py-2.5 text-sm font-semibold text-night transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pinCheck.checking ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
          </button>
        </div>
      </form>
    </main>
  );
}

function Hub({ onLock }: { onLock: () => void }) {
  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-semibold text-ink-dim transition hover:bg-accent/10 hover:text-accent"
        >
          <span aria-hidden>←</span> กลับหน้าหลัก
        </Link>

        <button
          type="button"
          onClick={onLock}
          className="cursor-pointer rounded-[6px] border border-[#f77f07]/30 bg-[#f77f07]/10 px-2.5 py-1.5 text-[0.7rem] font-bold tracking-[0.5px] text-[#f77f07] transition hover:bg-[#f77f07]/20"
        >
          🔓 ปลดล็อกแล้ว — กดเพื่อล็อก
        </button>
      </div>

      <div className="mb-7 text-center">
        <h1 className="text-[1.35rem] font-bold text-ink">⚖ ศูนย์รวมระบบตำรวจ</h1>
        <p className="mt-1 text-[0.7rem] tracking-[2px] text-ink-dim uppercase">
          MHNK Police Department — Control Center
        </p>
      </div>

      <div className="flex flex-col gap-7">
        {GROUPS.map((group) => (
          <section key={group.label}>
            <h2 className="mb-3.5 border-b border-accent/12 pb-2 text-[0.8rem] font-bold tracking-[1px] text-accent uppercase">
              {group.label}
            </h2>

            <div className="grid gap-3.5 md:grid-cols-2">
              {group.entries.map((entry) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="group flex items-center gap-4 rounded-[12px] border border-accent/12 bg-[rgba(17,24,39,0.8)] p-4 transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/8 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-accent/15 bg-accent/10 text-2xl">
                    {entry.icon}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.95rem] font-bold text-ink">{entry.title}</span>
                    <span className="mt-0.5 block text-[0.72rem] leading-relaxed text-ink-dim">
                      {entry.description}
                    </span>
                  </span>

                  <span
                    aria-hidden
                    className="shrink-0 text-lg text-ink-dim transition group-hover:translate-x-0.5 group-hover:text-accent"
                  >
                    →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
