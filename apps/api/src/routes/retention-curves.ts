import {
  type ErrorAnswer,
  type ErrorCode,
  maxComparedCurves,
  type RetentionCurvesAnswer,
  type RetentionCurvesQuery,
} from '@creator-analytics/api-types'
import type { Hono } from 'hono'
import { recordActivityDay } from '../activity-days.ts'
import { readRetentionCurves } from '../retention-curves.ts'
import { type ChannelReading, channelIdOf, refuse, type SignedIn } from '../signed-in.ts'
import { singleQueryOf } from '../single-query.ts'

const repeatedRefusals = {
  ids: 'invalid_ids',
} satisfies Record<keyof RetentionCurvesQuery, ErrorCode>

/**
 * The ids of the `ids` parameter, in their order, duplicates collapsed; none when it is absent.
 * Undefined when it is empty, holds a malformed id, or has more than `maxComparedCurves` entries,
 * duplicates counted, as the video list counts its own.
 */
function idsOf(text: string | undefined): string[] | undefined {
  if (text === undefined) return []
  const ids = text.split(',')
  if (ids.length > maxComparedCurves || !ids.every((id) => /^[A-Za-z0-9_-]+$/.test(id))) {
    return undefined
  }
  return [...new Set(ids)]
}

/** GET /api/channels/:channelId/retention-curves. */
export function retentionCurvesRoute(
  signedIn: Hono<SignedIn>,
  { database, gateway }: ChannelReading,
): void {
  signedIn.get('/channels/:channelId/retention-curves', recordActivityDay(database), async (c) => {
    const single = singleQueryOf(c.req.queries(), repeatedRefusals)
    if (!single.ok) return c.json({ error: single.error } satisfies ErrorAnswer, 400)
    const ids = idsOf(single.query.ids)
    if (!ids) return c.json({ error: 'invalid_ids' } satisfies ErrorAnswer, 400)
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    const read = await database.asUser(c.get('user').id, (tx) =>
      readRetentionCurves(gateway, tx, channelId, ids),
    )
    if (!read.ok) {
      // The request is well formed, and turned away for the channel's Entitlement.
      if ('error' in read) return c.json({ error: read.error } satisfies ErrorAnswer, 403)
      return refuse(c, read.refusal)
    }
    return c.json(read.answer satisfies RetentionCurvesAnswer)
  })
}
