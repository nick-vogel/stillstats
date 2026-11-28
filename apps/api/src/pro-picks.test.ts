// Limits: these pick and unpick through the API in one test transaction, so they cannot show two
// tabs picking the last free slot at once on two connections; the row lock that orders them is
// Postgres's, and packages/database/test/pro-picks-locks.test.ts runs two picks at once on two
// connections and shows the second waits for the first and counts its pick.
import type {
  ChannelSummaryAnswer,
  EntitlementsAnswer,
  RefusalAnswer,
} from '@creator-analytics/api-types'
import {
  memberships,
  reachHistory,
  reachHistoryDays,
  type WebDatabase,
  type WorkerDatabase,
} from '@creator-analytics/database'
import { grantBlocks, test } from '@creator-analytics/database/testing'
import { eq } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'
import { deliverStripeEvent, subscriptionCheckoutEvent, testBilling } from '../test/stripe.ts'

// Emails no other test file signs in with.
const picker = { sub: '967729', email: 'pick-owner@example.com', name: 'A Picking Owner' }
const otherOwner = { sub: '968729', email: 'pick-other@example.com', name: 'Another Owner' }

const now = new Date('2026-11-26T12:00:00.000Z')
// 30 days after `now`, when a channel taken out of its block then is purged.
const purgeDate = '2026-12-26T12:00:00.000Z'

/** The browser's user connects a new channel, and answers its ID. */
async function connectChannel(api: StartedApi, browser: Browser, youtubeChannelId: string) {
  const before = new Set((await channelsOf(browser)).channels.map(({ id }) => id))
  api.google.pickChannel(youtubeChannelId)
  await connect(browser)
  const added = (await channelsOf(browser)).channels.find(({ id }) => !before.has(id))
  if (!added) throw new Error('The connect flow connected no channel')
  return added.id
}

/**
 * The picker's `count` channels, connected in order, and one more another user owns that the
 * picker holds as a member, with the IDs in connection order.
 */
async function pickerWithChannels(
  web: WebDatabase,
  worker: WorkerDatabase,
  api: StartedApi,
  count: number,
) {
  const browser = await signIn(api, picker)
  const owned: string[] = []
  for (let n = 1; n <= count; n++) owned.push(await connectChannel(api, browser, `UC-pick-${n}`))
  const userId = await userIdOf(web, picker.email)
  // The test's one transaction gives every membership the connect writes the same now(), where
  // production gives each connect its own, so each channel gets its connection time here.
  for (const [n, channelId] of owned.entries()) {
    await worker.forChannel(channelId, (tx) =>
      tx.sql
        .update(memberships)
        .set({ createdAt: new Date(Date.UTC(2026, 10, 1, 12, n)) })
        .where(eq(memberships.channelId, channelId)),
    )
  }
  const other = await signIn(api, otherOwner)
  const held = await connectChannel(api, other, 'UC-pick-held')
  // A membership with a role other than owner, inserted as checkout.test.ts explains.
  await worker.forChannel(held, (tx) =>
    tx.sql.insert(memberships).values({ channelId: held, userId, role: 'member' as 'owner' }),
  )
  return { browser, userId, owned, held }
}

async function subscribe(api: StartedApi, userId: string) {
  const response = await deliverStripeEvent(api, subscriptionCheckoutEvent({ userId }))
  expect(response.status).toBe(200)
}

function pick(browser: Browser, channelId: string) {
  return browser.fetch(`/api/channels/${channelId}/pro-pick`, { method: 'PUT' })
}

function unpick(browser: Browser, channelId: string) {
  return browser.fetch(`/api/channels/${channelId}/pro-pick`, { method: 'DELETE' })
}

async function entitlementsOf(browser: Browser): Promise<EntitlementsAnswer> {
  const response = await browser.fetch('/api/me/entitlements')
  expect(response.status).toBe(200)
  return (await response.json()) as EntitlementsAnswer
}

/** Each channel's tier, pick and purge date, in the order of the IDs given. */
function picksOf(answer: EntitlementsAnswer, ids: string[]) {
  return ids.map((id) => {
    const channel = answer.channels.find(({ channelId }) => channelId === id)
    return channel && { tier: channel.tier, picked: channel.picked, purgeDate: channel.purgeDate }
  })
}

const paid = { tier: 'paid', picked: true, purgeDate: null }
const free = { tier: 'free', picked: false, purgeDate: null }

