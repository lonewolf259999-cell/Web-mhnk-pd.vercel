import { Elysia, t } from 'elysia';
import {
  getLatestWeekTop10,
  getOfficers,
  getWeekData,
  getWeekNames,
  refreshAll,
} from '@/server/services/sheets';
import { ROSTER_MANAGE, requirePermission } from '@/server/services/permissions';

/** Roster + weekly case data. */
export const rosterRoutes = new Elysia({ name: 'roster' })
  .get('/officers', () => getOfficers())

  .get('/weeks', () => getWeekNames())

  .get('/week-data', ({ query }) => getWeekData(query.name), {
    query: t.Object({ name: t.String({ minLength: 1 }) }),
  })

  .get('/week-top10', () => getLatestWeekTop10())

  .post('/refresh', async ({ request }) => {
    await requirePermission(request, ROSTER_MANAGE);
    const officers = await refreshAll();
    return {
      success: true as const,
      message: `รีเฟรชข้อมูลสำเร็จ (${officers.length} นาย)`,
      data: { count: officers.length },
    };
  });
