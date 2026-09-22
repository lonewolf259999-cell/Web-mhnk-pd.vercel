'use client';

import Link from 'next/link';
import { getInitials, getRankLevel, parseCases, type RankLevel } from '@/lib/format';
import { EmptyState, SectionHeader } from '@/components/ui/States';
import type { Officer } from '@/lib/types';

const RANK_STYLES: Record<RankLevel, string> = {
  high: 'border-gold/30 bg-gold/10 text-gold',
  medium: 'border-accent/25 bg-accent/10 text-accent',
  low: 'border-white/10 bg-white/5 text-ink-dim',
};

export function RankBadge({ rank }: { rank: string }) {
  return (
    <span
      className={`truncate rounded-md border px-2 py-0.5 text-[0.7rem] font-semibold ${RANK_STYLES[getRankLevel(rank)]}`}
    >
      {rank || '—'}
    </span>
  );
}

export function RosterView({ officers, total }: { officers: Officer[]; total: number }) {
  return (
    <section>
      <SectionHeader
        icon="⚖"
        title="รายชื่อเจ้าหน้าที่"
        trailing={
          <span className="text-xs text-ink-dim">
            ทั้งหมด <strong className="text-accent">{total}</strong> นาย
          </span>
        }
      />

      {officers.length === 0 ? (
        <EmptyState icon="🔍" title="ไม่พบข้อมูล" message="ลองค้นหาด้วยคำอื่น" />
      ) : (
        <div className="hidden grid-cols-[3rem_1fr_9rem_5rem] items-center gap-3 px-3.5 py-1.5 text-[0.7rem] font-semibold tracking-wide text-ink-dim uppercase sm:grid">
          <span />
          <span>ชื่อ-นามสกุล</span>
          <span>ยศ</span>
          <span className="text-right">เคส</span>
        </div>
      )}

      {officers.length > 0 && (
        <div className="space-y-1">
          {officers.map((officer) => (
            <Link
              key={officer.code}
              href={`/profile?name=${encodeURIComponent(officer.fullName)}`}
              className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-sm border border-accent/12 bg-[var(--card-bg)] px-3.5 py-2 transition hover:translate-x-[3px] hover:border-accent/25 hover:bg-accent/[0.04] sm:grid-cols-[3rem_1fr_9rem_5rem]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-accent/20 bg-accent/10 text-xs font-bold text-accent">
                {getInitials(officer.name, officer.code)}
              </span>

              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{officer.name}</span>
                <span className="mt-0.5 block sm:hidden">
                  <RankBadge rank={officer.rank} />
                </span>
              </span>

              <span className="hidden min-w-0 sm:block">
                <RankBadge rank={officer.rank} />
              </span>

              <span className="text-right text-sm font-bold text-accent tabular-nums">
                {parseCases(officer.cases).toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
