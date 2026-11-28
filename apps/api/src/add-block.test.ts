// Limits: the preview and the add run on the fake Stripe server, which prorates nothing and checks
// none of Stripe's rules for an update, so these tests show what the API asks Stripe for and what
// it records of the answer, not that Stripe prorates the block onto the next invoice under Managed
// Payments: the spike (stillstats#18) showed that in the sandbox, and the walk of Pro on
// production (stillstats#26) covers it there. They run in one test transaction, so they cannot
// show the webhook's event and the API's own record of the raise landing at once on two
// connections; record_user_subscription takes the user's subscription row first, so they wait on
// each other in production.
import type {
  BlockAddAnswer,
  BlockPreviewAnswer,
  EntitlementsAnswer,
  RefusalAnswer,
} from '@creator-analytics/api-types'
import { memberships, type WebDatabase, type WorkerDatabase } from '@creator-analytics/database'
import { type FindJobs, test } from '@creator-analytics/database/testing'
import type { FakeStripe } from '@creator-analytics/fake-stripe'
import { eq } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'
import {
  deliverStripeEvent,
  seedStripeSubscription,
  subscriptionCheckoutEvent,
  subscriptionDeletedEvent,
  subscriptionUpdatedEvent,
  testBilling,
} from '../test/stripe.ts'

// Emails no other test file signs in with.
const owner = { sub: '957729', email: 'block-owner@example.com', name: 'A Block Owner' }
const member = { sub: '958729', email: 'block-member@example.com', name: 'A Block Member' }

// A price other than either the test API sells, so an answer read from it is read from Stripe,
// not from the settings: the subscription keeps the price it was bought at (ADR 0022).
const keptPrice = 'price_test_block_kept'
const periodEnd = new Date('2026-12-17T12:00:00.000Z')
const periodEndSeconds = periodEnd.getTime() / 1000

function fakeStripeOf(api: StartedApi): FakeStripe {
  if (!api.fakeStripe) throw new Error('The test API started with Pro unset')
  return api.fakeStripe
}

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
 * The owner's `count` channels, connected in order, subscribed to one block at the kept price, as
 * the Checkout event records it and Stripe holds it.
 */
async function subscribedOwner(
  web: WebDatabase,
  worker: WorkerDatabase,
  api: StartedApi,
  count = 5,
) {
  const browser = await signIn(api, owner)
  const owned: string[] = []
  for (let n = 1; n <= count; n++) owned.push(await connectChannel(api, browser, `UC-block-${n}`))
  // The test's one transaction gives every membership the same now(), so each gets its own here.
  for (const [n, channelId] of owned.entries()) {
    await worker.forChannel(channelId, (tx) =>
      tx.sql
        .update(memberships)
        .set({ createdAt: new Date(Date.UTC(2026, 10, 1, 12, n)) })
        .where(eq(memberships.channelId, channelId)),
    )
  }
  const userId = await userIdOf(web, owner.email)
  const stripe = fakeStripeOf(api)
  stripe.addPrice({ id: keptPrice, unitAmount: 600, interval: 'month' })
  seedStripeSubscription(stripe, { userId, price: keptPrice, periodEnd })
  stripe.setProration('sub_test_stillstats', 350)
  const response = await deliverStripeEvent(api, subscriptionCheckoutEvent({ userId }))
  expect(response.status).toBe(200)
  return { browser, userId, owned, stripe }
}

/** A membership with a role other than owner, inserted as checkout.test.ts explains. */
async function addMember(web: WebDatabase, worker: WorkerDatabase, channelId: string) {
  const userId = await userIdOf(web, member.email)
  await worker.forChannel(channelId, (scope) =>
    scope.sql.insert(memberships).values({ channelId, userId, role: 'member' as 'owner' }),
  )
}

function preview(browser: Browser): Promise<Response> {
  return browser.fetch('/api/me/block-preview')
}

function addBlock(browser: Browser, body: unknown): Promise<Response> {
  return browser.postJson('/api/me/blocks', body)
}

async function entitlementsOf(browser: Browser): Promise<EntitlementsAnswer> {
  const response = await browser.fetch('/api/me/entitlements')
  expect(response.status).toBe(200)
  return (await response.json()) as EntitlementsAnswer
}

function tiersOf(answer: EntitlementsAnswer, ids: string[]) {
  return ids.map((id) => answer.channels.find(({ channelId }) => channelId === id)?.tier)
}

async function downloadsOf(findJobs: FindJobs, channelId: string) {
  return (await findJobs('ensureReportingJob')).filter((job) => job.data.channelId === channelId)
}

