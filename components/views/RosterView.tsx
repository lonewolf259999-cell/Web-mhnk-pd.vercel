'use client';

import Link from 'next/link';
import { getInitials, getRankLevel, parseCases } from '@/lib/format';
import type { Officer } from '@/lib/types';

/** Rank pill. The level decides the colour (v2's .rank-high / -medium / -low). */
function RankBadge({ rank }: { rank: string }) {
  return <span className={`rank-badge rank-${getRankLevel(rank)}`}>{rank || '—'}</span>;
}

/** v2's roster table (src/styles/components/cards.css, src/pages/RosterPage.js). */
export function RosterView({ officers, total }: { officers: Officer[]; total: number }) {
  return (
    <section>
      <div className="section-header">
        <h2>
          <span className="icon">⚖</span> รายชื่อเจ้าหน้าที่
        </h2>
        <span className="section-total">
          ทั้งหมด <strong>{total}</strong> นาย
        </span>
      </div>

      {officers.length === 0 ? (
        <div className="no-results">
          <div className="icon">🔍</div>
          <h3>ไม่พบข้อมูล</h3>
          <p>ลองค้นหาด้วยคำอื่น</p>
        </div>
      ) : (
        <div className="officer-grid">
          <div className="officer-table-header">
            <span className="hdr-avatar" />
            <span className="hdr-name">ชื่อ-นามสกุล</span>
            <span className="hdr-rank">ยศ</span>
            <span className="hdr-cases">เคส</span>
          </div>

          {officers.map((officer) => (
            <Link
              key={officer.code}
              href={`/profile?name=${encodeURIComponent(officer.fullName)}`}
              className="officer-row"
              data-code={officer.code}
            >
              <span className="row-avatar">{getInitials(officer.name, officer.code)}</span>
              <span className="row-name">{officer.name}</span>
              <RankBadge rank={officer.rank} />
              <span className="row-cases">
                <strong>{parseCases(officer.cases).toLocaleString()}</strong>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
