'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { NavTabs, type PageId } from '@/components/NavTabs';
import { SearchBar } from '@/components/SearchBar';
import { AllTimeTop10, WeeklyTop10 } from '@/components/Top10Sidebar';
import { RosterView } from '@/components/views/RosterView';
import { RulesView } from '@/components/views/RulesView';
import { FinesView } from '@/components/views/FinesView';
import { CasesView } from '@/components/views/CasesView';
import { ScheduleView } from '@/components/views/ScheduleView';
import { ErrorState, Loading } from '@/components/ui/States';
import { PinModal } from '@/components/ui/Modal';
import { useApi } from '@/lib/client/api';
import { queries } from '@/lib/client/queries';
import { filterByQuery } from '@/lib/format';
import { clearPin, isAdminMode, savePin, verifyStoredPin } from '@/lib/client/adminPin';
import './home.css';

export default function HomePage() {
  const [page, setPage] = useState<PageId>('roster');
  const [query, setQuery] = useState('');

  const [adminMode, setAdminMode] = useState(false);
  const [pinPrompt, setPinPrompt] = useState(false);
  useEffect(() => {
    setAdminMode(isAdminMode());
    void verifyStoredPin().then(setAdminMode);
  }, []);

  /* Each tab's data is a separate Google Sheets round trip, so a tab is
     fetched the first time it is opened and kept from then on — switching
     back is instant, and tabs nobody visits are never requested. */
  const [visited, setVisited] = useState<Set<PageId>>(() => new Set<PageId>(['roster']));

  const openPage = useCallback((next: PageId) => {
    setPage(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  }, []);

  const seen = (id: PageId) => visited.has(id);

  // The roster feeds both the officer list and the schedule table.
  const officers = useApi(queries.officers, 'officers');
  const weeks = useApi(queries.weeks, 'weeks');
  const cases = useApi(queries.cases, 'cases_data', seen('cases'));
  const conduct = useApi(queries.conduct, 'conduct_data', seen('conduct'));
  const rules = useApi(queries.rules, 'rules_data', seen('rules'));
  const fines = useApi(queries.fines, 'fines_data', seen('fines'));
  const schedule = useApi(queries.scheduleConfig, 'schedule_config', seen('schedule'));

  const allOfficers = useMemo(() => officers.data ?? [], [officers.data]);

  const filteredOfficers = useMemo(
    () => filterByQuery(allOfficers, query, ['name', 'code', 'rank']),
    [allOfficers, query]
  );

  return (
    <div className="home-page flex min-h-screen flex-col">
      <SiteHeader
        extraBadge={
          <button
            type="button"
            onClick={() => {
              if (adminMode) {
                clearPin();
                setAdminMode(false);
              } else {
                setPinPrompt(true);
              }
            }}
            className={`cursor-pointer rounded-md border px-2.5 py-1 text-[0.55rem] font-bold tracking-wide whitespace-nowrap transition ${
              adminMode
                ? 'border-[#f77f07] bg-[#f77f07] text-white'
                : 'border-[#f77f07]/30 bg-[#f77f07]/10 text-[#f77f07] hover:bg-[#f77f07]/20'
            }`}
          >
            ♛ Admin
          </button>
        }
      >
        <div className="header-nav-row">
          <SearchBar
            value={query}
            onChange={setQuery}
            resultCount={filteredOfficers.length}
            totalCount={allOfficers.length}
          />
          <NavTabs active={page} onChange={openPage} />
        </div>
      </SiteHeader>

      {/* w-full is load-bearing: v2's .app-layout centres itself with
          `margin: 0 auto`, and an auto cross-axis margin cancels the stretch
          it would otherwise get from this flex column — leaving it to
          shrink-wrap its content and spill past the viewport. */}
      <div className="app-layout w-full flex-1">
        <WeeklyTop10 weeks={weeks.data ?? []} />

        {/* Keyed by tab so React swaps the subtree outright — that is what
            replays the entrance animation instead of cross-fading two tabs. */}
        <main className="main-content tab-panel" key={page}>
          {page === 'roster' &&
            (officers.loading ? (
              <Loading />
            ) : officers.error ? (
              <ErrorState message={officers.error} onRetry={officers.reload} />
            ) : (
              <RosterView officers={filteredOfficers} total={allOfficers.length} />
            ))}

          {page === 'cases' && (
            <CasesView
              items={cases.data}
              loading={cases.loading}
              error={cases.error}
              query={query}
              onRetry={cases.reload}
            />
          )}

          {page === 'conduct' && (
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
              adminMode={adminMode}
              onDataChanged={conduct.reload}
            />
          )}

          {page === 'rules' && (
            <RulesView
              items={rules.data}
              loading={rules.loading}
              error={rules.error}
              query={query}
              onRetry={rules.reload}
              groupField="category"
              icon="📖"
              title="กฎหมายและระเบียบตำรวจ"
              emptyTitle="ไม่พบกฎที่ค้นหา"
              type="rules"
              adminMode={adminMode}
              onDataChanged={rules.reload}
            />
          )}

          {page === 'fines' && (
            <FinesView
              items={fines.data}
              loading={fines.loading}
              error={fines.error}
              query={query}
              onRetry={fines.reload}
              adminMode={adminMode}
              onDataChanged={fines.reload}
            />
          )}

          {page === 'schedule' &&
            (officers.loading ? (
              <Loading />
            ) : (
              <ScheduleView officers={filteredOfficers} config={schedule.data} />
            ))}
        </main>

        <AllTimeTop10 officers={allOfficers} />
      </div>

      <SiteFooter />

      {pinPrompt && (
        <PinModal
          title="กรุณาระบุรหัสผ่านเพื่อเข้าโหมดผู้ดูแล"
          onCancel={() => setPinPrompt(false)}
          onSubmit={(pin) => {
            savePin(pin);
            setPinPrompt(false);
            setAdminMode(true);
          }}
        />
      )}
    </div>
  );
}
