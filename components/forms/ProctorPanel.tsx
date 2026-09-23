'use client';

import { useMemo, useState } from 'react';
import { mutations } from '@/lib/client/queries';
import { useDiscordAuth } from '@/lib/client/useDiscordAuth';
import { CopyInline } from '@/components/ui/CopyInline';
import {
  AdminLoginBox,
  DebugLog,
  PageToast,
  useDebugLog,
  useToastState,
} from './AdminShell';

/* Column headers come from the Pending sheet, so they are Thai strings. */
const COL = {
  timestamp: 'Timestamp',
  time: 'เวลา',
  discordId: 'Discord ID',
  discordName: 'ชื่อ Discord',
  icName: 'ชื่อ IC',
  phone: 'เบอร์ IC',
  ageOoc: 'อายุ OOC',
  age: 'อายุ',
  steamUrl: 'Steam URL',
  steam: 'Steam',
  status: 'สถานะ',
} as const;

const PENDING = 'รอตรวจ';
const APPROVED = 'อนุมัติ';
const REJECTED = 'ปฏิเสธ';

type Row = Record<string, string | number> & { _row: number };

function statusClass(status: string): string {
  if (status === PENDING) return 'status-pending';
  if (status === APPROVED) return 'status-approved';
  if (status === REJECTED) return 'status-rejected';
  return '';
}

