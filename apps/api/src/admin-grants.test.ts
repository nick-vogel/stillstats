// Limits: these make, list and remove grants through the API in one test transaction, so the
// end date's proGrantEnd job is run here as the worker's handler runs it, in the system scope, and
// not fetched by pg-boss; apps/worker/test/jobs.test.ts runs it through the worker's handlers.
import type {
  AdminGrantsAnswer,
  EntitlementsAnswer,
  ErrorAnswer,
} from '@creator-analytics/api-types'
import { memberships, type WebDatabase, type WorkerDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import { endProGrant } from '@creator-analytics/entitlements'
import { startFakeOpenPanel } from '@creator-analytics/event-relay/testing'
import { eq } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'
import { deliverStripeEvent, subscriptionCheckoutEvent, testBilling } from '../test/stripe.ts'

// Emails no other test file signs in with: test files run in parallel against one database.
const nick = { sub: '924024001', email: 'admin-grants-nick@example.com', name: 'Nick' }
const creator = { sub: '924024002', email: 'admin-grants-creator@example.com', name: 'A Creator' }
const subscriber = {
  sub: '924024003',
  email: 'admin-grants-subscriber@example.com',
  name: 'A Subscriber',
}

const now = new Date('2026-11-27T12:00:00.000Z')
const unknownId = '00000000-0000-4000-8000-000000000000'
const notFound = { status: 404, body: { error: 'not_found' } satisfies ErrorAnswer }

async function answerOf(response: Response) {
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

const list = (browser: Browser) => browser.fetch('/api/admin/grants').then(answerOf)
const grant = (browser: Browser, body: unknown) =>
  browser.postJson('/api/admin/grants', body).then(answerOf)
const remove = (browser: Browser, id: string) =>
  browser.fetch(`/api/admin/grants/${id}`, { method: 'DELETE' }).then(answerOf)

async function entitlementsOf(browser: Browser): Promise<EntitlementsAnswer> {
  const response = await browser.fetch('/api/me/entitlements')
  expect(response.status).toBe(200)
  return (await response.json()) as EntitlementsAnswer
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

/** The browser's user connects `count` channels, each its own connection time, in order. */
async function channelsFor(
  api: StartedApi,
  browser: Browser,
  worker: WorkerDatabase,
  prefix: string,
  count: number,
) {
  const ids: string[] = []
  for (let n = 1; n <= count; n++) ids.push(await connectChannel(api, browser, `${prefix}-${n}`))
  // The test's one transaction gives every membership the connect writes the same now().
  for (const [n, channelId] of ids.entries()) {
    await worker.forChannel(channelId, (tx) =>
      tx.sql
        .update(memberships)
        .set({ createdAt: new Date(Date.UTC(2026, 10, 1, 12, n)) })
        .where(eq(memberships.channelId, channelId)),
    )
  }
  return ids
}

/** Each channel's tier, pick and purge date, in the order of the IDs given. */
function tiersOf(answer: EntitlementsAnswer, ids: string[]) {
  return ids.map((id) => {
    const channel = answer.channels.find(({ channelId }) => channelId === id)
    return channel && { tier: channel.tier, picked: channel.picked, purgeDate: channel.purgeDate }
  })
}

const paid = { tier: 'paid', picked: true, purgeDate: null }
const free = { tier: 'free', picked: false, purgeDate: null }

/**
 * The API with Pro's settings, a fake OpenPanel, Nick signed in and on the allowlist, and a
 * creator signed in and not on it.
 */
async function startWithAdmin(web: WebDatabase) {
  const adminUserIds = new Set<string>()
  const openPanel = await startFakeOpenPanel()
  const api = await startApi(web, { billing: testBilling, openPanel, adminUserIds })
  const admin = await signIn(api, nick)
  adminUserIds.add(await userIdOf(web, nick.email))
  const browser = await signIn(api, creator)
  return { api, admin, browser, openPanel }
}

describe('the admin routes of the Pro grants (stillstats#24)', () => {
  test('a signed-out visitor and a signed-in creator off the allowlist get not_found from every grant route, and nothing is written', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, admin, browser } = await startWithAdmin(web)
    const signedOut = new Browser(api.origin)
    const body = { email: creator.email, blocks: 1, endsOn: null }
    const answersOf = async (visitor: Browser) => [
      await list(visitor),
      await grant(visitor, body),
      await remove(visitor, unknownId),
    ]

    const anonymous = await answersOf(signedOut)
    const offList = await answersOf(browser)

    expect(anonymous).toEqual([notFound, notFound, notFound])
    expect(offList).toEqual([notFound, notFound, notFound])
    expect(await list(admin)).toEqual({ status: 200, body: { grants: [] } })
    expect((await entitlementsOf(browser)).grants).toEqual([])
  })

  test("the admin grants a creator 1 block by email with an end date: the list labels it granted with 0 paid, and the creator's 4 oldest channels read paid with the grant's end", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(now)
    const { api, admin, browser } = await startWithAdmin(web)
    const ids = await channelsFor(api, browser, worker, 'UC-grant', 5)

    const created = await grant(admin, {
      email: creator.email,
      blocks: 1,
      endsOn: '2026-12-10',
    })

    expect(created).toEqual({
      status: 201,
      body: {
        grants: [
          {
            id: expect.any(String),
            email: creator.email,
            blocks: 1,
            endsAt: '2026-12-10T00:00:00.000Z',
            createdAt: now.toISOString(),
            paidBlocks: 0,
            grantedBlocks: 1,
          },
        ],
      } satisfies AdminGrantsAnswer,
    })
    expect(await list(admin)).toEqual({ status: 200, body: created.body })
    const answer = await entitlementsOf(browser)
    expect(answer).toMatchObject({
      blocks: 0,
      grants: [{ blocks: 1, endsAt: '2026-12-10T00:00:00.000Z' }],
      slotsInUse: 4,
    })
    expect(tiersOf(answer, ids)).toEqual([paid, paid, paid, paid, free])
  })

  test('a grant beside a paid block lists 1 paid, and the emails are compared lower-cased', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(now)
    const { api, admin } = await startWithAdmin(web)
    const owner = await signIn(api, subscriber)
    const ids = await channelsFor(api, owner, worker, 'UC-grant-paid', 6)
    const userId = await userIdOf(web, subscriber.email)
    const delivered = await deliverStripeEvent(api, subscriptionCheckoutEvent({ userId }))
    expect(delivered.status).toBe(200)

    const created = await grant(admin, {
      email: subscriber.email.toUpperCase(),
      blocks: 2,
      endsOn: null,
    })

    expect(created.status).toBe(201)
    expect((created.body as AdminGrantsAnswer).grants).toMatchObject([
      { email: subscriber.email, blocks: 2, endsAt: null, paidBlocks: 1, grantedBlocks: 2 },
    ])
    const answer = await entitlementsOf(owner)
    expect(answer).toMatchObject({ blocks: 1, grants: [{ blocks: 2, endsAt: null }] })
    expect(tiersOf(answer, ids)).toEqual(ids.map(() => paid))
  })

  test("the removal answers the list without the grant, and the creator's newest picks read free with the purge date 30 days on", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(now)
    const { api, admin, browser } = await startWithAdmin(web)
    const ids = await channelsFor(api, browser, worker, 'UC-grant-removed', 6)
    clock.advance(60_000)
    const first = await grant(admin, { email: creator.email, blocks: 1, endsOn: null })
    clock.advance(60_000)
    const second = await grant(admin, { email: creator.email, blocks: 1, endsOn: null })
    const [newest] = (second.body as AdminGrantsAnswer).grants
    expect(tiersOf(await entitlementsOf(browser), ids)).toEqual(ids.map(() => paid))
    clock.set(new Date('2026-11-28T12:00:00.000Z'))

    const removed = await remove(admin, newest?.id ?? '')

    expect(removed).toEqual({ status: 200, body: first.body })
    const leftOut = { tier: 'free', picked: true, purgeDate: '2026-12-28T12:00:00.000Z' }
    expect(tiersOf(await entitlementsOf(browser), ids)).toEqual([
      paid,
      paid,
      paid,
      paid,
      leftOut,
      leftOut,
    ])
    expect(await remove(admin, newest?.id ?? '')).toEqual(notFound)
  })

  test('an unknown email answers unknown_email, a malformed body invalid_grant, and an unknown or malformed ID not_found, and none writes a grant', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { admin } = await startWithAdmin(web)

    const unknownEmail = await grant(admin, {
      email: 'nobody@example.com',
      blocks: 1,
      endsOn: null,
    })
    const invalid = [
      { blocks: 1, endsOn: null },
      { email: 'not an email', blocks: 1, endsOn: null },
      { email: creator.email, blocks: 0, endsOn: null },
      { email: creator.email, blocks: 1.5, endsOn: null },
      { email: creator.email, blocks: 101, endsOn: null },
      { email: creator.email, blocks: '1', endsOn: null },
      { email: creator.email, blocks: 1 },
      { email: creator.email, blocks: 1, endsOn: '2026-12-32' },
      { email: creator.email, blocks: 1, endsOn: '10 December 2026' },
      // Today, in UTC, is not after today.
      { email: creator.email, blocks: 1, endsOn: '2026-11-27' },
      { email: creator.email, blocks: 1, endsOn: '2026-11-01' },
      'not json',
    ]
    const invalidAnswers = []
    for (const body of invalid) invalidAnswers.push(await grant(admin, body))

    expect(unknownEmail).toEqual({ status: 404, body: { error: 'unknown_email' } })
    expect(invalidAnswers).toEqual(
      invalid.map(() => ({ status: 400, body: { error: 'invalid_grant' } })),
    )
    expect(await remove(admin, unknownId)).toEqual(notFound)
    expect(await remove(admin, 'not-a-uuid')).toEqual(notFound)
    expect(await list(admin)).toEqual({ status: 200, body: { grants: [] } })
  })

  test('creating, removing and ending a grant sends OpenPanel nothing, and the fake Stripe server receives no request', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(now)
    const { api, admin, browser, openPanel } = await startWithAdmin(web)
    await channelsFor(api, browser, worker, 'UC-grant-quiet', 5)
    const stripeRequests = api.fakeStripe?.requests.length
    const received = openPanel.received.length

    const removed = await grant(admin, { email: creator.email, blocks: 1, endsOn: null })
    await remove(admin, (removed.body as AdminGrantsAnswer).grants[0]?.id ?? '')
    const ending = await grant(admin, { email: creator.email, blocks: 1, endsOn: '2026-12-10' })
    clock.set(new Date('2026-12-10T00:00:00.000Z'))
    await worker.asSystem((tx) =>
      endProGrant(tx, { grantId: (ending.body as AdminGrantsAnswer).grants[0]?.id ?? '' }),
    )

    expect(await list(admin)).toEqual({ status: 200, body: { grants: [] } })
    expect(api.fakeStripe?.requests.length).toBe(stripeRequests)
    expect(openPanel.received).toHaveLength(received)
  })
})
