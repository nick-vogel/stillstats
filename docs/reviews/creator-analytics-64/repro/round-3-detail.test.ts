// Pre-PR review 3 of creator-analytics#64, finding 1. States the correct behaviour, so it is red
// until the finding is fixed: the Since publish rows of a video do not depend on the window, so a
// custom range that ends before the publish day leaves their revenue in place.

import { describe, expect } from 'vitest'
import { channelsOf, connect, giveRevenueConsent, signIn } from '../../../../apps/api/test/flows.ts'
import { startApi } from '../../../../apps/api/test/start-api.ts'
import type { VideoDetailAnswer } from '../../../../packages/api-types/src/index.ts'
import { test } from '../../../../packages/database/test/harness.ts'

const creator = { sub: '306999', email: 'round-3-detailer@example.com', name: 'A Detailer' }

function dayOf(day: string, n: number) {
  return {
    day,
    engagedViews: n,
    views: 2 * n,
    estimatedMinutesWatched: 3 * n,
    estimatedRevenue: n / 100,
  }
}

describe('finding 1: a custom range before the publish day keeps the Since publish revenue', () => {
  test('the same video answers the same Since publish rows under lifetime and under a custom range before it was published', async ({
    web,
    clock,
  }) => {
    clock.set(new Date('2026-10-07T19:00:00Z'))
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-round-3')
    api.google.setChannel('UC-round-3', {
      createdAt: '2019-03-01T06:00:00Z',
      uploads: [
        {
          videoId: 'video-1',
          title: 'Upload 1',
          publishedAt: '2026-09-01T15:00:00Z',
          days: [dayOf('2026-09-01', 100), dayOf('2026-09-10', 50)],
        },
      ],
    })
    await connect(browser)
    const { channels } = await channelsOf(browser)
    const channelId = channels[0]?.id ?? ''
    await giveRevenueConsent(browser, channelId)
    api.google.setLastProcessedDay('2026-10-04')

    const read = async (query: string) =>
      (await (
        await browser.fetch(`/api/channels/${channelId}/videos/video-1?${query}`)
      ).json()) as VideoDetailAnswer

    const lifetime = await read('window=lifetime')
    const beforePublish = await read('window=custom&from=2025-01-01&to=2025-01-31')

    expect(lifetime.sincePublish.revenueCurrency).toBe('USD')
    expect(beforePublish.sincePublish).toEqual(lifetime.sincePublish)
  })
})
