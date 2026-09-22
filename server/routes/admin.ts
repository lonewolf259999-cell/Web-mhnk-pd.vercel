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

export const adminRoutes = new Elysia({ name: 'admin' })
  .get('/schedule-config', () => scheduleConfig)

  /* Checks a PIN and does nothing else, so the PIN prompt can reject a wrong
     code where it is typed instead of on the first real action. A wrong PIN
     is an answer rather than a failure — a lockout or an unset ADMIN_PIN
     still surfaces as an error, because those are not "try again". Attempts
     count toward requirePin's lockout exactly like any other admin call. */
  .post(
    '/pin/verify',
    ({ body, request }) => {
      try {
        requirePin(body, request);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          return { valid: false, message: err.message };
        }
        throw err;
      }

      return { valid: true, message: '' };
    },
    { body: t.Object({ pin: t.String() }) }
  )

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
