'use client';

import { useMemo, useState } from 'react';
import { mutations } from '@/lib/client/queries';
import { useDiscordAuth } from '@/lib/client/useDiscordAuth';
import { readPin, savePin } from '@/lib/client/adminPin';
import { useToast } from '@/components/ui/Toast';
import { DiscordConnect, ErrorList } from './Field';
import type { RosterMember } from '@/server/services/roster';

const EXIT_REASONS = ['ออกจาก Discord', 'ถูกปลดออก', 'ติดต่อขอออก', 'เกิน 15 วัน'] as const;

/** Moving a member out is irreversible from the UI, so it is confirmed first. */
interface PendingAction {
  row: number;
  label: string;
  reason: string;
}

/* Same standalone navy/gold admin-tool palette as ProctorPanel — v2's
   rostermanage.html is a self-contained page, not part of the shared teal
   design system. */
const ADMIN_FONT = { fontFamily: "'Segoe UI', Tahoma, sans-serif" };

const inputClass =
  'w-full rounded-lg border border-[#3a3a5a] bg-[#252545] px-4 py-3 text-[15px] text-white outline-none focus:border-[#f0c040] disabled:opacity-35';

export function RosterManagePanel() {
  const auth = useDiscordAuth('roster');
  const toast = useToast();

  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [namePD, setNamePD] = useState<RosterMember[]>([]);
  const [outDC, setOutDC] = useState<RosterMember[]>([]);
  const [tab, setTab] = useState<'namepd' | 'outdc'>('namepd');
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState<PendingAction | null>(null);

  async function load(withPin: string) {
    setBusy(true);
    setErrors([]);

    try {
      const [inSystem, departed] = await Promise.all([
        mutations.namePD(withPin),
        mutations.outDC(withPin),
      ]);
      setNamePD(inSystem.data as RosterMember[]);
      setOutDC(departed.data as RosterMember[]);
      setAuthed(true);
      savePin(withPin);
    } catch (err) {
      setErrors([(err as Error).message]);
      setAuthed(false);
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(
    () => ({
      inSystem: namePD.length,
      departed: outDC.length,
      leftDiscord: outDC.filter((m) => m.status === 'ออกจาก Discord').length,
      fired: outDC.filter((m) => m.status === 'ถูกปลดออก').length,
    }),
    [namePD, outDC]
  );

  const visible = useMemo(() => {
    const source = tab === 'namepd' ? namePD : outDC;
    const q = search.toLowerCase().trim();
    if (!q) return source;

    return source.filter((m) =>
      [m.name, m.code, m.discordId, m.rank].some((v) => v.toLowerCase().includes(q))
    );
  }, [tab, namePD, outDC, search]);

  async function setStatus(row: number, status: string) {
    const currentPin = readPin() ?? pin;
    setBusy(true);

    try {
      const result = await mutations.setRosterStatus(row, currentPin, status);
      toast(result.message, 'success');
      await load(currentPin);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmMoveOut() {
    if (!confirming) return;
    const currentPin = readPin() ?? pin;
    const action = confirming;

    setConfirming(null);
    setBusy(true);

    try {
      const result = await mutations.moveOut(action.row, currentPin, action.reason);
      toast(result.message, result.warnings.length > 0 ? 'info' : 'success', 6000);
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
            📋 จัดการสถานะสมาชิก
          </h1>
          <p className="mb-8 text-center text-[#888]">Roster Management</p>

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
      <div className="mx-auto max-w-[1400px] px-5 py-5">
        <h1 className="mb-2.5 text-center text-[28px] font-bold text-[#f0c040]">
          📋 จัดการสถานะสมาชิก
        </h1>
        <p className="mb-6 text-center text-[#888]">Roster Management</p>

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
          <Stat label="ในระบบ (NamePD)" value={stats.inSystem} />
          <Stat label="ออกแล้ว (OutDC)" value={stats.departed} />
          <Stat label="ออกจาก Discord" value={stats.leftDiscord} />
          <Stat label="ถูกปลดออก" value={stats.fired} />
        </div>

        <div className="mb-5 flex gap-2.5">
          {(['namepd', 'outdc'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`cursor-pointer rounded-t-lg px-6 py-2.5 text-[15px] font-semibold transition ${
                tab === id
                  ? 'border-b-2 border-[#f0c040] bg-[#1a1a2e] text-[#f0c040]'
                  : 'bg-[#252545] text-[#888] hover:bg-[#2a2a4a]'
              }`}
            >
              {id === 'namepd' ? `ในระบบ (${stats.inSystem})` : `ออกแล้ว (${stats.departed})`}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 ค้นหา ชื่อ, รหัส, Discord ID..."
            className={`${inputClass} max-w-md`}
          />
        </div>

        {visible.length === 0 ? (
          <div className="rounded-lg border border-[#2a2a4a] bg-[#1a1a2e] p-10 text-center text-[#666]">
            ไม่มีข้อมูล
          </div>
        ) : (
          <div className="max-h-[500px] overflow-auto rounded-lg border border-[#2a2a4a]">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="sticky top-0 z-[1] bg-[#252545] text-left text-[11px] tracking-wide text-[#aaa] uppercase">
                  {[
                    'รหัส',
                    'ชื่อ',
                    'ยศ',
                    'เคส',
                    'ไม่เข้าเวร',
                    tab === 'namepd' ? 'สถานะ' : 'สาเหตุ',
                  ].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  {tab === 'namepd' && <th className="px-3 py-2.5 font-semibold">จัดการ</th>}
                </tr>
              </thead>

              <tbody>
                {visible.map((member) => (
                  <tr
                    key={`${member.row}-${member.code}`}
                    className="border-b border-[#2a2a4a] transition hover:bg-[#252545]"
                  >
                    <td className="px-3 py-2 text-xs font-bold text-[#f0c040]">{member.code}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-[#e0e0e0]">{member.name}</div>
                      <div className="text-[0.65rem] text-[#888]">{member.discordId}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#aaa]">{member.rank}</td>
                    <td className="px-3 py-2 text-xs text-[#aaa]">{member.cases}</td>
                    <td className="px-3 py-2 text-xs text-[#aaa]">{member.duration || '-'}</td>
                    <td className="px-3 py-2">
                      {tab === 'namepd' ? (
                        <select
                          value={member.status}
                          onChange={(e) => void setStatus(member.row, e.target.value)}
                          disabled={busy}
                          aria-label={`สถานะของ ${member.name}`}
                          className="cursor-pointer rounded-md border border-[#3a3a5a] bg-[#252545] px-2 py-1 text-[0.7rem] text-white outline-none disabled:opacity-50"
                        >
                          <option value="">✅ ปกติ</option>
                          {EXIT_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={member.status} />
                      )}
                    </td>

                    {tab === 'namepd' && (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={busy || !member.status}
                          title={member.status ? 'ย้ายไป OutDC' : 'เลือกสถานะการออกก่อนจึงจะย้ายได้'}
                          onClick={() =>
                            setConfirming({
                              row: member.row,
                              label: `${member.code} ${member.name}`,
                              reason: member.status,
                            })
                          }
                          className="cursor-pointer rounded-lg bg-[#ef4444] px-2.5 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ย้ายออก
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.target === e.currentTarget && setConfirming(null)}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
          style={ADMIN_FONT}
        >
          <div className="w-full max-w-[420px] rounded-xl border border-[#2a2a4a] bg-[#1a1a2e] p-6 text-center">
            <h3 className="mb-3 text-base font-bold text-[#f0c040]">⚠️ ยืนยันการย้ายออก</h3>
            <p className="mb-1 text-sm text-[#e0e0e0]">{confirming.label}</p>
            <p className="mb-5 text-xs text-[#888]">
              สาเหตุ: {confirming.reason} — ข้อมูลจะถูกย้ายไปชีต OutDC และล้างออกจาก NamePD
            </p>

            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="flex-1 cursor-pointer rounded-lg bg-[#3a3a5a] py-2.5 text-sm font-semibold text-[#e0e0e0] transition hover:opacity-85"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void confirmMoveOut()}
                className="flex-1 cursor-pointer rounded-lg bg-[#ef4444] py-2.5 text-sm font-semibold text-white transition hover:opacity-85"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  'ออกจาก Discord': 'bg-[#ef444433] text-[#ef4444]',
  ถูกปลดออก: 'bg-[#f59e0b33] text-[#f59e0b]',
  ติดต่อขอออก: 'bg-[#3b82f633] text-[#3b82f6]',
};

function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="text-xs text-[#666]">-</span>;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap ${
        STATUS_BADGE[status] ?? 'bg-[#22c55e33] text-[#22c55e]'
      }`}
    >
      {status}
    </span>
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
