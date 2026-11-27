// The store screenshots' sample data (creator-analytics#100): Studio's own views beside the engaged
// views the stub answers the extension, on each surface the screenshots show. Limits: these check
// the data the swap writes into the saved pages, not the screenshots drawn from them, which the
// capture checks for what the saved page held, and Nick checks by eye.
import type { VideoListAnswer, VideoWindow } from '@creator-analytics/api-types'
import { expect, test } from 'vitest'
import { sampleChannel } from '../../../site/test/screenshot/sample-channel.ts'
import {
  analyticsVideo,
  contentListDataOf,
  dashboardDataOf,
  videoAnalyticsDataOf,
} from './sample-studio.ts'
import { publishedVideos, stubProductApi } from './stub-product-api.ts'

const savedChannelId = 'UCsavedChannelIdForTests'

function engagedViewsOf(id: string, window: VideoWindow): number {
  const url = `https://stillstats.com/api/channels/${sampleChannel.id}/videos?ids=${id}&window=${window}`
  const { body } = stubProductApi().answer({ method: 'GET', url })
  const row = (body as VideoListAnswer).videos[0]
  if (!row) throw new Error(`The stub has no ${id}`)
  return row.engagedViews
}

const countOf = (text: string) => Number(text.replaceAll(',', ''))

test("every Content list row's views are at least the lifetime engaged views beside them", () => {
  const { rows } = contentListDataOf(savedChannelId, publishedVideos, 30)

  for (const row of rows) {
    expect(countOf(row.views)).toBeGreaterThanOrEqual(engagedViewsOf(row.id, 'lifetime'))
  }
})

test("the latest video card's views are at least its lifetime engaged views", () => {
  const { card } = dashboardDataOf(savedChannelId, publishedVideos)

  expect(countOf(card.views)).toBeGreaterThanOrEqual(engagedViewsOf(card.id, 'lifetime'))
})

test("the analytics page's views over Studio's last 90 days are at least the engaged views over the API's", () => {
  const data = videoAnalyticsDataOf(savedChannelId, 'savedVideoId', analyticsVideo)

  expect(countOf(data.views)).toBeGreaterThanOrEqual(engagedViewsOf(analyticsVideo.id, 'last90'))
})

test('no sample text a screenshot shows holds an em-dash', () => {
  const pages = [
    dashboardDataOf(savedChannelId, publishedVideos),
    contentListDataOf(savedChannelId, publishedVideos, 30),
    videoAnalyticsDataOf(savedChannelId, 'savedVideoId', analyticsVideo),
  ]

  expect(JSON.stringify(pages)).not.toContain(String.fromCodePoint(0x2014))
})
