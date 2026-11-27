// Pre-PR review 1 finding 1: in the lifetime window, the list row and the detail of one video with
// no publish day disagree. Green means the defect is present; it goes red once they agree.
import { expect } from 'vitest'
import { channelsOf, connect, signIn } from '../../../../apps/api/test/flows.ts'
import { startApi } from '../../../../apps/api/test/start-api.ts'
import { test } from '../../../../packages/database/test/harness.ts'

const creator = { sub: '906265', email: 'repro-265@example.com', name: 'A Reproducer' }

test('a private draft with no publish day shows views on its list row and none in its detail, in lifetime', async ({
  web,
  clock,
}) => {
  clock.set(new Date('2026-10-07T19:00:00Z'))
  const api = await startApi(web)
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-repro265')
  api.google.setChannel('UC-repro265', {
    createdAt: '2019-03-01T06:00:00Z',
    uploads: [
      {
        videoId: 'video-1',
        title: 'Draft',
        privacyStatus: 'private',
        metrics: {
          engagedViews: 1000,
          views: 1001,
          averageViewPercentage: 50,
          subscribersGained: 3,
          estimatedMinutesWatched: 40,
        },
      },
    ],
  })
  await connect(browser)
  const channelId = (await channelsOf(browser)).channels[0]?.id
  api.google.setLastProcessedDay('2026-10-04')

  const list = await (
    await browser.fetch(`/api/channels/${channelId}/videos?window=lifetime&visibility=all`)
  ).json()
  const detail = await (
    await browser.fetch(`/api/channels/${channelId}/videos/video-1?window=lifetime`)
  ).json()

  const row = list.videos.find((video: { id: string }) => video.id === 'video-1')
  expect(row?.publishedAt).toBeNull()
  expect(row?.views).toBeGreaterThan(0)
  expect(detail.totals.views).toBe(0)
})
