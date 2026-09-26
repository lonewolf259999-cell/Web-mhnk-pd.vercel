'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { mutations } from '@/lib/client/queries';
import { useDiscordAuth } from '@/lib/client/useDiscordAuth';
import { CopyInline } from '@/components/ui/CopyInline';
import { DebugLog, PageToast, useDebugLog, useToastState } from './AdminShell';
import { DiscordGate, type GateState } from './DiscordGate';
import type { RosterMember } from '@/server/services/roster';

/* The sheet stores an empty status for "still serving"; everything else is an
   exit reason. The blank option below is that empty value. */
const STATUS_OPTIONS = ['', 'ออกจาก Discord', 'ถูกปลดออก', 'ติดต่อขอออก', 'เกิน 15 วัน'] as const;

/** Filter-only sentinel for "no exit reason set" — see the note in the filter. */
const NORMAL = '__normal__';

interface PendingConfirm {
  row: number;
  title: string;
  message: string;
  reason: string;
}

function statusClass(status: string): string {
  if (!status) return 'status-normal';
  if (status === 'ออกจาก Discord') return 'status-left';
  if (status === 'ถูกปลดออก') return 'status-fired';
  if (status === 'ติดต่อขอออก') return 'status-resign';
  return 'status-normal';
}

function statusText(status: string): string {
  if (!status) return '✅ ปกติ';
  if (status === 'ออกจาก Discord') return '🔴 ออกจาก Discord';
  if (status === 'ถูกปลดออก') return '🟡 ถูกปลดออก';
  if (status === 'ติดต่อขอออก') return '🔵 ติดต่อขอออก';
  return status;
}

const stripTag = (name: string) => name.replace(/\[MHNK-PD\]/g, '');

