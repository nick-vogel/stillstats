import {
  type AudienceAnswer,
  type AudienceWindow,
  type ErrorAnswer,
  videoWindows,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import type { Hono } from 'hono'
import { recordActivityDay } from '../activity-days.ts'
import { audienceOf } from '../audience.ts'
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

const audienceWindows = videoWindows.filter(
  (window): window is AudienceWindow =>
    window !== 'lifetime' && !isOneOf(windowsAfterPublish, window),
)

/** GET /api/channels/:channelId/audience. */
export function audienceRoute(
  signedIn: Hono<SignedIn>,
  { database, gateway }: ChannelReading,
): void {
  signedIn.get('/channels/:channelId/audience', recordActivityDay(database), async (c) => {
    const single = singleQueryOf(c.req.queries(), repeatedChannelQueryRefusals)
    if (!single.ok) return c.json({ error: single.error } satisfies ErrorAnswer, 400)
    const parsed = channelQueryOf(audienceWindows, single.query)
    if (!parsed.ok) return c.json({ error: parsed.error } satisfies ErrorAnswer, 400)
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    const audience = await database.asUser(c.get('user').id, (tx) =>
      audienceOf(gateway, tx, channelId, parsed.query),
    )
    if (!audience.ok) return answerFailedRead(c, audience)
    return c.json(audience.answer satisfies AudienceAnswer)
  })
}
