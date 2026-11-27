import {
  type ChannelSummaryAnswer,
  type ErrorAnswer,
  type ErrorCode,
  type SummaryRequest,
  type SummaryWindow,
  videoWindows,
  visibilities,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import type { Hono } from 'hono'
import { recordActivityDay } from '../activity-days.ts'
import { summariseChannel } from '../channel-summary.ts'
import { isOneOf } from '../one-of.ts'
import {
  answerFailedRead,
  type ChannelReading,
  channelIdOf,
  refuse,
  type SignedIn,
} from '../signed-in.ts'
import { singleQueryOf } from '../single-query.ts'
import { channelQueryOf, repeatedChannelQueryRefusals } from '../window-query.ts'

const summaryWindows = videoWindows.filter(
  (window): window is SummaryWindow => !isOneOf(windowsAfterPublish, window),
)

// The summary's own parameter, visibility, is read after the channel-wide ones, so a query with a
// repeat or a bad value of two is refused for the first the checks read. The Audience answer shows
// no uploads, so it does not take it.
const repeatedSummaryRefusals = {
  ...repeatedChannelQueryRefusals,
  visibility: 'invalid_visibility',
} satisfies Record<string, ErrorCode>

/**
 * The summary's request: the channel-wide window, range and format (`channelQueryOf`), then a
 * visibility not among `visibilities` is `invalid_visibility`. Without one, `public`.
 */
function summaryRequestOf(
  query: Partial<Record<keyof typeof repeatedSummaryRefusals, string>>,
): { ok: true; request: SummaryRequest } | { ok: false; error: ErrorCode } {
  const parsed = channelQueryOf(summaryWindows, query)
  if (!parsed.ok) return parsed
  const { visibility = 'public' } = query
  if (!isOneOf(visibilities, visibility)) return { ok: false, error: 'invalid_visibility' }
  return { ok: true, request: { ...parsed.query, visibility } }
}

/** GET /api/channels/:channelId/summary. */
export function channelSummaryRoute(
  signedIn: Hono<SignedIn>,
  { database, gateway }: ChannelReading,
): void {
  signedIn.get('/channels/:channelId/summary', recordActivityDay(database), async (c) => {
    const single = singleQueryOf(c.req.queries(), repeatedSummaryRefusals)
    if (!single.ok) {
      return c.json({ error: single.error } satisfies ErrorAnswer, 400)
    }
    const parsed = summaryRequestOf(single.query)
    if (!parsed.ok) return c.json({ error: parsed.error } satisfies ErrorAnswer, 400)
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    const summary = await database.asUser(c.get('user').id, (tx) =>
      summariseChannel(gateway, tx, channelId, parsed.request),
    )
    if (!summary.ok) return answerFailedRead(c, summary)
    return c.json(summary.answer satisfies ChannelSummaryAnswer)
  })
}