export function RosterManagePanel() {
  const auth = useDiscordAuth('roster');
  const [toast, showToast] = useToastState();
  const [logText, log] = useDebugLog();

  const [gate, setGate] = useState<GateState | null>(null);
  const [checking, setChecking] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloading, setReloading] = useState(false);

  const [namePD, setNamePD] = useState<RosterMember[]>([]);
  const [outDC, setOutDC] = useState<RosterMember[]>([]);
  const [tab, setTab] = useState<'namepd' | 'outdc'>('namepd');

  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchOut, setSearchOut] = useState('');

  const [confirming, setConfirming] = useState<PendingConfirm | null>(null);
  const [confirmRunning, setConfirmRunning] = useState(false);

  /* Whether this browser is signed in, and whether that account is on the
     allowlist in the sheet. The page cannot work either out for itself: the
     Discord session is an HttpOnly cookie, so it has to ask the server. Asking
     on every load is also what makes a refresh survive — the OAuth params in
     the URL are stripped by then, the cookie is not. */
  const refreshAccess = useCallback(async (): Promise<GateState> => {
    try {
      const result = await mutations.rosterAccess();
      setGate(result);
      return result;
    } catch (err) {
      // An unanswered question is not a yes.
      const denied: GateState = { userId: null, allowed: false, problem: '' };
      setGate(denied);
      log(`Error: ${(err as Error).message}`);
      return denied;
    } finally {
      setChecking(false);
    }
  }, [log]);

  const loadData = useCallback(async () => {
    setBusy(true);
    setReloading(true);
    try {
      const [inSystem, departed] = await Promise.all([mutations.namePD(), mutations.outDC()]);
      const current = inSystem.data as RosterMember[];
      const gone = departed.data as RosterMember[];

      setNamePD(current);
      setOutDC(gone);
      setLoaded(true);
      log(`โหลด NamePD ${current.length} รายการ, OutDC ${gone.length} รายการ`);
    } catch (err) {
      const message = (err as Error).message;
      showToast(message || 'โหลดข้อมูลไม่สำเร็จ', 'error');
      log(`Error: ${message}`);

      /* Access can be taken away while the page is open — the list is re-read
         on every request. Rather than leaving a dead table on screen, drop back
         to the gate so it says why. */
      if (/สิทธิ์|Discord/.test(message)) {
        setLoaded(false);
        void refreshAccess();
      }
    } finally {
      setBusy(false);
      setReloading(false);
    }
  }, [log, showToast, refreshAccess]);

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  /* On the list: straight into the table. With the PIN field gone there is no
     second step left for the person to click. */
  const allowed = gate?.allowed ?? false;
  useEffect(() => {
    if (allowed) void loadData();
  }, [allowed, loadData]);

  async function doLogout() {
    try {
      await mutations.discordLogout();
    } catch {
      /* the cookie expires on its own; nothing useful to show */
    }
    setGate({ userId: null, allowed: false, problem: '' });
    setLoaded(false);
    setNamePD([]);
    setOutDC([]);
    auth.disconnect();
    log('ออกจากระบบแล้ว');
  }

  /* Both counters read NamePD: they answer "who is still on the roster but
     already flagged", which is what makes them actionable. */
  const stats = useMemo(
    () => ({
      inSystem: namePD.length,
      departed: outDC.length,
      leftDiscord: namePD.filter((m) => m.status === 'ออกจาก Discord').length,
      fired: namePD.filter((m) => m.status === 'ถูกปลดออก').length,
    }),
    [namePD, outDC]
  );

  const visibleNamePD = useMemo(() => {
    const q = search.toLowerCase().trim();
    const minDays = dayFilter.trim() ? parseInt(dayFilter.trim(), 10) : NaN;

    return namePD.filter((m) => {
      if (
        q &&
        ![m.code, m.name, m.discordId].some((v) => v.toLowerCase().includes(q))
      ) {
        return false;
      }

      if (!Number.isNaN(minDays)) {
        const match = m.duration.match(/(\d+)\s*วัน/);
        const days = match ? parseInt(match[1], 10) : NaN;
        if (Number.isNaN(days) || days < minDays) return false;
      }

      // v2 gave both "สถานะทั้งหมด" and "ปกติ" the value "", so picking ปกติ
      // silently filtered nothing. NORMAL is the sentinel that makes it work.
      if (statusFilter === NORMAL) return m.status === '';
      if (statusFilter && m.status !== statusFilter) return false;
      return true;
    });
  }, [namePD, search, dayFilter, statusFilter]);

  const visibleOutDC = useMemo(() => {
    const q = searchOut.toLowerCase().trim();
    if (!q) return outDC;
    return outDC.filter((m) =>
      [m.code, m.name, m.discordId].some((v) => v.toLowerCase().includes(q))
    );
  }, [outDC, searchOut]);

  async function updateStatus(row: number, newStatus: string) {
    setBusy(true);
    try {
      const result = await mutations.setRosterStatus(row, newStatus);
      showToast(result.message, 'success');
      log(`อัปเดตสถานะ แถว ${row} → ${newStatus || 'ปกติ'}`);
      await loadData();
    } catch (err) {
      showToast((err as Error).message || 'เกิดข้อผิดพลาด', 'error');
    } finally {
      setBusy(false);
    }
  }

  function confirmMoveOut(member: RosterMember) {
    if (!member.status) {
      showToast(
        'กรุณาเลือกสถานะก่อน ("ออกจาก Discord", "ถูกปลดออก", "ติดต่อขอออก")',
        'error'
      );
      return;
    }

    setConfirming({
      row: member.row,
      reason: member.status,
      title: '⚠️ ยืนยันการย้ายออก',
      message:
        `ต้องการย้าย ${member.code} ${stripTag(member.name).trim()} ออกจากระบบ?\n` +
        `สาเหตุ: ${member.status}\n\n` +
        '⚠️ ข้อมูลจะถูกลบจาก NamePD และไปอยู่ OutDC',
    });
  }

  async function executeMoveOut() {
    if (!confirming) return;
    const action = confirming;
    setConfirmRunning(true);

    try {
      const result = await mutations.moveOut(action.row, action.reason);
      showToast(result.message, 'success');
      log(`ย้ายออก: ${result.message}`);
      await loadData();
    } catch (err) {
      showToast((err as Error).message || 'เกิดข้อผิดพลาด', 'error');
    } finally {
      setConfirmRunning(false);
      setConfirming(null);
    }
  }

  return (
    <div className="rostermanage-page">
      <div className="container">
        <h1>📋 จัดการสถานะสมาชิก</h1>
        <p className="subtitle">
          MHNK Police Department — ดูสถานะ / เปลี่ยนสถานะ / ย้ายออกจากระบบ
        </p>

        <PageToast toast={toast} />

        {confirming && (
          <div className="confirm-dialog" style={{ display: 'flex' }} role="dialog" aria-modal="true">
            <div className="confirm-box">
              {confirmRunning ? (
                <div className="confirm-loading" style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                  <div style={{ color: '#f0c040', fontWeight: 600 }}>กำลังดำเนินการ...</div>
                </div>
              ) : (
                <div>
                  <h3>{confirming.title}</h3>
                  <p style={{ whiteSpace: 'pre-line' }}>{confirming.message}</p>
                  <div className="actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setConfirming(null)}
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => void executeMoveOut()}
                    >
                      ยืนยัน
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!loaded ? (
          /* Allowed but not loaded yet is the gap between the access answer and
             the first fetch — showing the gate there would flash "no access" at
             someone who has it. */
          allowed ? (
            <div className="login-box">
              <div className="loading">กำลังโหลดข้อมูล…</div>
            </div>
          ) : (
            <DiscordGate
              loginUrl={auth.loginUrl}
              checking={checking}
              gate={gate}
              failed={auth.failed}
              displayName={auth.user?.name ?? ''}
              avatarUrl={auth.avatarUrl}
              sheetName="NamePD"
              cellName="AB2"
              onLogout={() => void doLogout()}
            />
          )
        ) : (
          <div>
            <div className="stats">
              <div className="stat-card">
                <div className="num">{stats.inSystem}</div>
                <div className="label">ในระบบ (NamePD)</div>
              </div>
              <div className="stat-card">
                <div className="num">{stats.departed}</div>
                <div className="label">ออกแล้ว (OutDC)</div>
              </div>
              <div className="stat-card">
                <div className="num">{stats.leftDiscord}</div>
                <div className="label">ออกจาก Discord</div>
              </div>
              <div className="stat-card">
                <div className="num">{stats.fired}</div>
                <div className="label">ถูกปลดออก</div>
              </div>
            </div>

            <div className="tab-bar">
              <button
                type="button"
                className={`tab-btn${tab === 'namepd' ? ' active' : ''}`}
                onClick={() => setTab('namepd')}
              >
                📋 NamePD (ในระบบ)
              </button>
              <button
                type="button"
                className={`tab-btn${tab === 'outdc' ? ' active' : ''}`}
                onClick={() => setTab('outdc')}
              >
                🗂️ OutDC (ออกแล้ว)
              </button>
            </div>

            <div className="panel" style={{ display: tab === 'namepd' ? 'block' : 'none' }}>
              <div className="filter-bar">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="🔍 ค้นหา ชื่อ, รหัส, Discord ID..."
                  aria-label="ค้นหาสมาชิก"
                />
                <input
                  type="text"
                  value={dayFilter}
                  onChange={(e) => setDayFilter(e.target.value)}
                  placeholder="📅 จำนวนวัน..."
                  aria-label="กรองตามจำนวนวัน"
                  style={{ width: 120, flex: 'none' }}
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="กรองตามสถานะ"
                >
                  <option value="">สถานะทั้งหมด</option>
                  <option value={NORMAL}>ปกติ</option>
                  <option value="ออกจาก Discord">ออกจาก Discord</option>
                  <option value="ถูกปลดออก">ถูกปลดออก</option>
                  <option value="ติดต่อขอออก">ติดต่อขอออก</option>
                  <option value="เกิน 15 วัน">เกิน 15 วัน</option>
                </select>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => void loadData()}
                  disabled={busy}
                >
                  🔄 โหลดใหม่
                </button>
              </div>

              <div className="table-wrap">
                {(reloading || visibleNamePD.length > 0) && (
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>รหัส</th>
                        <th>ชื่อ-นามสกุล</th>
                        <th>Discord ID</th>
                        <th>เบอร์</th>
                        <th>ยศ</th>
                        <th>เคส</th>
                        <th>Steam</th>
                        <th>ระยะเวลา</th>
                        <th>สถานะ</th>
                        <th>เปลี่ยนสถานะ</th>
                        <th>ย้ายออก</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reloading && (
                        <tr>
                          <td colSpan={12} className="loading">
                            กำลังโหลด
                          </td>
                        </tr>
                      )}
                      {!reloading &&
                        visibleNamePD.map((m, i) => (
                        <tr key={m.row}>
                          <td>{i + 1}</td>
                          <td>
                            <strong>{m.code}</strong>
                          </td>
                          <td>{stripTag(m.name)}</td>
                          <td>
                            <code style={{ fontSize: 11, color: '#aaa' }}>{m.discordId}</code>
                            <CopyInline value={m.discordId} />
                          </td>
                          <td>{m.phone || ''}</td>
                          <td>{m.rank}</td>
                          <td>{m.cases || '0'}</td>
                          <td style={{ fontSize: 11, color: '#888' }}>
                            {m.steam}
                            <CopyInline value={m.steam} />
                          </td>
                          <td>{m.duration}</td>
                          <td>
                            <span className={`status-badge ${statusClass(m.status)}`}>
                              {statusText(m.status)}
                            </span>
                          </td>
                          <td>
                            <select
                              className="status-select"
                              value={m.status}
                              disabled={busy}
                              aria-label={`สถานะของ ${stripTag(m.name)}`}
                              onChange={(e) => void updateStatus(m.row, e.target.value)}
                            >
                              {STATUS_OPTIONS.map((option) => (
                                <option key={option || 'normal'} value={option}>
                                  {option || '✅ ปกติ'}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="actions">
                            <button
                              type="button"
                              className="btn-danger btn-xs"
                              onClick={() => confirmMoveOut(m)}
                              disabled={busy}
                            >
                              🚫 ย้ายออก
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {!reloading && visibleNamePD.length === 0 && (
                <div className="empty-msg">💡 ไม่มีข้อมูล</div>
              )}
            </div>

            <div className="panel" style={{ display: tab === 'outdc' ? 'block' : 'none' }}>
              <div className="filter-bar">
                <input
                  type="text"
                  value={searchOut}
                  onChange={(e) => setSearchOut(e.target.value)}
                  placeholder="🔍 ค้นหา..."
                  aria-label="ค้นหาสมาชิกที่ออกแล้ว"
                />
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => void loadData()}
                  disabled={busy}
                >
                  🔄 โหลดใหม่
                </button>
              </div>

              <div className="table-wrap">
                {(reloading || visibleOutDC.length > 0) && (
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>รหัส</th>
                        <th>ชื่อ-นามสกุล</th>
                        <th>Discord ID</th>
                        <th>ยศ</th>
                        <th>Steam</th>
                        <th>ไม่เข้าเวร</th>
                        <th>สาเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reloading && (
                        <tr>
                          <td colSpan={8} className="loading">
                            กำลังโหลด
                          </td>
                        </tr>
                      )}
                      {!reloading &&
                        visibleOutDC.map((m, i) => (
                        <tr key={`${m.row}-${m.code}`}>
                          <td>{i + 1}</td>
                          <td>
                            <strong>{m.code}</strong>
                          </td>
                          <td>{stripTag(m.name)}</td>
                          <td>
                            <code style={{ fontSize: 11, color: '#aaa' }}>{m.discordId}</code>
                            <CopyInline value={m.discordId} />
                          </td>
                          <td>{m.rank}</td>
                          <td style={{ fontSize: 11, color: '#888' }}>
                            {m.steam}
                            <CopyInline value={m.steam} />
                          </td>
                          {/* Column L: "ไม่เข้าเวร" on OutDC, "ระยะเวลา" on NamePD —
                              one mapper serves both sheets. */}
                          <td>{m.duration}</td>
                          <td>
                            <span className={`status-badge ${statusClass(m.status)}`}>
                              {statusText(m.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {!reloading && visibleOutDC.length === 0 && (
                <div className="empty-msg">💡 ไม่มีข้อมูล</div>
              )}
            </div>

            <DebugLog text={logText} />
          </div>
        )}
      </div>
    </div>
  );
}