describe('seam 1: the owner previews one more block, read from Stripe (stillstats#22)', () => {
  test("the preview answers the subscription's own price and Stripe's prorated charge, and asks Stripe for the next invoice at one block more", async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, stripe } = await subscribedOwner(web, worker, api)

    const before = Math.floor(Date.now() / 1000)
    const response = await preview(browser)
    const after = Math.floor(Date.now() / 1000)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      blocks: 2,
      plan: 'monthly',
      price: { amount: 600, currency: 'usd' },
      prorated: { amount: 350, currency: 'usd' },
      periodEnd: periodEnd.toISOString(),
    } satisfies BlockPreviewAnswer)
    const [body] = stripe.invoicePreviews.map((params) => Object.fromEntries(params))
    expect(stripe.invoicePreviews).toHaveLength(1)
    expect(body).toEqual({
      subscription: 'sub_test_stillstats',
      'subscription_details[items][0][id]': 'si_sub_test_stillstats',
      'subscription_details[items][0][quantity]': '2',
      'subscription_details[proration_behavior]': 'create_prorations',
      'subscription_details[proration_date]': expect.stringMatching(/^\d+$/),
    })
    const prorationDate = Number(body?.['subscription_details[proration_date]'])
    expect(prorationDate).toBeGreaterThanOrEqual(before)
    expect(prorationDate).toBeLessThanOrEqual(after)
    expect(stripe.subscriptionUpdates).toEqual([])
  })

  test("a second add in one period previews only its own prorated charge, not the first add's, which Stripe still holds pending", async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, stripe } = await subscribedOwner(web, worker, api)
    // The first add, ten days ago, leaves its proration pending on the next invoice.
    stripe.setNow(new Date(Date.now() - 10 * 86_400_000))
    await addBlock(browser, { blocks: 2 })

    const response = await preview(browser)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      blocks: 3,
      prorated: { amount: 350, currency: 'usd' },
    } satisfies Partial<BlockPreviewAnswer>)
  })
})

describe('seam 1: the owner adds a block, usable at once (stillstats#22)', () => {
  test('the confirm raises the quantity with its proration on the next invoice, under an idempotency key, and creates no invoice', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, stripe } = await subscribedOwner(web, worker, api)

    const response = await addBlock(browser, { blocks: 2 })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ blocks: 2 } satisfies BlockAddAnswer)
    expect(
      stripe.subscriptionUpdates.map(({ subscription, params, idempotencyKey }) => ({
        subscription,
        params: Object.fromEntries(params),
        idempotencyKey,
      })),
    ).toEqual([
      {
        subscription: 'sub_test_stillstats',
        params: {
          'items[0][id]': 'si_sub_test_stillstats',
          'items[0][quantity]': '2',
          proration_behavior: 'create_prorations',
        },
        idempotencyKey: `add-block-sub_test_stillstats-${periodEndSeconds}-2`,
      },
    ])
    expect(
      stripe.requests.filter(
        ({ method, path }) => method === 'POST' && path.startsWith('/v1/invoices'),
      ),
    ).toEqual([])
  })

  test("the new slots count in the next answer with no webhook delivered, and the fifth channel's history downloads now", async ({
    web,
    worker,
    findJobs,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, owned } = await subscribedOwner(web, worker, api)
    const fifth = owned[4] ?? ''
    // The connect queued the channel's first download; the add queues its own.
    const before = new Set((await downloadsOf(findJobs, fifth)).map(({ id }) => id))

    await addBlock(browser, { blocks: 2 })
    const answer = await entitlementsOf(browser)
    const sent = (await downloadsOf(findJobs, fifth)).filter(({ id }) => !before.has(id))

    expect({ blocks: answer.blocks, slotsInUse: answer.slotsInUse }).toEqual({
      blocks: 2,
      slotsInUse: 5,
    })
    expect(tiersOf(answer, owned)).toEqual(['paid', 'paid', 'paid', 'paid', 'paid'])
    expect(sent.map(({ data }) => data)).toEqual([{ channelId: fifth }])
  })

  test("the webhook's event of the raise changes nothing, and an older one at one block delivered late takes nothing back", async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, userId, owned } = await subscribedOwner(web, worker, api)
    await addBlock(browser, { blocks: 2 })

    const raised = await deliverStripeEvent(
      api,
      subscriptionUpdatedEvent({ userId, quantity: 2, price: keptPrice, periodEnd }),
    )
    const late = await deliverStripeEvent(
      api,
      subscriptionUpdatedEvent({
        userId,
        quantity: 1,
        price: keptPrice,
        periodEnd,
        created: new Date(Date.now() - 60_000),
      }),
    )
    const answer = await entitlementsOf(browser)

    expect([raised.status, late.status]).toEqual([200, 200])
    expect(answer.blocks).toBe(2)
    expect(tiersOf(answer, owned)).toEqual(owned.map(() => 'paid'))
  })

  test('a second confirm of the same preview, as a second click sends, is refused with blocks_changed and buys nothing', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, stripe } = await subscribedOwner(web, worker, api)
    await addBlock(browser, { blocks: 2 })

    const again = await addBlock(browser, { blocks: 2 })

    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({ refusal: 'blocks_changed' } satisfies RefusalAnswer)
    expect(stripe.subscriptionUpdates).toHaveLength(1)
    expect((await entitlementsOf(browser)).blocks).toBe(2)
  })

  test('a Stripe failure on the update answers 500 and records nothing', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, stripe, owned } = await subscribedOwner(web, worker, api)
    stripe.failUpdates(500)

    const response = await addBlock(browser, { blocks: 2 })
    const answer = await entitlementsOf(browser)

    expect(response.status).toBe(500)
    expect(answer.blocks).toBe(1)
    expect(tiersOf(answer, owned)).toEqual(['paid', 'paid', 'paid', 'paid', 'free'])
  })
})

