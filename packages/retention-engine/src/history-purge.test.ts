// Limits: these run the purge on a clock the test pins, inside one transaction, so they cannot show
// the purge racing a return the webhook records at the same moment: the row lock that orders the
// two is Postgres's, and the tests here open one scope at a time. pg-boss sending the roster job
// at 03:00 UTC is the schedule `packages/database/test/jobs.test.ts` reads back, and the throttle's
// time slots run on the database's own clock, not the pinned one.
import {
  channels,
  proEnds,
  reachHistory,
  reachHistoryDays,
  retentionCurveReads,
  retentionCurves,
  type Scoped,
  subscriptions,
  type WebDatabase,
  type WorkerDatabase,
} from '@creator-analytics/database'
import {
  test as databaseTest,
  seedChannel,
  subscribeOwner,
  type TestClock,
} from '@creator-analytics/database/testing'
import {
  entitlementOf,
  pickProChannel,
  purgeDateOf,
  unpickProChannel,
} from '@creator-analytics/entitlements'
import { eq } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { enqueueHistoryPurges, historyPurgeJobData, purgeEndedHistory } from './history-purge.ts'

const test = databaseTest
const dayMs = 24 * 60 * 60 * 1000
const endedAt = new Date('2026-11-02T12:00:00.000Z')
const dayAfterEnd = (days: number) => new Date(endedAt.getTime() + days * dayMs)

/** Sets the channel's purge date, 30 days after it stopped being Pro, as an end event does. */
function setPurgeDate(scope: Scoped<'channel'>, channelId: string, ended: Date) {
  const values = { endedAt: ended, purgeAfter: purgeDateOf(ended) }
  return scope.sql
    .insert(proEnds)
    .values({ channelId, ...values })
    .onConflictDoUpdate({ target: proEnds.channelId, set: values })
}

/**
 * Ends the channel's Pro at `endedAt`, as the `deleted` webhook leaves it: the seeded owner's
 * subscription is already canceled, so the channel's purge date is what the end adds.
 */
async function endSubscription(worker: WorkerDatabase, channelId: string): Promise<void> {
  await worker.forChannel(channelId, (scope) => setPurgeDate(scope, channelId, endedAt))
}

/**
 * The channel's history, its days, its retention curves, their reads and its subscription row of
 * the release before blocks, which the seed still writes, read in the channel's scope.
 */
async function stored(scope: Scoped<'channel'>, channelId: string) {
  const history = await scope.sql
    .select({ videoId: reachHistory.videoId, day: reachHistory.day })
    .from(reachHistory)
    .where(eq(reachHistory.channelId, channelId))
  const days = await scope.sql
    .select({ day: reachHistoryDays.day })
    .from(reachHistoryDays)
    .where(eq(reachHistoryDays.channelId, channelId))
  const curves = await scope.sql
    .select({ videoId: retentionCurves.videoId })
    .from(retentionCurves)
    .where(eq(retentionCurves.channelId, channelId))
  const curveReads = await scope.sql
    .select({ videoId: retentionCurveReads.videoId })
    .from(retentionCurveReads)
    .where(eq(retentionCurveReads.channelId, channelId))
  const [subscription] = await scope.sql
    .select({
      status: subscriptions.status,
      customer: subscriptions.stripeCustomerId,
      subscription: subscriptions.stripeSubscriptionId,
      purgeAfter: proEnds.purgeAfter,
    })
    .from(subscriptions)
    .leftJoin(proEnds, eq(proEnds.channelId, subscriptions.channelId))
    .where(eq(subscriptions.channelId, channelId))
  return { history, days, curves, curveReads, subscription }
}

function purge(worker: WorkerDatabase, channelId: string) {
  return worker.forChannel(channelId, (scope) => purgeEndedHistory(scope, { channelId }))
}