export function ProctorPanel() {
  const auth = useDiscordAuth('admin');
  const [toast, showToast] = useToastState();
  const [logText, log] = useDebugLog();

  /* The PIN is never persisted: it is a shared admin secret, and v2 kept it in
     a page variable that dies with the tab. */
  const [pin, setPin] = useState('');
  const [sessionPin, setSessionPin] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloading, setReloading] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function loadData(withPin: string) {
    setBusy(true);
    setReloading(true);
    try {
      const result = await mutations.listPending(withPin);
      const data = result.data as Row[];
      setRows(data);
      setSessionPin(withPin);
      setLoaded(true);
      log(`โหลดข้อมูล ${data.length} รายการ`);
    } catch (err) {
      const message = (err as Error).message;
      showToast(message || 'PIN ไม่ถูกต้อง', 'error');
      log(`Error: ${message}`);
    } finally {
      setBusy(false);
      setReloading(false);
    }
  }

  function doLogin() {
    if (!auth.user) {
      showToast('กรุณาเชื่อมต่อ Discord ก่อน', 'error');
      return;
    }
    const value = pin.trim();
    if (!value) {
      showToast('กรุณากรอก PIN', 'error');
      return;
    }
    void loadData(value);
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

      return [COL.discordId, COL.discordName, COL.icName].some((key) =>
        String(row[key] ?? '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  async function approve(row: number) {
    if (!auth.user) {
      showToast('กรุณาเชื่อมต่อ Discord ก่อนอนุมัติ', 'error');
      return;
    }
    const item = rows.find((r) => r._row === row);
    const discordId = String(item?.[COL.discordId] ?? '');
    if (!window.confirm(`อนุมัติผู้ใช้ Discord ID: ${discordId}?`)) return;

    setBusy(true);
    try {
      await mutations.approvePending(row, {
        pin: sessionPin,
        proctorDiscordId: auth.user.userId,
        proctorDiscordName: auth.user.name,
      });
      showToast(`✔ อนุมัติ ${discordId} เรียบร้อย`);
      log(`อนุมัติ แถว ${row} (${discordId}) โดย proctor ${auth.user.userId}`);
      await loadData(sessionPin);
    } catch (err) {
      showToast((err as Error).message || 'เกิดข้อผิดพลาด', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function reject(row: number) {
    if (!auth.user) {
      showToast('กรุณาเชื่อมต่อ Discord ก่อนปฏิเสธ', 'error');
      return;
    }
    const item = rows.find((r) => r._row === row);
    const discordId = String(item?.[COL.discordId] ?? '');
    if (!window.confirm(`ปฏิเสธผู้ใช้ Discord ID: ${discordId}?`)) return;

    setBusy(true);
    try {
      await mutations.rejectPending(row, sessionPin);
      showToast(`ปฏิเสธ ${discordId} เรียบร้อย`);
      log(`ปฏิเสธ แถว ${row} (${discordId})`);
      await loadData(sessionPin);
    } catch (err) {
      showToast((err as Error).message || 'เกิดข้อผิดพลาด', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="proctor-page">
      <div className="container">
        <h1>⚙️ Admin Panel</h1>
        <p className="subtitle">MHNK Police Department — ระบบตรวจสอบและอนุมัติใบสมัคร</p>

        <PageToast toast={toast} />

        {!loaded ? (
          <AdminLoginBox
            auth={auth}
            pin={pin}
            onPinChange={setPin}
            onSubmit={doLogin}
            busy={busy}
          />
        ) : (
          <div>
            <div className="stats">
              <div className="stat-card">
                <div className="num">{stats.total}</div>
                <div className="label">ทั้งหมด</div>
              </div>
              <div className="stat-card">
                <div className="num">{stats.pending}</div>
                <div className="label">รอตรวจ</div>
              </div>
              <div className="stat-card">
                <div className="num">{stats.approved}</div>
                <div className="label">อนุมัติแล้ว</div>
              </div>
              <div className="stat-card">
                <div className="num">{stats.rejected}</div>
                <div className="label">ปฏิเสธ</div>
              </div>
            </div>

            <div className="panel">
              <div className="filter-bar">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="🔍 ค้นหา Discord ID, ชื่อ..."
                  aria-label="ค้นหาใบสมัคร"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="กรองตามสถานะ"
                  style={{
                    padding: 10,
                    background: '#252545',
                    border: '1px solid #3a3a5a',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                  }}
                >
                  <option value="">ทั้งหมด</option>
                  <option value={PENDING}>{PENDING}</option>
                  <option value={APPROVED}>{APPROVED}</option>
                  <option value={REJECTED}>{REJECTED}</option>
                </select>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => void loadData(sessionPin)}
                  disabled={busy}
                >
                  🔄 โหลดใหม่
                </button>
              </div>

              <div className="table-wrap">
                {(reloading || visible.length > 0) && (
                  <table>
                    <thead>
                      <tr>
                        <th className="col-idx">#</th>
                        <th className="col-time">เวลา</th>
                        <th className="col-did">Discord ID</th>
                        <th className="col-dname">ชื่อ Discord</th>
                        <th className="col-icname">ชื่อ IC</th>
                        <th className="col-phone">เบอร์</th>
                        <th className="col-age">อายุ</th>
                        <th className="col-steam">Steam</th>
                        <th className="col-status">สถานะ</th>
                        <th className="col-actions">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reloading && (
                        <tr>
                          <td colSpan={10} className="loading">
                            กำลังโหลด
                          </td>
                        </tr>
                      )}
                      {!reloading &&
                        visible.map((row, i) => {
                        const status = String(row[COL.status] ?? PENDING);
                        const discordId = String(row[COL.discordId] ?? '');
                        const steam = String(row[COL.steamUrl] ?? row[COL.steam] ?? '');

                        return (
                          <tr key={row._row}>
                            <td>{i + 1}</td>
                            <td>{String(row[COL.timestamp] ?? row[COL.time] ?? '—')}</td>
                            <td className="col-did">
                              <code style={{ fontSize: 11, color: '#aaa' }}>
                                {discordId || '—'}
                              </code>
                              <CopyInline value={discordId} />
                            </td>
                            <td>{String(row[COL.discordName] ?? '—')}</td>
                            <td>{String(row[COL.icName] ?? '—')}</td>
                            <td>{String(row[COL.phone] ?? '—')}</td>
                            <td>{String(row[COL.ageOoc] ?? row[COL.age] ?? '—')}</td>
                            <td>
                              <a
                                href={steam || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#6af' }}
                              >
                                {(steam || '—').substring(0, 30)}
                              </a>
                            </td>
                            <td>
                              <span className={`status-badge ${statusClass(status)}`}>{status}</span>
                            </td>
                            <td className="actions">
                              {status === PENDING ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn-success btn-sm"
                                    onClick={() => void approve(row._row)}
                                    disabled={!auth.user || busy}
                                    title={auth.user ? undefined : 'กรุณาเชื่อมต่อ Discord ก่อน'}
                                  >
                                    ✔ อนุมัติ
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-danger btn-sm"
                                    onClick={() => void reject(row._row)}
                                    disabled={!auth.user || busy}
                                    title={auth.user ? undefined : 'กรุณาเชื่อมต่อ Discord ก่อน'}
                                  >
                                    ✘ ปฏิเสธ
                                  </button>
                                </>
                              ) : (
                                <button type="button" className="btn-done" disabled>
                                  เสร็จสิ้น
                                </button>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                    </tbody>
                  </table>
                )}
              </div>

              {!reloading && visible.length === 0 && (
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