describe('seam 1: who may add a block (stillstats#22)', () => {
  test('the owner of a live paid subscription may add a block, and a member of their channel, who holds none, may not', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, owned } = await subscribedOwner(web, worker, api)
    const memberBrowser = await signIn(api, member)
    await addMember(web, worker, owned[0] ?? '')

    expect((await entitlementsOf(browser)).canAddBlock).toBe(true)
    expect(await entitlementsOf(memberBrowser)).toMatchObject({
      canAddBlock: false,
      canSubscribe: false,
    })
  })

  test('a member who holds no subscription is refused with not_subscribed, and Stripe is asked nothing', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { owned, stripe } = await subscribedOwner(web, worker, api)
    const memberBrowser = await signIn(api, member)
    await addMember(web, worker, owned[0] ?? '')
    const asked = stripe.requests.length

    const previewed = await preview(memberBrowser)
    const added = await addBlock(memberBrowser, { blocks: 2 })

    expect([previewed.status, added.status]).toEqual([409, 409])
    expect(await previewed.json()).toEqual({ refusal: 'not_subscribed' } satisfies RefusalAnswer)
    expect(await added.json()).toEqual({ refusal: 'not_subscribed' } satisfies RefusalAnswer)
    expect(stripe.requests.slice(asked)).toEqual([])
  })

  test('an owner whose subscription ended is refused with not_subscribed, may subscribe through Checkout instead, and Stripe is asked nothing', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, userId, stripe } = await subscribedOwner(web, worker, api)
    await deliverStripeEvent(api, subscriptionDeletedEvent({ userId, endedAt: new Date() }))
    const asked = stripe.requests.length

    const previewed = await preview(browser)
    const added = await addBlock(browser, { blocks: 2 })

    expect([previewed.status, added.status]).toEqual([409, 409])
    expect(await added.json()).toEqual({ refusal: 'not_subscribed' } satisfies RefusalAnswer)
    expect(stripe.requests.slice(asked)).toEqual([])
    expect(await entitlementsOf(browser)).toMatchObject({ canAddBlock: false, canSubscribe: true })
  })

  test('a count other than one block more than Stripe holds is refused with blocks_changed, and nothing is updated', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, stripe } = await subscribedOwner(web, worker, api)

    const response = await addBlock(browser, { blocks: 3 })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ refusal: 'blocks_changed' } satisfies RefusalAnswer)
    expect(stripe.subscriptionUpdates).toEqual([])
  })

  test.for([[{}], [{ blocks: 0 }], [{ blocks: 1.5 }], [{ blocks: '2' }], [null]])(
    'a body of %j is refused with invalid_blocks',
    async ([body], { web, worker }) => {
      const api = await startApi(web, { billing: testBilling })
      const { browser, stripe } = await subscribedOwner(web, worker, api)

      const response = await addBlock(browser, body)

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'invalid_blocks' })
      expect(stripe.subscriptionUpdates).toEqual([])
    },
  )

  test('with Pro unset, both routes answer 404 as an unknown route does, and no one may add a block', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, owner)

    const previewed = await preview(browser)
    const added = await addBlock(browser, { blocks: 2 })

    expect([previewed.status, added.status]).toEqual([404, 404])
    expect(await added.json()).toEqual({ error: 'not_found' })
    expect((await entitlementsOf(browser)).canAddBlock).toBe(false)
  })
})
