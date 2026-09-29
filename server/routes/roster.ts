import { Elysia, t } from 'elysia';
import {
  getLatestWeekTop10,
  getOfficers,
  getWeekData,
  getWeekNames,
} from '@/server/services/sheets';

/** Roster + weekly case data. */
export const rosterRoutes = new Elysia({ name: 'roster' })
  .get('/officers', () => getOfficers())

  .get('/weeks', () => getWeekNames())

  .get('/week-data', ({ query }) => getWeekData(query.name), {
    query: t.Object({ name: t.String({ minLength: 1 }) }),
  })

  .get('/week-top10', () => getLatestWeekTop10());
