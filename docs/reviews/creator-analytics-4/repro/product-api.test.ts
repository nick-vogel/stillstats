// Pre-PR review 1 of creator-analytics#4, findings 5 and 6. Each test states the correct
// behaviour, so it is red until the finding is fixed.
import type { ListedChannel } from '@creator-analytics/api-types'
import { expect, test } from 'vitest'
import { createProductApi } from '../../../../apps/extension/src/product-api.ts'

const origin = 'https://stillstats.example'
const channel: ListedChannel = {
  id: 'channel-1',
  youtubeChannelId: 'UC123',
  title: 'Nick Vogel',
  handle: '@nick_vogel',
  revenueConsentedAt: null,
}

function fakeFetch(...replies: Response[]) {
  const urls: string[] = []
  const fetch = async (input: RequestInfo | URL): Promise<Response> => {
    urls.push(String(input))
    return replies.shift() ?? new Response(null, { status: 500 })
  }
  return { fetch, urls }
}

test('finding 5: once a video read answers 401, the next channel read asks the API again', async () => {
  const api = fakeFetch(
    Response.json({ channels: [channel] }),
    new Response(null, { status: 401 }),
    new Response(null, { status: 401 }),
  )
  const product = createProductApi({ origin, fetch: api.fetch, now: () => 1_000_000 })

  expect(
    await product.readVideos({ youtubeChannelId: 'UC123', ids: ['abc'], window: 'lifetime' }),
  ).toEqual({ state: 'signed-out' })
  expect(await product.readChannels()).toEqual({ state: 'signed-out' })
})

test('finding 6: a 200 channels answer with no channel list reads as failed, and a video read does not throw', async () => {
  const api = fakeFetch(Response.json({}))
  const product = createProductApi({ origin, fetch: api.fetch, now: () => 1_000_000 })

  await expect(
    product.readVideos({ youtubeChannelId: 'UC123', ids: ['abc'], window: 'lifetime' }),
  ).resolves.toEqual({ state: 'failed' })
})
