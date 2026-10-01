/* Log viewer — what /police/logs reads.
 *
 * Gated by ROSTER_MANAGE, the same allowlist as /police itself: the people who
 * already run the consoles are the people who need to see why one misbehaved.
 * It is a gate worth having rather than a formality — these lines carry the
 * Discord ids of serving officers and the shape of every admin action.
 *
 * Three sources, because they answer different questions:
 *   /logs/web       this app's own errors and admin actions   (sheet, 30 days)
 *   /logs/bot       the bot's important lines                 (sheet, 30 days)
 *   /logs/bot/live  the bot's full debug trail                (its memory, 24h)
 */

import { Elysia, t } from 'elysia';
import { ROSTER_MANAGE, requirePermission } from '@/server/services/permissions';
import {
  MAX_ROWS,
  fetchBotLiveLog,
  readBotSheetLog,
  readWebLog,
  type LogQuery,
} from '@/server/services/opsLog';

const logQuery = t.Object({
  /** Comma-separated: INFO, WARN, ERROR (and DEBUG for the bot's live log). */
  level: t.Optional(t.String()),
  context: t.Optional(t.String()),
  q: t.Optional(t.String()),
  limit: t.Optional(t.Numeric()),
});

function toQuery(query: {
  level?: string;
  context?: string;
  q?: string;
  limit?: number;
}): LogQuery {
  const levels = (query.level ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  return {
    levels: levels.length > 0 ? levels : undefined,
    context: query.context?.trim() || undefined,
    search: query.q?.trim() || undefined,
    limit: query.limit && query.limit > 0 ? Math.min(query.limit, MAX_ROWS) : undefined,
  };
}

export const logRoutes = new Elysia({ name: 'logs' })
  .get(
    '/logs/web',
    async ({ request, query }) => {
      await requirePermission(request, ROSTER_MANAGE);
      return readWebLog(toQuery(query));
    },
    { query: logQuery }
  )

  .get(
    '/logs/bot',
    async ({ request, query }) => {
      await requirePermission(request, ROSTER_MANAGE);
      return readBotSheetLog(toQuery(query));
    },
    { query: logQuery }
  )

  /* Reaches out to the bot over HTTP, so it fails in ways the sheet reads
     cannot — a sleeping or restarting bot, a token that no longer matches.
     opsLog turns each of those into a message the page can show as-is. */
  .get(
    '/logs/bot/live',
    async ({ request, query }) => {
      await requirePermission(request, ROSTER_MANAGE);
      return fetchBotLiveLog(toQuery(query));
    },
    { query: logQuery }
  );
