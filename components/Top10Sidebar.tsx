'use client';

import { useEffect, useMemo, useState } from 'react';
import { queries } from '@/lib/client/queries';
import { parseCases } from '@/lib/format';
import type { Officer } from '@/lib/types';

interface Entry {
  name: string;
  rank: string;
  cases: number;
}

/** v2's sidebar card (src/styles/components/sidebar.css). */
function Panel({
  side,
  title,
  badge,
  children,
}: {
  side: 'left' | 'right';
  title: React.ReactNode;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <aside className={`sidebar sidebar-${side}`}>
      <div className="sidebar-card">
        <div className="sidebar-header">
          <h3>{title}</h3>
          <span className="sidebar-badge">{badge}</span>
        </div>
        {children}
      </div>
    </aside>
  );
}

/* The first three places carry their own medal colours, which the stylesheet
   applies through :nth-child — so the list order is what drives them. */
function TopList({ entries, empty }: { entries: Entry[]; empty: string }) {
  if (entries.length === 0) {
    return <div className="top-empty">{empty}</div>;
  }

  return (
    <div className="top-list">
      {entries.map((entry, index) => (
        <div className="top-item" key={`${entry.name}-${index}`}>
          <span className="top-rank">{index + 1}</span>
          <div className="top-info">
            <div className="top-name">{entry.name}</div>
            <div className="top-rank-label">{entry.rank}</div>
          </div>
          <span className="top-cases">{entry.cases.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/** Left panel: weekly TOP 10, with a week picker. */
export function WeeklyTop10({ weeks }: { weeks: string[] }) {
  const [selected, setSelected] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');

  // Memoised because it is an effect dependency: a fresh array every render
  // would re-run that effect on every render.
  const realWeeks = useMemo(() => weeks.filter((w) => w.toLowerCase() !== 'test'), [weeks]);

  // Default to the newest week as soon as the list arrives.
  useEffect(() => {
    if (!selected && realWeeks.length > 0) setSelected(realWeeks[realWeeks.length - 1]);
  }, [realWeeks, selected]);

  useEffect(() => {
    if (!selected) return;

    let active = true;
    setStatus('loading');

    queries
      .weekData(selected)
      .then((data) => {
        if (!active) return;
        const top = Object.values(data)
          .sort((a, b) => (parseFloat(b.totalCases) || 0) - (parseFloat(a.totalCases) || 0))
          .slice(0, 10)
          .map((o) => ({ name: o.name, rank: o.rank, cases: parseFloat(o.totalCases) || 0 }));
        setEntries(top);
        setStatus('idle');
      })
      .catch(() => active && setStatus('error'));

    return () => {
      active = false;
    };
  }, [selected]);

  return (
    <Panel
      side="left"
      title={
        <>
          ★ <span>TOP 10</span>
          {selected && ` (${selected})`}
        </>
      }
      badge="เคส"
    >
      <select
        className="week-select"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        aria-label="เลือกสัปดาห์"
      >
        {realWeeks.length === 0 && <option value="">กำลังโหลด...</option>}
        {realWeeks.map((week) => (
          <option key={week} value={week}>
            {week}
          </option>
        ))}
      </select>

      {status === 'loading' && <div className="top-empty">กำลังโหลด...</div>}
      {status === 'error' && <div className="top-empty">โหลดไม่สำเร็จ</div>}
      {status === 'idle' && <TopList entries={entries} empty="ไม่มีข้อมูล" />}
    </Panel>
  );
}

/** Right panel: all-time TOP 10 from the roster sheet. */
export function AllTimeTop10({ officers }: { officers: Officer[] }) {
  // Sorting the full roster on every keystroke in the search box is wasted
  // work — the ranking only depends on the officer list.
  const entries = useMemo(
    () =>
      [...officers]
        .sort((a, b) => parseCases(b.cases) - parseCases(a.cases))
        .slice(0, 10)
        .map((o) => ({ name: o.name, rank: o.rank, cases: parseCases(o.cases) })),
    [officers]
  );

  return (
    <Panel
      side="right"
      title={
        <>
          ★ <span>TOP 10</span> เคส
        </>
      }
      badge="TOP"
    >
      <TopList entries={entries} empty="ไม่มีข้อมูล" />
    </Panel>
  );
}
