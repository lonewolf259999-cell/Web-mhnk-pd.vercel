/* Pending registrations — the /proctor console.

   Split out of rosterAdmin.ts when the two consoles moved off ADMIN_PIN onto
   Discord allowlists: they had no reason to share a module beyond having once
   shared a gate. This half authorises on the list at Pending!I1:J1 — see
   services/permissions.ts. */

import { Elysia, t } from 'elysia';
import {
  approvePending,
  getPendingRegistrations,
  rejectPending,
} from '@/server/services/pending';
import { sendProctorRecord } from '@/server/services/discord';
import { ApiError } from '@/server/errors';
import { PROCTOR, checkPermission, requirePermission } from '@/server/services/permissions';

const rowParam = t.Object({ row: t.Numeric() });

export const pendingRoutes = new Elysia({ name: 'pending' })
  /* Asked on page load: am I signed in, and am I on the list? The Discord
     session is an HttpOnly cookie the page cannot read for itself. */
  .get('/pending/access', ({ request }) => checkPermission(request, PROCTOR))

  .post('/pending', async ({ request }) => {
    await requirePermission(request, PROCTOR);
    return { success: true, data: await getPendingRegistrations() };
  })

  .post(
    '/pending/approve/:row',
    async ({ params, request }) => {
      /* The proctor recorded on the approval is now the account that made the
         request, not an id the page put in the body. The old field could be
         set to anyone: every applicant's id is visible in Discord, so the
         record it produced was only ever as honest as the caller. */
      const proctorId = await requirePermission(request, PROCTOR);
      if (params.row < 1) throw new ApiError('ระบุหมายเลขแถวไม่ถูกต้อง', 400);

      const applicant = (await getPendingRegistrations()).find((r) => r._row === params.row);
      await approvePending(params.row);
      console.log(`[pending] ${proctorId} approved row=${params.row}`);

      // Notifying the proctor is best-effort; approval already succeeded.
      if (applicant) {
        void sendProctorRecord(
          { id: proctorId },
          {
            icName: String(applicant['ชื่อ IC'] ?? ''),
            discordId: String(applicant['Discord ID'] ?? ''),
          }
        ).catch((err) => console.error('[pending] proctor webhook failed:', err.message));
      }

      return { success: true, message: 'อนุมัติเรียบร้อย' };
    },
    { params: rowParam }
  )

  .post(
    '/pending/reject/:row',
    async ({ params, request }) => {
      const proctorId = await requirePermission(request, PROCTOR);
      if (params.row < 1) throw new ApiError('ระบุหมายเลขแถวไม่ถูกต้อง', 400);

      await rejectPending(params.row);
      console.log(`[pending] ${proctorId} rejected row=${params.row}`);

      return { success: true, message: 'ปฏิเสธเรียบร้อย' };
    },
    { params: rowParam }
  );
