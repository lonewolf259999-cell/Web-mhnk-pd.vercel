import { Elysia } from 'elysia';
import { ApiError } from './errors';
import { logEvent } from './services/opsLog';
import { rosterRoutes } from './routes/roster';
import { rulesRoutes } from './routes/rules';
import { adminRoutes } from './routes/admin';
import { registrationRoutes } from './routes/registration';
import { rosterAdminRoutes } from './routes/rosterAdmin';
import { pendingRoutes } from './routes/pending';
import { logRoutes } from './routes/logs';

/**
 * The API, mounted into Next.js at app/api/[[...slugs]]/route.ts.
 *
 * Elysia runs here through `.handle(request)` rather than `.listen()`, so it
 * needs no Bun runtime — both Elysia and Next route handlers speak the
 * standard Request/Response pair.
 */
export const api = new Elysia({ prefix: '/api' })
  .onError(async ({ error, code, set }) => {
    if (error instanceof ApiError) {
      set.status = error.status;
      return { error: error.message };
    }

    if (code === 'VALIDATION') {
      set.status = 400;
      return { error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'ไม่พบ endpoint ที่ร้องขอ' };
    }

    const message = error instanceof Error ? error.message : 'Unexpected error';
    /* Awaited rather than fired and forgotten: a serverless instance can be
       frozen the moment the response goes out, which drops work still in
       flight. This path has already failed, so the extra wait costs nothing
       anyone was waiting on, and opsLog caps how often it reaches the sheet. */
    await logEvent('ERROR', 'api', message);
    set.status = 500;
    return { error: message };
  })
  .use(rosterRoutes)
  .use(rulesRoutes)
  .use(adminRoutes)
  .use(registrationRoutes)
  .use(rosterAdminRoutes)
  .use(pendingRoutes)
  .use(logRoutes);

/** Consumed by Eden Treaty on the client for end-to-end types. */
export type Api = typeof api;
