/* Roster management — the /rostermanage console.

   Gated by a Discord id allowlist held in the sheet, not by ADMIN_PIN: see
   services/permissions.ts for why, and for where the list lives. The pending
   registration routes that used to sit here moved to routes/pending.ts. */

import { Elysia, t } from 'elysia';
import {
  EXIT_REASONS,
  getNamePDMembers,
  getOutDCMembers,
  moveToOutDC,
  sendExitWebhook,
  updateStatus,
  type ExitReason,
} from '@/server/services/roster';
import { ApiError } from '@/server/errors';
import {
  ROSTER_MANAGE,
  checkPermission,
  requirePermission,
} from '@/server/services/permissions';

const rowParam = t.Object({ row: t.Numeric() });

function assertReason(reason: string): ExitReason {
  if (!EXIT_REASONS.includes(reason as ExitReason)) {
    throw new ApiError('Invalid reason', 400);
  }
  return reason as ExitReason;
}

export const rosterAdminRoutes = new Elysia({ name: 'roster-admin' })
  /* What the page asks on load: am I signed in, and am I on the list? It needs
     its own endpoint because the Discord session lives in an HttpOnly cookie
     the page cannot read — without this, every refresh would look like a
     logout. Answers instead of failing, so "sheet misconfigured" arrives as
     something the page can display. */
  .get('/roster/access', ({ request }) => checkPermission(request, ROSTER_MANAGE))

  .post('/roster/namepd', async ({ request }) => {
    await requirePermission(request, ROSTER_MANAGE);
    return { success: true, data: await getNamePDMembers() };
  })

  .post('/roster/outdc', async ({ request }) => {
    await requirePermission(request, ROSTER_MANAGE);
    return { success: true, data: await getOutDCMembers() };
  })

  .put(
    '/roster/status/:row',
    async ({ params, body, request }) => {
      const actor = await requirePermission(request, ROSTER_MANAGE);
      // An empty status clears the field back to "normal".
      if (body.status !== '') assertReason(body.status);

      await updateStatus(params.row, body.status);

      /* Every write is now attributable to one account, which is the point of
         the allowlist — so record who made it. */
      console.log(`[roster] ${actor} status row=${params.row} → "${body.status}"`);

      const display = body.status || '✅ ปกติ';
      return { success: true, message: `อัปเดตสถานะเป็น "${display}" แล้ว` };
    },
    { params: rowParam, body: t.Object({ status: t.String() }) }
  )

  .post(
    '/roster/move-out/:row',
    async ({ params, body, request }) => {
      const actor = await requirePermission(request, ROSTER_MANAGE);
      const reason = assertReason(body.reason);

      const result = await moveToOutDC(params.row, reason);
      console.log(
        `[roster] ${actor} move-out row=${params.row} ${result.code} ${result.name} (${reason})`
      );

      const warnings: string[] = [];
      if (reason === 'ถูกปลดออก' || reason === 'ติดต่อขอออก') {
        const discordId = result.discordId?.replace(/[<@>]/g, '') ?? '';
        if (discordId) {
          const sent = await sendExitWebhook(reason, discordId);
          if (!sent.success) warnings.push(`WebHook: ${sent.error}`);
        }
      }

      const suffix = warnings.length > 0 ? ` (⚠️ ${warnings.join('; ')})` : '';

      return {
        success: true,
        message: `ย้าย ${result.code} ${result.name} ออกแล้ว${suffix}`,
        data: result,
        warnings,
      };
    },
    { params: rowParam, body: t.Object({ reason: t.String() }) }
  );
