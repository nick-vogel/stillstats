// Limits: the revoke reaches the fake Google server, so these tests cannot prove that Google ends
// the real grant. Nick deleting himself on the deployed product, then finding the product gone
// from his Google account's third-party access page, covers it. The end-state test runs the
// deletion job's handler in the test's transaction; it cannot prove that pg-boss fetches the
// committed job, which the delivery pipeline's smoke run (#20) covers.
import {
  accountCancellations,
  deletionLog,
  deletionRequests,
  preferences,
  proEnds,
  reachHistory,
  reachHistoryDays,
  readCache,
  reportingJobs,
  retentionCurveReads,
  retentionCurves,
  sponsorReportFigureChoices,
  subscriptions,
} from '@creator-analytics/database'
import {
  channelRowCounts,
  fixtureNotes,
  recordUserSubscription,
  subscribeOwner,
  test,
} from '@creator-analytics/database/testing'
import { recordingReporter } from '@creator-analytics/reporter'
import { createRetention, deletionJobData } from '@creator-analytics/retention-engine'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, savePreferences, signIn, userIdOf } from '../test/flows.ts'
import { startApi } from '../test/start-api.ts'
import { recordSubscriptionPayment } from './subscription-payments.ts'

const creator = { sub: '305729', email: 'delete-user@example.com', name: 'A Creator' }
const otherCreator = { sub: '405729', email: 'delete-user-other@example.com', name: 'Another' }

function deleteUser(browser: Browser): Promise<Response> {
  return browser.fetch('/api/me', { method: 'DELETE' })
}

async function connectedChannel(browser: Browser): Promise<string> {
  const before = new Set((await channelsOf(browser)).channels.map((channel) => channel.id))
  await connect(browser)
  const added = (await channelsOf(browser)).channels.find((channel) => !before.has(channel.id))
  if (!added) throw new Error('The connect flow connected no channel')
  return added.id
}

