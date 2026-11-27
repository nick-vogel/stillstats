// creator-analytics#934 pre-PR review 1, finding 2. Run from the repo root:
//   pnpm exec vitest run --config docs/reviews/creator-analytics-934/repro/history-sort-dead-end.vitest.config.ts
// Red at a5a8a81c on both tests. A creator whose list is sorted by CTR keeps that sort through a
// switch to another channel, and a refusal of it, or an answer with no history to sort by, leaves
// the address on the sort: no heading shows to change it, and the window and format keep it.
// Green once the list leaves a history sort it cannot show for newest first, as it leaves a custom
// range the API refuses for the last 28 days.
import type { VideoListAnswer } from '@creator-analytics/api-types'
import { expect, test } from 'vitest'
import { routeToChannel } from '../../../../apps/web/src/channel-picker.ts'
import { listRouteOf, routeWithControl } from '../../../../apps/web/src/route.ts'
import { routeAfterListAnswerOf, videoListViewOf } from '../../../../apps/web/src/video-list.ts'

const ctrSorted = { ...listRouteOf('?sort=-ctr'), channel: 'c-pro' }

test('repro: a CTR sort carried to a free channel is refused with no way back to a sort', () => {
  const onFree = routeToChannel(ctrSorted, 'c-free')
  expect(onFree.sort).toBe('-ctr')
  expect(routeWithControl(onFree, { window: 'last7' }).sort).toBe('-ctr')
  expect(routeWithControl(onFree, { format: 'video' }).sort).toBe('-ctr')
  expect(videoListViewOf({ error: 'sort_without_history' })).toMatchObject({ historySort: true })
})

test('repro: a CTR sort on an answer without the history is left for newest first', () => {
  const answer = {
    videos: [],
    window: 'last28',
    page: 1,
    pageSize: 25,
    pageCount: 1,
    revenue: { reported: false },
  } as unknown as VideoListAnswer
  expect(routeAfterListAnswerOf(ctrSorted, answer).sort).toBe('-publishedAt')
})
