/* Roster management — the /rostermanage console.

   Gated by a Discord id allowlist held in the sheet, not by ADMIN_PIN: see
   services/permissions.ts for why, and for where the list lives. The pending
   registration routes that used to sit here moved to routes/pending.ts. */

import { Elysia, t } from 'elysia';
import {
  getNamePDMembers,
  getOutDCMembers,
  isAnnounced,
  isExitReason,
  moveManyToOutDC,
  moveToOutDC,
  sendExitWebhook,
  updateStatus,
  updateStatusMany,
  type ExitReason,
  type MovedMember,
} from '@/server/services/roster';
import { ApiError } from '@/server/errors';
import {
  ROSTER_MANAGE,
  checkPermission,
  requirePermission,
} from '@/server/services/permissions';
import { logEvent } from '@/server/services/opsLog';

const rowParam = t.Object({ row: t.Numeric() });

/** How long a bulk move spends announcing before it gives up on the rest. */
const ANNOUNCE_BUDGET_MS = 5_000;

/* Two caps, because a departure's cost depends on its reason.

   Headcount is limited only by how large one request may get: the Sheets work
   is four calls either way, but the read names every row in its query string
   and the clear names five ranges per row, and one clear is what keeps the
   batch all-or-nothing. Fifty keeps both comfortably small.

   The announced reasons are limited by time instead — one sequential Discord
   post each inside a ten-second function. That is the tighter of the two, and
   moveManyToOutDC checks it once it has read what each person's reason is. */
const MAX_BULK_MOVE = 50;
const MAX_BULK_ANNOUNCE = 20;

function assertReason(reason: string): ExitReason {
  if (!isExitReason(reason)) throw new ApiError('Invalid reason', 400);
  return reason;
}

/** Sheet row numbers, deduplicated; row 1 is the header, so anything below 2
    arrived broken rather than naming a row worth writing to. */
function cleanRows(rows: number[]): number[] {
  const clean = [...new Set(rows)].filter((row) => Number.isInteger(row) && row >= 2);
  if (clean.length === 0) throw new ApiError('ไม่มีแถวที่ถูกต้อง', 400);
  return clean;
}

/* The two reasons that get announced in Discord, one post per person exactly
   as a single departure does. Sequential, because a burst of webhook posts is
   what Discord rate-limits — and a failure here is reported, never thrown: the
   move already happened and an unsent announcement must not read as a failed
   move. */
async function announceDepartures(moved: MovedMember[]): Promise<string[]> {
  const warnings: string[] = [];
  const startedAt = Date.now();

  for (const member of moved) {
    if (!isAnnounced(member.reason)) continue;

    const discordId = member.discordId.replace(/[<@>]/g, '');
    if (!discordId) continue;

    /* Each post allows itself REQUEST_TIMEOUT, so a Discord that has gone slow
       could eat the whole function before the batch is through. The rows are
       already moved by this point, so stopping and saying which announcements
       did not go out is worth more than being killed with no response at all. */
    if (Date.now() - startedAt > ANNOUNCE_BUDGET_MS) {
      warnings.push(`${member.code} ${member.name}: ไม่ได้ส่งประกาศ (หมดเวลา)`);
      continue;
    }

    const sent = await sendExitWebhook(member.reason, discordId);
    if (!sent.success) warnings.push(`${member.code} ${member.name}: ${sent.error}`);
  }

  return warnings;
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

      const rows = cleanRows(body.rows);
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
  )

  /* Tick several, move them all out. No reason in the body: moveManyToOutDC
     takes each person's reason from their own status cell, so this cannot be
     asked to move someone out for something the sheet does not say. */
  .post(
    '/roster/move-out-bulk',
    async ({ body, request }) => {
      const actor = await requirePermission(request, ROSTER_MANAGE);

      const moved = await moveManyToOutDC(cleanRows(body.rows), {
        maxAnnounced: MAX_BULK_ANNOUNCE,
      });

      await logEvent(
        'INFO',
        'roster',
        `ย้ายออกจากระบบ ${moved.length} คน — ` +
          moved.map((m) => `${m.code} ${m.name} (${m.reason})`).join(', '),
        { actor, detail: { rows: moved.map((m) => m.row) } }
      );

      const warnings = await announceDepartures(moved);
      const suffix = warnings.length > 0 ? ` (⚠️ WebHook ไม่สำเร็จ ${warnings.length} ราย)` : '';

      return {
        success: true,
        message: `ย้ายออก ${moved.length} คน แล้ว${suffix}`,
        data: moved,
        warnings,
      };
    },
    {
      body: t.Object({
        rows: t.Array(t.Numeric(), { minItems: 1, maxItems: MAX_BULK_MOVE }),
      }),
    }
  );
