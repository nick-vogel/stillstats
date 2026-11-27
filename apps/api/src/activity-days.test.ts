// Limits: these tests read from the fake Google server, so they cannot prove that a real read of
// a channel's numbers on the deployed product records its day. Nick reading his own channel on
// staging, then finding the day in the active user counts (#659), covers it.
import { activityDays, quotaUsage, type WorkerDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import type { FakeUpload } from '@creator-analytics/fake-google'
import { quotaDayOf } from '@creator-analytics/youtube-gateway'
import { describe, expect } from 'vitest'
import { Browser } from '../test/browser.ts'
import { channelsOf, connect, savePreferences, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'

// Emails no other test file signs in with. Test files run in parallel against one database, and
// two files that sign in the same emails in a different order deadlock on the unique email index.
const creator = { sub: '307656', email: 'activity-reader@example.com', name: 'A Reader' }
const otherCreator = {
  sub: '407656',
  email: 'other-activity-reader@example.com',
  name: 'Another Reader',
}

// Noon on 2026-11-11 in Pacific Time, so the UTC day is 2026-11-11 too.
const noonToday = new Date('2026-11-11T20:00:00Z')

const upload: FakeUpload = {
  videoId: 'video-1',
  title: 'Upload 1',
  publishedAt: '2026-09-01T15:00:00Z',
}

/** Signs the creator in and connects their channel, which holds one upload. */
async function connectedCreator(api: StartedApi, user = creator) {
  const browser = await signIn(api, user)
  const youtubeChannelId = `UC-${user.sub}`
  api.google.pickChannel(youtubeChannelId)
  api.google.setChannel(youtubeChannelId, {
    createdAt: '2019-03-01T06:00:00Z',
    uploads: [upload],
  })
  await connect(browser)
  const { channels } = await channelsOf(browser)
  const channelId = channels[0]?.id
  if (!channelId) throw new Error('The creator has no connected channel')
  return { browser, channelId }
}

/** Every activity day, as the system scope reads them: the web role reads none. */
function readActivityDays(worker: WorkerDatabase) {
  return worker.asSystem((scope) =>
    scope.sql
      .select({ userId: activityDays.userId, day: activityDays.day })
      .from(activityDays)
      .orderBy(activityDays.userId, activityDays.day),
  )
}

/** The four routes that read a channel's numbers. */
const channelReads = [
  ['the video list', (channelId: string) => `/api/channels/${channelId}/videos`],
  ['a video detail', (channelId: string) => `/api/channels/${channelId}/videos/${upload.videoId}`],
  ['the channel summary', (channelId: string) => `/api/channels/${channelId}/summary`],
  ['the audience', (channelId: string) => `/api/channels/${channelId}/audience`],
] as const

describe('seam 1: a signed-in read of a channel records an activity day', () => {
  test.for(channelReads)(
    'a signed-in read of %s leaves one activity day for the user, on the UTC day',
    async ([, pathOf], { web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      expect(await readActivityDays(worker)).toEqual([])

      const response = await browser.fetch(pathOf(channelId))

      expect(response.status).toBe(200)
      const userId = await userIdOf(web, creator.email)
      expect(await readActivityDays(worker)).toEqual([{ userId, day: '2026-11-11' }])
    },
  )

  test('a second read on the same UTC day leaves one row, and a read on the next UTC day adds a second, even on the same Pacific day', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const userId = await userIdOf(web, creator.email)

    expect((await browser.fetch(`/api/channels/${channelId}/summary`)).status).toBe(200)
    clock.set(new Date('2026-11-11T23:59:00Z'))
    // The second read answers as the first did: its day already recorded fails nothing.
    expect((await browser.fetch(`/api/channels/${channelId}/videos`)).status).toBe(200)
    expect(await readActivityDays(worker)).toEqual([{ userId, day: '2026-11-11' }])

    // 16:30 on 2026-11-11 in Pacific Time, and already 2026-11-12 in UTC.
    clock.set(new Date('2026-11-12T00:30:00Z'))
    expect((await browser.fetch(`/api/channels/${channelId}/summary`)).status).toBe(200)

    expect(await readActivityDays(worker)).toEqual([
      { userId, day: '2026-11-11' },
      { userId, day: '2026-11-12' },
    ])
  })

  test('a read of a channel the user does not hold, refused as not connected, still leaves the row', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { channelId } = await connectedCreator(api)
    const other = await signIn(api, otherCreator)

    const response = await other.fetch(`/api/channels/${channelId}/summary`)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ refusal: 'not_connected' })
    const otherId = await userIdOf(web, otherCreator.email)
    expect(await readActivityDays(worker)).toEqual([{ userId: otherId, day: '2026-11-11' }])
  })

  test('a read refused by the quota reservation still leaves the row', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    // 90% of the Data API's 10,000 units a day, all spent.
    await web.asUser('quota-writer', (tx) =>
      tx.sql
        .insert(quotaUsage)
        .values({ api: 'data', quotaDay: quotaDayOf(tx.now), units: 9_000 })
        .onConflictDoUpdate({
          target: [quotaUsage.api, quotaUsage.quotaDay],
          set: { units: 9_000 },
        }),
    )

    const response = await browser.fetch(`/api/channels/${channelId}/videos`)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ refusal: 'quota_reserved' })
    const userId = await userIdOf(web, creator.email)
    expect(await readActivityDays(worker)).toEqual([{ userId, day: '2026-11-11' }])
  })

  test('a read with an invalid window, refused before any read, still leaves the row', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    const response = await browser.fetch(`/api/channels/${channelId}/summary?window=bogus`)

    expect(response.status).toBe(400)
    const userId = await userIdOf(web, creator.email)
    expect(await readActivityDays(worker)).toEqual([{ userId, day: '2026-11-11' }])
  })

  test.for(channelReads)(
    'a signed-out read of %s answers 401 and leaves no row',
    async ([, pathOf], { web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { channelId } = await connectedCreator(api)
      const signedOut = new Browser(api.origin)

      const response = await signedOut.fetch(pathOf(channelId))

      expect(response.status).toBe(401)
      expect(await readActivityDays(worker)).toEqual([])
    },
  )

  test('/me, the channel list, the preferences, POST /api/events and the support route leave no row', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser } = await connectedCreator(api)

    const statuses = [
      (await browser.fetch('/api/me')).status,
      (await browser.fetch('/api/channels')).status,
      (await browser.fetch('/api/me/preferences')).status,
      (await savePreferences(browser, { pageSize: 25 })).status,
      (
        await browser.fetch('/api/events', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'track', payload: { name: 'extension_installed' } }),
        })
      ).status,
      (await browser.fetch('/api/me/support')).status,
    ]

    // Each route answered the signed-in user rather than refusing the session.
    expect(statuses).not.toContain(401)
    expect(await readActivityDays(worker)).toEqual([])
  })

  test('"Delete me" leaves none of the user\'s activity days and keeps another user\'s', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const other = await connectedCreator(api, otherCreator)
    await browser.fetch(`/api/channels/${channelId}/summary`)
    await other.browser.fetch(`/api/channels/${other.channelId}/summary`)
    expect(await readActivityDays(worker)).toHaveLength(2)

    const response = await browser.fetch('/api/me', { method: 'DELETE' })

    expect(response.status).toBe(200)
    const otherId = await userIdOf(web, otherCreator.email)
    expect(await readActivityDays(worker)).toEqual([{ userId: otherId, day: '2026-11-11' }])
  })
})