describe('seam 1: the owner picks and unpicks their Pro channels (stillstats#21)', () => {
  test('an owner with a fifth, free channel takes one out and picks the fifth, and each answer redraws Settings with the purge date of the one taken out', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(now)
    const api = await startApi(web, { billing: testBilling })
    const { browser, userId, owned } = await pickerWithChannels(web, worker, api, 5)
    await subscribe(api, userId)
    const [first = '', , , , fifth = ''] = owned

    const unpicked = await unpick(browser, first)
    const unpickedAnswer = (await unpicked.json()) as EntitlementsAnswer
    const picked = await pick(browser, fifth)
    const pickedAnswer = (await picked.json()) as EntitlementsAnswer

    expect(unpicked.status).toBe(200)
    expect({ blocks: unpickedAnswer.blocks, slotsInUse: unpickedAnswer.slotsInUse }).toEqual({
      blocks: 1,
      slotsInUse: 3,
    })
    expect(picksOf(unpickedAnswer, owned)).toEqual([
      { tier: 'free', picked: false, purgeDate },
      paid,
      paid,
      paid,
      free,
    ])
    expect(picked.status).toBe(200)
    expect(pickedAnswer.slotsInUse).toBe(4)
    expect(picksOf(pickedAnswer, owned)).toEqual([
      { tier: 'free', picked: false, purgeDate },
      paid,
      paid,
      paid,
      paid,
    ])
    expect(pickedAnswer).toEqual(await entitlementsOf(browser))
  })

  test('a pick with every slot in use answers 409 no_free_slot and changes nothing', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, userId, owned } = await pickerWithChannels(web, worker, api, 5)
    await subscribe(api, userId)
    const before = await entitlementsOf(browser)

    const response = await pick(browser, owned[4] ?? '')

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ refusal: 'no_free_slot' } satisfies RefusalAnswer)
    expect(await entitlementsOf(browser)).toEqual(before)
  })

  test('a pick without a subscription answers 409 no_free_slot', async ({ web, worker }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, owned } = await pickerWithChannels(web, worker, api, 1)

    const response = await pick(browser, owned[0] ?? '')

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ refusal: 'no_free_slot' })
  })

  test("a member who isn't the owner is refused 403 on both routes, and a channel not held 404", async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, userId, held } = await pickerWithChannels(web, worker, api, 1)
    await subscribe(api, userId)
    const notOwner = { refusal: 'not_owner' }
    const notConnected = { refusal: 'not_connected' }

    const answers = []
    for (const response of [
      await pick(browser, held),
      await unpick(browser, held),
      await pick(browser, '0b2f0e5e-7a4c-4f57-9d55-6b1d2b0a4c11'),
      await unpick(browser, 'not-a-channel-id'),
    ]) {
      answers.push({ status: response.status, body: await response.json() })
    }

    expect(answers).toEqual([
      { status: 403, body: notOwner },
      { status: 403, body: notOwner },
      { status: 404, body: notConnected },
      { status: 404, body: notConnected },
    ])
    expect(picksOf(await entitlementsOf(browser), [held])).toEqual([free])
  })

  test('a pick before the purge date answers the channel paid with no purge date, and its history still reads', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(now)
    const api = await startApi(web, { billing: testBilling })
    const { browser, userId, owned } = await pickerWithChannels(web, worker, api, 1)
    await subscribe(api, userId)
    const [channelId = ''] = owned
    await worker.forChannel(channelId, async (tx) => {
      await tx.sql.insert(reachHistory).values({
        channelId,
        trafficSourceType: 5,
        videoId: 'v-video',
        day: '2026-11-20',
        impressions: 100,
        ctr: 0.1,
      })
      await tx.sql
        .insert(reachHistoryDays)
        .values({ channelId, day: '2026-11-20', reportCreatedAt: tx.now })
    })
    const historyOf = async () => {
      const response = await browser.fetch(
        `/api/channels/${channelId}/summary?window=custom&from=2026-11-19&to=2026-11-21`,
      )
      expect(response.status).toBe(200)
      return ((await response.json()) as ChannelSummaryAnswer).history
    }

    await unpick(browser, channelId)
    const ended = await historyOf()
    clock.set(new Date('2026-12-10T12:00:00.000Z'))
    const response = await pick(browser, channelId)

    expect(ended).toMatchObject({ firstDay: '2026-11-20', purgeDate: '2026-12-26' })
    expect(response.status).toBe(200)
    expect(picksOf((await response.json()) as EntitlementsAnswer, [channelId])).toEqual([paid])
    expect(await historyOf()).toEqual({
      impressions: 100,
      ctr: 0.1,
      firstDay: '2026-11-20',
      newestDay: '2026-11-20',
    })
  })
})

describe('seam 1: a newly connected channel fills a free slot by itself (stillstats#21)', () => {
  test('channels connected with no subscription stay unpicked; with one block and those 3 picked, a fourth connected is picked and paid, and a fifth then stays free and unpicked', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, userId, owned } = await pickerWithChannels(web, worker, api, 3)
    const unsubscribed = picksOf(await entitlementsOf(browser), owned)
    await subscribe(api, userId)

    const fourth = await connectChannel(api, browser, 'UC-pick-4')
    const fifth = await connectChannel(api, browser, 'UC-pick-5')

    const answer = await entitlementsOf(browser)
    expect(unsubscribed).toEqual([free, free, free])
    expect(picksOf(answer, [...owned, fourth, fifth])).toEqual([paid, paid, paid, paid, free])
    expect(answer.slotsInUse).toBe(4)
  })
})

describe('seam 1: a user with a Pro grant and no subscription picks into the granted slots (stillstats#24)', () => {
  test('the grant fills 4 channels, the owner takes one out and picks the fifth, and a pick past the 4 is refused no_free_slot', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(now)
    const api = await startApi(web, { billing: testBilling })
    const { browser, owned } = await pickerWithChannels(web, worker, api, 5)
    await grantBlocks(web, { email: picker.email, blocks: 1 })
    const [first = '', , , , fifth = ''] = owned

    const refused = await pick(browser, fifth)
    const unpicked = await unpick(browser, first)
    const picked = await pick(browser, fifth)

    expect(refused.status).toBe(409)
    expect(await refused.json()).toEqual({ refusal: 'no_free_slot' } satisfies RefusalAnswer)
    expect(unpicked.status).toBe(200)
    expect(picked.status).toBe(200)
    const answer = (await picked.json()) as EntitlementsAnswer
    expect(answer).toMatchObject({
      blocks: 0,
      grants: [{ blocks: 1, endsAt: null }],
      slotsInUse: 4,
    })
    expect(picksOf(answer, owned)).toEqual([
      { tier: 'free', picked: false, purgeDate },
      paid,
      paid,
      paid,
      paid,
    ])
  })
})