describe('seam 1: user deletion', () => {
  test('a creator deletes themselves and is signed out, so even a kept copy of their cookie is refused', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    const keptCookie = browser.cookieHeader

    const response = await deleteUser(browser)

    expect(response.status).toBe(200)
    expect(browser.cookieHeader).toBe('')
    expect((await browser.fetch('/api/me', { headers: { cookie: keptCookie } })).status).toBe(401)
  })

  test("a user deletion revokes each channel's token at Google and requests its deletion as a user deletion", async ({
    web,
    worker,
    findJobs,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-delete-user-a')
    const first = await connectedChannel(browser)
    api.google.pickChannel('UC-delete-user-b')
    const second = await connectedChannel(browser)

    await deleteUser(browser)

    const reasonOf = async (channelId: string) => {
      const requests = await worker.forChannel(channelId, (tx) =>
        tx.sql.select({ reason: deletionRequests.reason }).from(deletionRequests),
      )
      return requests.map((request) => request.reason)
    }
    expect(api.google.revokedTokens).toHaveLength(2)
    expect((await findJobs('deleteChannel')).map((job) => job.data.channelId).sort()).toEqual(
      [first, second].sort(),
    )
    expect(await reasonOf(first)).toEqual(['user_deletion'])
    expect(await reasonOf(second)).toEqual(['user_deletion'])
  })

  // The vault's tests prove the report. This one proves what the API answers the creator, who is
  // signed out and has no other way to learn that the grant may still stand at Google.
  test('a user deletion with a revoke Google refuses answers revokedAtGoogle false', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-delete-user-refused')
    await connectedChannel(browser)
    api.google.failRevocation(500)

    const response = await deleteUser(browser)

    expect(await response.json()).toEqual({ revokedAtGoogle: false })
  })

  test('a user deletion leaves another creator signed in with their channel', async ({ web }) => {
    const api = await startApi(web)
    const other = await signIn(api, otherCreator)
    api.google.pickChannel('UC-delete-user-other')
    await connectedChannel(other)
    const held = await channelsOf(other)
    const browser = await signIn(api, creator)

    await deleteUser(browser)

    expect((await other.fetch('/api/me')).status).toBe(200)
    expect(await channelsOf(other)).toEqual(held)
    expect(api.google.revokedTokens).toEqual([])
  })

  test("a paid user's deletion pends the cancellation of their subscription, and sends its cancellation now and its alarm at 12 hours", async ({
    web,
    worker,
    clock,
    findJobs,
  }) => {
    clock.set(new Date('2026-11-27T12:00:00.000Z'))
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-delete-user-paid')
    const channelId = await connectedChannel(browser)
    await subscribeOwner(web, worker, channelId)

    await deleteUser(browser)

    const pending = await worker.asSystem((tx) =>
      tx.sql
        .select({
          id: accountCancellations.id,
          subscription: accountCancellations.stripeSubscriptionId,
        })
        .from(accountCancellations),
    )
    expect(pending).toEqual([{ id: expect.any(String), subscription: `sub_${channelId}` }])
    const cancellationId = pending[0]?.id
    const sent = async (name: 'cancelAccountSubscription' | 'accountCancellationAlarm') =>
      (await findJobs(name)).map((job) => ({ data: job.data, startAfter: job.startAfter }))
    expect(await sent('cancelAccountSubscription')).toEqual([
      { data: { cancellationId }, startAfter: clock.now() },
    ])
    expect(await sent('accountCancellationAlarm')).toEqual([
      { data: { cancellationId }, startAfter: new Date('2026-11-28T00:00:00.000Z') },
    ])
  })

  test("a free user's deletion pends no cancellation", async ({ web, worker, findJobs }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-delete-user-free')
    await connectedChannel(browser)

    await deleteUser(browser)

    expect(await worker.asSystem((tx) => tx.sql.select().from(accountCancellations))).toEqual([])
    expect(await findJobs('cancelAccountSubscription')).toEqual([])
  })

  test('a user deletion leaves no preferences row', async ({ web }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    await savePreferences(browser, {
      chartMode: 'aggregate',
      rpmAdsAndPremiumOnly: true,
      sidebarOpen: false,
      whatsNewMarker: '2026.11.9',
    })
    const userId = await userIdOf(web, creator.email)
    const readRows = () =>
      web.asUser(userId, (tx) => tx.sql.select({ userId: preferences.userId }).from(preferences))
    // An absence proves nothing unless the row was there first.
    expect(await readRows()).toEqual([{ userId }])

    await deleteUser(browser)

    expect(await readRows()).toEqual([])
  })

  // The end state: no row of the channel is left in any table that holds a channel id, found
  // from the catalog, so a channel-owned table added later is covered without editing this test.
  test('after a user deletion and its job, no table holds a row of the channel, and the log counts every seeded row the channel still held', async ({
    web,
    worker,
    findJobs,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-delete-user-end-state')
    const channelId = await connectedChannel(browser)
    await worker.forChannel(channelId, async (tx) => {
      await tx.sql.insert(readCache).values({
        channelId,
        key: 'end-state',
        payload: {},
        fetchedAt: tx.now,
        expiresAt: tx.now,
      })
      await tx.sql
        .insert(reportingJobs)
        .values({ channelId, jobId: 'end-state', createdAt: tx.now })
      await tx.sql.insert(subscriptions).values({
        channelId,
        stripeCustomerId: 'cus_end_state',
        stripeSubscriptionId: 'sub_end_state',
        status: 'canceled',
        updatedAt: tx.now,
      })
      await tx.sql.insert(reachHistory).values({
        channelId,
        videoId: 'end-state',
        day: '2026-11-01',
        trafficSourceType: 0,
        impressions: 0,
        ctr: 0,
      })
      await tx.sql
        .insert(reachHistoryDays)
        .values({ channelId, day: '2026-11-01', reportCreatedAt: tx.now })
      await tx.sql.insert(retentionCurves).values({
        channelId,
        videoId: 'end-state',
        elapsedVideoTimeRatio: 0,
        audienceWatchRatio: 1,
        readAt: tx.now,
      })
      await tx.sql
        .insert(retentionCurveReads)
        .values({ channelId, videoId: 'end-state', readAt: tx.now })
      await tx.sql
        .insert(sponsorReportFigureChoices)
        .values({ channelId, figures: ['views'], updatedAt: tx.now })
      await tx.sql.insert(fixtureNotes).values({ channelId, body: 'end-state' })
    })
    // The channel's pick, which a purchase makes and its end leaves, and its end of Pro.
    const userId = await userIdOf(web, creator.email)
    await web.asAnonymous(async (tx) => {
      const event = {
        userId,
        customer: 'cus_end_state',
        subscription: 'sub_end_state_pro',
        plan: 'monthly',
        periodEnd: null,
        eventCreated: tx.now,
      } as const
      await recordUserSubscription(tx, { ...event, status: 'active' })
      await recordUserSubscription(tx, { ...event, status: 'canceled' })
    })
    await worker.forChannel(channelId, (tx) =>
      tx.sql.insert(proEnds).values({ channelId, endedAt: tx.now, purgeAfter: null }),
    )
    await web.asAnonymous((tx) =>
      recordSubscriptionPayment(tx, {
        invoiceId: 'in_end_state',
        userId: null,
        legacyChannelId: channelId,
      }),
    )
    const seeded = await worker.forChannel(channelId, (tx) => channelRowCounts(tx, channelId))
    // An absence proves nothing unless each table held a row of the channel first.
    // A channel's subscription payments are the release before blocks' rows, which nothing writes
    // any more (stillstats#20); channel-owned.test.ts proves they cascade.
    expect(Object.entries(seeded).filter(([, n]) => n === 0)).toEqual([
      ['subscription_payments', 0],
    ])

    await deleteUser(browser)
    const [deletion] = await findJobs('deleteChannel')
    if (!deletion) throw new Error('The user deletion enqueued no deletion')
    const retention = createRetention({ deletionLogKey: 'key', reporter: recordingReporter() })
    const data = deletionJobData('deleteChannel', deletion.data)
    await worker.forChannel(data.channelId, (tx) => retention.deleteChannel(tx, data))

    const left = await worker.forChannel(channelId, (tx) => channelRowCounts(tx, channelId))
    const openRequests = await worker.forChannel(channelId, (tx) =>
      tx.sql.select().from(deletionRequests),
    )
    const logged = await worker.asSystem((tx) =>
      tx.sql
        .select({ reason: deletionLog.reason, rowCounts: deletionLog.rowCounts })
        .from(deletionLog),
    )
    expect(left).toEqual(Object.fromEntries(Object.keys(seeded).map((table) => [table, 0])))
    expect(openRequests).toEqual([])
    // The user's deletion takes their Pro pick with the user row, before the channel's job runs.
    expect(logged).toEqual([{ reason: 'user_deletion', rowCounts: { ...seeded, pro_picks: 0 } }])
  })
})
