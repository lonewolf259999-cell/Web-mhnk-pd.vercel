import { Elysia, t } from 'elysia';
import scheduleConfig from '@/data/schedule.json';
import { markOfficerAsPaid } from '@/server/services/sheets';
import {
  clearPayment,
  getPayment,
  markProcessing,
  setPaymentResult,
} from '@/server/services/paymentStore';
import { ApiError, requirePin } from '@/server/errors';
import {
  ADMIN_TTL_MS,
  adminCookieHeader,
  createAdminToken,
  readAdminSession,
} from '@/server/services/session';

export const adminRoutes = new Elysia({ name: 'admin' })
  .get('/schedule-config', () => scheduleConfig)

  /* Checks a PIN and does nothing else, so the PIN prompt can reject a wrong
     code where it is typed instead of on the first real action. A wrong PIN
     is an answer rather than a failure — a lockout or an unset ADMIN_PIN
     still surfaces as an error, because those are not "try again". Attempts
     count toward requirePin's lockout exactly like any other admin call. */
  .post(
    '/pin/verify',
    ({ body, request, set }) => {
      const secure = new URL(request.url).protocol === 'https:';

      try {
        requirePin(body, request);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Drop any stale cookie so a wrong PIN also ends the old session.
          set.headers['set-cookie'] = adminCookieHeader('', 0, secure);
          return { valid: false, message: err.message };
        }
        throw err;
      }

      /* Hand back a short-lived HttpOnly cookie so the browser never has to
         keep the PIN itself. Every later admin call authorises on this. */
      set.headers['set-cookie'] = adminCookieHeader(
        createAdminToken(),
        Math.floor(ADMIN_TTL_MS / 1000),
        secure
      );

      return { valid: true, message: '' };
    },
    { body: t.Object({ pin: t.String() }) }
  )

  /* Is there a live admin cookie? Deliberately separate from /pin/verify:
     the page asks this on every load, and routing that through the PIN check
     would spend a lockout attempt each time and lock the admin out of their
     own console after ten refreshes. */
  .get('/pin/session', ({ request }) => ({ valid: readAdminSession(request) }))

  /* Ends the admin session server-side. The browser can't clear an HttpOnly
     cookie itself, so "lock" has to ask for it. */
  .post('/pin/logout', ({ request, set }) => {
    set.headers['set-cookie'] = adminCookieHeader(
      '',
      0,
      new URL(request.url).protocol === 'https:'
    );
    return { success: true };
  })

  .post(
    '/mark-paid',
    async ({ body, request }) => {
      requirePin(body, request);
      const { weekName, officerName, idempotencyKey } = body;

      if (idempotencyKey) {
        const prev = getPayment(idempotencyKey);
        if (prev?.status === 'processing') {
          return { success: false, processing: true, message: 'กำลังประมวลผล' };
        }
        if (prev) {
          return { success: prev.success ?? false, message: prev.message ?? '', idempotencyKey };
        }
        markProcessing(idempotencyKey);
      }

      try {
        const result = await markOfficerAsPaid(weekName, officerName);
        const message = `อัปเดตแถวที่ ${result.rowIndex} สำเร็จ`;
        if (idempotencyKey) setPaymentResult(idempotencyKey, true, message);
        return { success: true, message, idempotencyKey };
      } catch (err) {
        // Drop the key so a retry is allowed rather than pinned at "processing".
        if (idempotencyKey) clearPayment(idempotencyKey);
        throw err;
      }
    },
    {
      body: t.Object({
        pin: t.String(),
        weekName: t.String({ minLength: 1 }),
        officerName: t.String({ minLength: 1 }),
        idempotencyKey: t.Optional(t.String()),
      }),
    }
  )

  .get(
    '/mark-paid/status',
    ({ query }) => {
      const entry = getPayment(query.key);
      if (!entry) {
        return {
          success: false,
          found: false,
          error: 'ไม่พบสถานะการจ่ายเงิน (อาจไม่ถูกประมวลผล)',
        };
      }
      if (entry.status === 'processing') {
        return { success: false, found: true, processing: true, error: 'กำลังประมวลผล' };
      }
      return { success: entry.success ?? false, found: true, message: entry.message ?? '' };
    },
    { query: t.Object({ key: t.String({ minLength: 1 }) }) }
  );

export { ApiError };
