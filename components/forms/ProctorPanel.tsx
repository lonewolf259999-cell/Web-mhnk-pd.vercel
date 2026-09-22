'use client';

import { useMemo, useState } from 'react';
import { mutations } from '@/lib/client/queries';
import { useDiscordAuth } from '@/lib/client/useDiscordAuth';
import { readPin, savePin } from '@/lib/client/adminPin';
import { useToast } from '@/components/ui/Toast';
import { DiscordConnect, ErrorList } from './Field';

/* Column headers come from the Pending sheet, so they are Thai strings. */
const COL = {
  timestamp: 'Timestamp',
  discordId: 'Discord ID',
  discordName: 'ชื่อ Discord',
  icName: 'ชื่อ IC',
  phone: 'เบอร์ IC',
  age: 'อายุ OOC',
  steam: 'Steam URL',
  status: 'สถานะ',
} as const;

const PENDING = 'รอตรวจ';
const APPROVED = 'อนุมัติ';
const REJECTED = 'ปฏิเสธ';

type Row = Record<string, string | number> & { _row: number };

/* v2's proctor.html/rostermanage.html are standalone admin tools with their
   own navy/gold palette and Segoe UI font, deliberately separate from the
   main app's teal theme — a visual signal that you're in a privileged tool,
   not the public site. Colors below are hardcoded to match that page exactly
   (they're one-off hex values in v2 too, not design tokens). */
const ADMIN_FONT = { fontFamily: "'Segoe UI', Tahoma, sans-serif" };

const STATUS_STYLE: Record<string, string> = {
  [PENDING]: 'bg-[#f59e0b33] text-[#f59e0b]',
  [APPROVED]: 'bg-[#22c55e33] text-[#22c55e]',
  [REJECTED]: 'bg-[#ef444433] text-[#ef4444]',
};

const inputClass =
  'w-full rounded-lg border border-[#3a3a5a] bg-[#252545] px-4 py-3 text-[15px] text-white outline-none focus:border-[#f0c040] disabled:opacity-35';

