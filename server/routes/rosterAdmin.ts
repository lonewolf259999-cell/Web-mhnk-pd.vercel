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
  updateStatusMany,
  type ExitReason,
} from '@/server/services/roster';
import { ApiError } from '@/server/errors';
import {
  ROSTER_MANAGE,
  checkPermission,
  requirePermission,
} from '@/server/services/permissions';
import { logEvent } from '@/server/services/opsLog';

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
      await logEvent('INFO', 'roster', `เปลี่ยนสถานะ แถว ${params.row} → "${body.status}"`, {
        actor,
      });

      const display = body.status || '✅ ปกติ';
      return { success: true, message: `อัปเดตสถานะเป็น "${display}" แล้ว` };
    },
    { params: rowParam, body: t.Object({ status: t.String() }) }
  )

  /* The console's bulk action: tick several people, pick one status. Kept a
     separate path from /roster/status/:row so Eden has no static-vs-param
     ambiguity to resolve, and so the single-row call keeps its own shape.

     One request, one Sheets write and one log line for the whole batch — the
     per-row loop it replaces would have spent a write and a log line each, and
     opsLog caps itself at 20 sheet writes a minute. */
  .put(
    '/roster/status-bulk',
    async ({ body, request }) => {
      const actor = await requirePermission(request, ROSTER_MANAGE);
      if (body.status !== '') assertReason(body.status);

      /* Row 1 is the header and the client sends sheet row numbers, so anything
         below 2 is a bug on the way in rather than a row to overwrite. */
      const rows = [...new Set(body.rows)].filter((row) => Number.isInteger(row) && row >= 2);
      if (rows.length === 0) throw new ApiError('ไม่มีแถวที่ถูกต้องให้อัปเดต', 400);

      await updateStatusMany(rows, body.status);

      const display = body.status || '✅ ปกติ';
      await logEvent(
        'INFO',
        'roster',
        `เปลี่ยนสถานะ ${rows.length} คน → "${body.status}" (แถว ${rows.join(', ')})`,
        { actor }
      );

      return {
        success: true,
        message: `อัปเดตสถานะ ${rows.length} คน เป็น "${display}" แล้ว`,
        data: { rows },
      };
    },
    {
      body: t.Object({
        /* The cap is what keeps one click from turning into an unbounded write;
           the page offers nothing that selects more than a screen's worth. */
        rows: t.Array(t.Numeric(), { minItems: 1, maxItems: 200 }),
        status: t.String(),
      }),
    }
  )

  .post(
    '/roster/move-out/:row',
    async ({ params, body, request }) => {
      const actor = await requirePermission(request, ROSTER_MANAGE);
      const reason = assertReason(body.reason);

      const result = await moveToOutDC(params.row, reason);
      await logEvent(
        'INFO',
        'roster',
        `ย้ายออกจากระบบ แถว ${params.row} — ${result.code} ${result.name} (${reason})`,
        { actor }
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
