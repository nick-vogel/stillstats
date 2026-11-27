import {
  type ErrorAnswer,
  type ErrorCode,
  type VideoDetailAnswer,
  type VideoDetailQuery,
  videoWindows,
} from '@creator-analytics/api-types'
import type { Hono } from 'hono'
import { recordActivityDay } from '../activity-days.ts'
import {
  answerFailedRead,
  type ChannelReading,
  channelIdOf,
  refuse,
  type SignedIn,
} from '../signed-in.ts'
import { singleQueryOf } from '../single-query.ts'
import { videoDetail } from '../video-detail.ts'
import { windowChoiceOf } from '../window-query.ts'

const repeatedRefusals = {
  window: 'invalid_window',
  from: 'invalid_range',
  to: 'invalid_range',
} satisfies Record<keyof VideoDetailQuery, ErrorCode>

/** GET /api/channels/:channelId/videos/:videoId. */
export function videoDetailRoute(
  signedIn: Hono<SignedIn>,
  { database, gateway }: ChannelReading,
): void {
  signedIn.get('/channels/:channelId/videos/:videoId', recordActivityDay(database), async (c) => {
    const single = singleQueryOf(c.req.queries(), repeatedRefusals)
    if (!single.ok) {
      return c.json({ error: single.error } satisfies ErrorAnswer, 400)
    }
    const windowQuery = windowChoiceOf(videoWindows, single.query)
    if (!windowQuery.ok) return c.json({ error: windowQuery.error } satisfies ErrorAnswer, 400)
    const channelId = channelIdOf(c)
    if (!channelId) return refuse(c, 'not_connected')
    const detail = await database.asUser(c.get('user').id, (tx) =>
      videoDetail(gateway, tx, channelId, c.req.param('videoId'), windowQuery.choice),
    )
    if (!detail.ok) return answerFailedRead(c, detail)
    return c.json(detail.answer satisfies VideoDetailAnswer)
  })
}
