// Limits: these tests read from the fake Google server, so they cannot prove that Google's real
// `snippet.customUrl` holds the channel's handle. Google's channels resource page calls it "The
// channel's custom URL". Nick seeing his own channel's handle on the deployed product covers it.
import { quotaUsage } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import { quotaDayOf } from '@creator-analytics/youtube-gateway'
import { and, eq } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { channelsOf, connect, signIn } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'

// Emails no other test file signs in with. Test files run in parallel against one database, and
// two files that sign in the same emails in a different order deadlock on the unique email index.
const creator = { sub: '307211', email: 'namer@example.com', name: 'A Namer' }

/** Signs the creator in and connects their channel, which YouTube names as given. */
async function connectedCreator(api: StartedApi, name: { title?: string; handle?: string }) {
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-namer')
  api.google.setChannel('UC-namer', { createdAt: '2019-03-01T06:00:00Z', uploads: [], ...name })
  await connect(browser)
  return browser
}

describe('seam 1: the channel list names each channel', () => {
  test("each channel lists YouTube's title and handle for it", async ({ web }) => {
    const api = await startApi(web)
    const browser = await connectedCreator(api, { title: 'Nick Vogel', handle: '@nick_vogel' })

    expect(await channelsOf(browser)).toEqual({
      channels: [
        {
          id: expect.any(String),
          youtubeChannelId: 'UC-namer',
          revenueConsentedAt: null,
          title: 'Nick Vogel',
          handle: '@nick_vogel',
        },
      ],
    })
  })

  test('a channel with no handle lists its title and no handle', async ({ web }) => {
    const api = await startApi(web)
    const browser = await connectedCreator(api, { title: 'Nick Vogel' })

    const { channels } = await channelsOf(browser)

    expect(channels.map(({ title, handle }) => ({ title, handle }))).toEqual([
      { title: 'Nick Vogel', handle: null },
    ])
  })

  // A regression guard: the API checks no origin on a GET today, so these pass without any change
  // for the extension. They fail if an origin check ever refuses the extension's read. They cannot
  // show a browser sending the session cookie from an extension origin; creator-analytics#101 does.
  test.for([
    'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
    'moz-extension://2c127fa4-62c7-7e4f-90e5-472b45eecfdc',
  ])(
    'a signed-in read carrying the extension origin %s is not refused for its origin',
    async (origin, { web }) => {
      const api = await startApi(web)
      const browser = await connectedCreator(api, { title: 'Nick Vogel', handle: '@nick_vogel' })

      const response = await browser.fetch('/api/channels', { headers: { origin } })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        channels: [{ youtubeChannelId: 'UC-namer', title: 'Nick Vogel', handle: '@nick_vogel' }],
      })
    },
  )

  test('a second list inside the cache window makes no Data API call', async ({ web }) => {
    const api = await startApi(web)
    const browser = await connectedCreator(api, { title: 'Nick Vogel', handle: '@nick_vogel' })
    const first = await channelsOf(browser)
    const callsAfterFirst = api.google.dataApiRequests.length

    const second = await channelsOf(browser)

    expect(api.google.dataApiRequests).toHaveLength(callsAfterFirst)
    expect(second).toEqual(first)
  })

  test('a channel whose name read Google never answers still lists, with no title and no handle', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await connectedCreator(api, { title: 'Nick Vogel', handle: '@nick_vogel' })
    api.google.dropDataApi('/youtube/v3/channels')

    const response = await browser.fetch('/api/channels')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      channels: [
        {
          id: expect.any(String),
          youtubeChannelId: 'UC-namer',
          revenueConsentedAt: null,
          title: null,
          handle: null,
        },
      ],
    })
  })

  test('a channel whose name read is refused still lists, with no title and no handle', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await connectedCreator(api, { title: 'Nick Vogel', handle: '@nick_vogel' })
    // 90% of the Data API's 10,000 units a day, all spent.
    await web.asUser('quota-writer', (tx) =>
      tx.sql
        .update(quotaUsage)
        .set({ units: 9_000 })
        .where(and(eq(quotaUsage.api, 'data'), eq(quotaUsage.quotaDay, quotaDayOf(tx.now)))),
    )

    expect(await channelsOf(browser)).toEqual({
      channels: [
        {
          id: expect.any(String),
          youtubeChannelId: 'UC-namer',
          revenueConsentedAt: null,
          title: null,
          handle: null,
        },
      ],
    })
  })
})
