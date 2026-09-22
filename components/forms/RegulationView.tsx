'use client';

import { useState } from 'react';
import { useApi } from '@/lib/client/api';
import { queries } from '@/lib/client/queries';
import { RulesView } from '@/components/views/RulesView';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { SearchBar } from '@/components/SearchBar';
import Link from 'next/link';

/** Standalone, read-only view of the conduct rules — mirrors v2's
    regulation.html: full site header, then its own section header row
    (icon+title / back link), then a search box. */
export function RegulationView() {
  const [query, setQuery] = useState('');
  const conduct = useApi(queries.conduct, 'conduct_data');

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1300px] flex-1 px-4 py-6 lg:px-6">
        <div className="mb-5">
          <SearchBar
            value={query}
            onChange={setQuery}
            resultCount={conduct.data?.length ?? 0}
            totalCount={conduct.data?.length ?? 0}
          />
        </div>

        <RulesView
          items={conduct.data}
          loading={conduct.loading}
          error={conduct.error}
          query={query}
          onRetry={conduct.reload}
          groupField="title"
          icon="📚"
          title="ข้อปฏิบัติเจ้าหน้าที่"
          emptyTitle="ไม่พบข้อปฏิบัติที่ค้นหา"
          type="conduct"
          adminMode={false}
          onDataChanged={conduct.reload}
          headerTrailing={
            <Link
              href="/"
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-semibold text-ink-dim transition hover:bg-accent/10 hover:text-accent"
            >
              ← กลับไปหน้าหลัก
            </Link>
          }
        />
      </main>

      <SiteFooter />
    </div>
  );
}