export function ProctorPanel() {
  const auth = useDiscordAuth('admin');
  const toast = useToast();

  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function load(withPin: string) {
    setBusy(true);
    setErrors([]);

    try {
      const result = await mutations.listPending(withPin);
      setRows(result.data as Row[]);
      setAuthed(true);
      savePin(withPin);
    } catch (err) {
      setErrors([(err as Error).message]);
      setAuthed(false);
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => {
    const count = (status: string) => rows.filter((r) => r[COL.status] === status).length;
    return {
      total: rows.length,
      pending: count(PENDING),
      approved: count(APPROVED),
      rejected: count(REJECTED),
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();

    return rows.filter((row) => {
      if (statusFilter && row[COL.status] !== statusFilter) return false;
      if (!q) return true;

      return [COL.discordId, COL.discordName, COL.icName, COL.phone].some((key) =>
        String(row[key] ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  async function decide(row: number, approve: boolean) {
    const currentPin = readPin() ?? pin;
    if (!currentPin) return;

    if (approve && !auth.user) {
      toast('กรุณาเชื่อมต่อ Discord (Proctor) ก่อนอนุมัติ', 'error');
      return;
    }

    setBusy(true);
    try {
      const result = approve
        ? await mutations.approvePending(row, {
            pin: currentPin,
            proctorDiscordId: auth.user!.userId,
            proctorDiscordName: auth.user!.name,
          })
        : await mutations.rejectPending(row, currentPin);

      toast(result.message, 'success');
      await load(currentPin);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-[#e0e0e0]" style={ADMIN_FONT}>
        <div className="mx-auto max-w-[420px] px-4 py-10">
          <h1 className="mb-2.5 text-center text-[28px] font-bold text-[#f0c040]">
            ⚙️ Admin Panel
          </h1>
          <p className="mb-8 text-center text-[#888]">ตรวจใบสมัคร</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load(pin);
            }}
            className="rounded-xl border border-[#2a2a4a] bg-[#1a1a2e] p-6"
          >
            <div className="mb-4">
              <DiscordConnect auth={auth} />
            </div>

            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Admin PIN"
              disabled={!auth.user}
              className={`${inputClass} mb-4`}
            />

            <ErrorList errors={errors} />

            <button
              type="submit"
              disabled={!auth.user || !pin || busy}
              className="mt-2 w-full cursor-pointer rounded-lg bg-[#f0c040] py-3 text-[15px] font-semibold text-[#1a1a2e] transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-[#e0e0e0]" style={ADMIN_FONT}>
      <div className="mx-auto max-w-[1200px] px-5 py-5">
        <h1 className="mb-2.5 text-center text-[28px] font-bold text-[#f0c040]">
          ⚙️ Admin Panel
        </h1>
        <p className="mb-6 text-center text-[#888]">ตรวจใบสมัคร</p>

        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => void load(readPin() ?? pin)}
            disabled={busy}
            className="cursor-pointer rounded-lg bg-[#3a3a5a] px-4 py-2 text-sm font-semibold text-[#e0e0e0] transition hover:opacity-85 disabled:opacity-50"
          >
            🔄 โหลดใหม่
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-4">
          <Stat label="ทั้งหมด" value={stats.total} />
          <Stat label="รอตรวจ" value={stats.pending} />
          <Stat label="อนุมัติแล้ว" value={stats.approved} />
          <Stat label="ปฏิเสธ" value={stats.rejected} />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 ค้นหา Discord ID, ชื่อ..."
            className={`${inputClass} min-w-[200px] flex-1`}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="กรองตามสถานะ"
            className="cursor-pointer rounded-lg border border-[#3a3a5a] bg-[#252545] px-2.5 py-2.5 text-sm text-white outline-none"
          >
            <option value="">ทุกสถานะ</option>
            <option value={PENDING}>{PENDING}</option>
            <option value={APPROVED}>{APPROVED}</option>
            <option value={REJECTED}>{REJECTED}</option>
          </select>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-lg border border-[#2a2a4a] bg-[#1a1a2e] p-10 text-center text-[#666]">
            ไม่มีข้อมูล
          </div>
        ) : (
          <div className="max-h-[600px] overflow-auto rounded-lg border border-[#2a2a4a]">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="sticky top-0 bg-[#252545] text-left text-[11px] tracking-wide text-[#aaa] uppercase">
                  {['เวลา', 'Discord', 'ชื่อ IC', 'เบอร์', 'อายุ', 'Steam', 'สถานะ', 'จัดการ'].map(
                    (h) => (
                      <th key={h} className="px-3 py-3 font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {visible.map((row) => {
                  const status = String(row[COL.status] ?? '');
                  const isPending = status === PENDING;

                  return (
                    <tr
                      key={row._row}
                      className="border-b border-[#2a2a4a] transition hover:bg-[#252545]"
                    >
                      <td className="px-3 py-3 text-xs whitespace-nowrap text-[#aaa]">
                        {String(row[COL.timestamp] ?? '')}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-xs text-[#e0e0e0]">
                          {String(row[COL.discordName] ?? '')}
                        </div>
                        <div className="text-[0.65rem] text-[#888]">
                          {String(row[COL.discordId] ?? '')}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-[#e0e0e0]">
                        {String(row[COL.icName] ?? '')}
                      </td>
                      <td className="px-3 py-3 text-xs text-[#aaa]">
                        {String(row[COL.phone] ?? '')}
                      </td>
                      <td className="px-3 py-3 text-xs text-[#aaa]">
                        {String(row[COL.age] ?? '')}
                      </td>
                      <td className="max-w-[10rem] px-3 py-3">
                        {row[COL.steam] ? (
                          <a
                            href={String(row[COL.steam])}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-xs text-[#f0c040] hover:underline"
                          >
                            {String(row[COL.steam])}
                          </a>
                        ) : (
                          <span className="text-xs text-[#666]">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap ${
                            STATUS_STYLE[status] ?? 'bg-[#3a3a5a] text-[#e0e0e0]'
                          }`}
                        >
                          {status || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {isPending ? (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => void decide(row._row, true)}
                              disabled={busy}
                              className="cursor-pointer rounded-lg bg-[#22c55e] px-2.5 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-85 disabled:opacity-40"
                            >
                              อนุมัติ
                            </button>
                            <button
                              type="button"
                              onClick={() => void decide(row._row, false)}
                              disabled={busy}
                              className="cursor-pointer rounded-lg bg-[#ef4444] px-2.5 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-85 disabled:opacity-40"
                            >
                              ปฏิเสธ
                            </button>
                          </div>
                        ) : (
                          <span className="text-[13px] text-[#888]">เสร็จสิ้น</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[150px] flex-1 rounded-[10px] border border-[#2a2a4a] bg-[#1a1a2e] px-6 py-4 text-center">
      <div className="text-[32px] font-bold text-[#f0c040]">{value}</div>
      <div className="mt-1 text-[13px] text-[#888]">{label}</div>
    </div>
  );
}