describe('seam 2: the history purge', () => {
  test('on day 31 after its subscription ended, a channel holds no history, no retention curve and no purge date, and keeps its channel and its subscription row', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(endedAt)
    const channelId = await seedChannel(web, worker, 'purge-user-a')
    await endSubscription(worker, channelId)

    clock.set(dayAfterEnd(31))
    await purge(worker, channelId)

    expect(await worker.forChannel(channelId, (scope) => stored(scope, channelId))).toEqual({
      history: [],
      days: [],
      curves: [],
      curveReads: [],
      subscription: {
        status: 'canceled',
        customer: `cus_${channelId}`,
        subscription: `sub_${channelId}`,
        purgeAfter: null,
      },
    })
    const channel = await worker.forChannel(channelId, (scope) =>
      scope.sql.select({ id: channels.id }).from(channels).where(eq(channels.id, channelId)),
    )
    expect(channel).toEqual([{ id: channelId }])
  })

  test('on day 29 after its subscription ended, a channel keeps its history, its days, its retention curves and its purge date', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(endedAt)
    const channelId = await seedChannel(web, worker, 'purge-user-a')
    await endSubscription(worker, channelId)

    clock.set(dayAfterEnd(29))
    await purge(worker, channelId)

    expect(await worker.forChannel(channelId, (scope) => stored(scope, channelId))).toEqual({
      history: [{ videoId: 'fixture', day: '2026-11-01' }],
      days: [{ day: '2026-11-01' }],
      curves: [{ videoId: 'fixture' }],
      curveReads: [{ videoId: 'fixture' }],
      subscription: {
        status: 'canceled',
        customer: `cus_${channelId}`,
        subscription: `sub_${channelId}`,
        purgeAfter: purgeDateOf(endedAt),
      },
    })
  })

  test("the purge of one channel leaves another channel's history untouched, whether its purge date is ahead, it is paid or it never ended", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(endedAt)
    const due = await seedChannel(web, worker, 'purge-user-a')
    await endSubscription(worker, due)
    clock.set(dayAfterEnd(20))
    const ahead = await seedChannel(web, worker, 'purge-user-b')
    await worker.forChannel(ahead, (scope) => setPurgeDate(scope, ahead, scope.now))
    const paid = await seedChannel(web, worker, 'purge-user-c')
    await subscribeOwner(web, worker, paid)
    const neverEnded = await seedChannel(web, worker, 'purge-user-d')
    const before = await Promise.all(
      [ahead, paid, neverEnded].map((id) => worker.forChannel(id, (scope) => stored(scope, id))),
    )

    clock.set(dayAfterEnd(31))
    for (const channelId of [due, ahead, paid, neverEnded]) await purge(worker, channelId)

    const after = await Promise.all(
      [ahead, paid, neverEnded].map((id) => worker.forChannel(id, (scope) => stored(scope, id))),
    )
    expect(after).toEqual(before)
    expect(after.map(({ history }) => history.length)).toEqual([1, 1, 1])
    expect(after.map(({ curves }) => curves.length)).toEqual([1, 1, 1])
    expect(after.map(({ subscription }) => subscription?.purgeAfter)).toEqual([
      purgeDateOf(dayAfterEnd(20)),
      null,
      null,
    ])
    expect(await worker.forChannel(due, (scope) => stored(scope, due))).toMatchObject({
      history: [],
      days: [],
      curves: [],
      curveReads: [],
    })
  })

  test('the roster enqueues one purge per connected channel, and only the channel past its purge date loses its history', async ({
    web,
    worker,
    clock,
    findJobs,
  }) => {
    clock.set(endedAt)
    const due = await seedChannel(web, worker, 'purge-user-a')
    await endSubscription(worker, due)
    const kept = await seedChannel(web, worker, 'purge-user-b')

    clock.set(dayAfterEnd(31))
    await worker.asSystem(enqueueHistoryPurges)
    const jobs = await findJobs('historyPurge')
    for (const job of jobs) {
      const { channelId } = historyPurgeJobData(job.data)
      await purge(worker, channelId)
    }

    expect(jobs.map((job) => job.data.channelId).sort()).toEqual([due, kept].sort())
    expect(
      await Promise.all(
        [due, kept].map((id) =>
          worker.forChannel(id, async (scope) => (await stored(scope, id)).history.length),
        ),
      ),
    ).toEqual([0, 1])
  })

  test('a roster that runs again the same day enqueues no second purge for a channel', async ({
    web,
    worker,
    findJobs,
  }) => {
    const channelId = await seedChannel(web, worker, 'purge-user-a')

    await worker.asSystem(enqueueHistoryPurges)
    await worker.asSystem(enqueueHistoryPurges)

    expect((await findJobs('historyPurge')).map((job) => job.data)).toEqual([{ channelId }])
  })
})

describe('seam 2: the history purge of a channel its owner took out of their block (stillstats#21)', () => {
  const owner = 'purge-picker'

  /** A Pro channel of the owner's, its history stored, taken out of the block at `endedAt`. */
  async function unpickedChannel(web: WebDatabase, worker: WorkerDatabase, clock: TestClock) {
    clock.set(endedAt)
    const channelId = await seedChannel(web, worker, owner)
    await subscribeOwner(web, worker, channelId)
    const unpicked = await web.asUser(owner, (scope) => unpickProChannel(scope, channelId))
    expect(unpicked).toEqual({ ok: true, changed: true })
    return channelId
  }

  const historyOf = (worker: WorkerDatabase, channelId: string) =>
    worker.forChannel(channelId, async (scope) => (await stored(scope, channelId)).history)

  test('on day 29 after the unpick the channel keeps its history, and on day 31 the purge deletes it', async ({
    web,
    worker,
    clock,
  }) => {
    const channelId = await unpickedChannel(web, worker, clock)

    clock.set(dayAfterEnd(29))
    await purge(worker, channelId)
    const kept = await historyOf(worker, channelId)
    clock.set(dayAfterEnd(31))
    await purge(worker, channelId)

    expect(kept).toEqual([{ videoId: 'fixture', day: '2026-11-01' }])
    expect(await historyOf(worker, channelId)).toEqual([])
  })

  test('picked again before its purge date, the channel reads paid and day 31 purges nothing', async ({
    web,
    worker,
    clock,
  }) => {
    const channelId = await unpickedChannel(web, worker, clock)

    clock.set(dayAfterEnd(20))
    const picked = await web.asUser(owner, (scope) => pickProChannel(scope, channelId))
    clock.set(dayAfterEnd(31))
    await purge(worker, channelId)

    expect(picked).toEqual({ ok: true, changed: true })
    expect(await web.asUser(owner, (scope) => entitlementOf(scope, channelId))).toEqual({
      tier: 'paid',
      purgeDate: null,
    })
    expect(await historyOf(worker, channelId)).toEqual([{ videoId: 'fixture', day: '2026-11-01' }])
  })

  test('picked again after its purge, the channel reads paid with no purge date and no stored history', async ({
    web,
    worker,
    clock,
  }) => {
    const channelId = await unpickedChannel(web, worker, clock)
    clock.set(dayAfterEnd(31))
    await purge(worker, channelId)

    clock.set(dayAfterEnd(40))
    await web.asUser(owner, (scope) => pickProChannel(scope, channelId))
    await purge(worker, channelId)

    expect(await web.asUser(owner, (scope) => entitlementOf(scope, channelId))).toEqual({
      tier: 'paid',
      purgeDate: null,
    })
    expect(await historyOf(worker, channelId)).toEqual([])
  })
})
