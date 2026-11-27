import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { proEnds, subscriptions } from '../src/schema.ts'
import type { Scoped, ScopeKind, WebDatabase, WorkerDatabase } from '../src/scopes.ts'
import { test } from './harness.ts'
import { seedChannel, seedUser } from './seed.ts'

interface Recorded {
  customer: string
  subscription: string
  plan: 'monthly' | 'annual' | null
  status: string | null
  periodEnd: Date | null
  purgeAfter?: Date | null
  /** When Stripe created the event, `createdAt` unless given. */
  eventCreated?: Date
}

const createdAt = new Date('2026-11-17T12:00:00.000Z')

const periodEnd = new Date('2026-12-17T12:00:00.000Z')
const completed: Recorded = {
  customer: 'cus_test_a',
  subscription: 'sub_test_a',
  plan: null,
  status: 'active',
  periodEnd: null,
}
const created: Recorded = { ...completed, plan: 'monthly', status: null, periodEnd }

/** A channel the user owns, with a row in every channel-owned table but subscriptions and pro_ends. */
async function freeChannel(web: WebDatabase, worker: WorkerDatabase, ownerId: string) {
  const channelId = await seedChannel(web, worker, ownerId)
  await worker.forChannel(channelId, async (scope) => {
    await scope.sql.delete(subscriptions)
    await scope.sql.delete(proEnds)
  })
  return channelId
}

/** What record_subscription answers, and whether the stored row turned paid in that statement. */
function recordTurn(channelId: string, fields: Recorded) {
  return (scope: Scoped<ScopeKind>) =>
    scope.sql
      .execute<{ outcome: string; turned_paid: boolean }>(
        sql`select outcome, turned_paid from record_subscription(${channelId}::uuid, ${fields.customer}, ${fields.subscription}, ${fields.plan}, ${fields.status}, ${fields.periodEnd?.toISOString() ?? null}::timestamptz, ${fields.purgeAfter?.toISOString() ?? null}::timestamptz, ${(fields.eventCreated ?? createdAt).toISOString()}::timestamptz)`,
      )
      .then(({ rows }) => rows[0] && { outcome: rows[0].outcome, turnedPaid: rows[0].turned_paid })
}

function record(channelId: string, fields: Recorded) {
  return (scope: Scoped<ScopeKind>) =>
    recordTurn(channelId, fields)(scope).then((row) => row?.outcome)
}

/** The error a statement fails with, run in a savepoint so a refusal leaves the scope usable. */
function refusalOf(scope: Scoped<ScopeKind>, statement: (scope: Scoped<ScopeKind>) => unknown) {
  return scope.sql
    .transaction(async (attempt) => {
      await statement({ ...scope, sql: attempt })
    })
    .then(
      () => undefined,
      (error: unknown) => error,
    )
}

function readSubscriptions(scope: Scoped<ScopeKind>) {
  return scope.sql
    .select({
      customer: subscriptions.stripeCustomerId,
      subscription: subscriptions.stripeSubscriptionId,
      plan: subscriptions.plan,
      status: subscriptions.status,
      periodEnd: subscriptions.currentPeriodEnd,
      purgeAfter: proEnds.purgeAfter,
    })
    .from(subscriptions)
    .leftJoin(proEnds, eq(proEnds.channelId, subscriptions.channelId))
}

const purgeAfter = new Date('2027-01-16T12:00:00.000Z')
const ended: Recorded = { ...created, status: 'canceled', purgeAfter }

describe('record_subscription, the end of a subscription and its purge date (#787)', () => {
  async function paidChannel(web: WebDatabase, worker: WorkerDatabase) {
    const channelId = await freeChannel(web, worker, 'subscriptions-owner')
    await web.asAnonymous(record(channelId, completed))
    await web.asAnonymous(record(channelId, created))
    return channelId
  }

  const stored = (web: WebDatabase) =>
    web.asUser('subscriptions-owner', readSubscriptions).then(([row]) => row)

  test('an end event stores its purge date with the canceled status', async ({ web, worker }) => {
    const channelId = await paidChannel(web, worker)

    expect(await web.asAnonymous(record(channelId, ended))).toBe('recorded')
    expect(await stored(web)).toMatchObject({ status: 'canceled', purgeAfter })
  })

  test('a later end event never moves the purge date', async ({ web, worker }) => {
    const channelId = await paidChannel(web, worker)
    await web.asAnonymous(record(channelId, { ...created, status: 'unpaid', purgeAfter }))

    const later = new Date('2027-02-01T12:00:00.000Z')
    await web.asAnonymous(record(channelId, { ...ended, purgeAfter: later }))

    expect(await stored(web)).toMatchObject({ status: 'canceled', purgeAfter })
  })

  test('a paid status clears the purge date, so a return before it keeps the history', async ({
    web,
    worker,
  }) => {
    const channelId = await paidChannel(web, worker)
    await web.asAnonymous(record(channelId, { ...created, status: 'unpaid', purgeAfter }))

    expect(await web.asAnonymous(record(channelId, { ...created, status: 'active' }))).toBe(
      'recorded',
    )
    expect(await stored(web)).toMatchObject({ status: 'active', purgeAfter: null })
  })

  test('the same subscription, once canceled, stays canceled with its purge date whatever a later event says', async ({
    web,
    worker,
  }) => {
    const channelId = await paidChannel(web, worker)
    await web.asAnonymous(record(channelId, ended))

    expect(await web.asAnonymous(record(channelId, { ...created, status: 'active' }))).toBe(
      'unchanged',
    )
    expect(await web.asAnonymous(record(channelId, ended))).toBe('unchanged')
    expect(await stored(web)).toMatchObject({ status: 'canceled', purgeAfter })
  })

  test('an event of the same subscription older than the newest the row holds changes nothing', async ({
    web,
    worker,
  }) => {
    const channelId = await paidChannel(web, worker)
    const later = new Date('2026-11-20T12:00:00.000Z')
    const annual = { ...created, plan: 'annual', status: 'active', eventCreated: later } as const
    await web.asAnonymous(record(channelId, annual))

    const older = { ...created, status: 'unpaid', purgeAfter, eventCreated: createdAt }
    expect(await web.asAnonymous(record(channelId, older))).toBe('unchanged')
    expect(await stored(web)).toMatchObject({ plan: 'annual', status: 'active', purgeAfter: null })
  })

  test('an event that changes no field still moves the time on, so an older one cannot undo it', async ({
    web,
    worker,
  }) => {
    const channelId = await paidChannel(web, worker)
    const confirmed = new Date('2026-11-20T12:00:00.000Z')
    await web.asAnonymous(
      record(channelId, { ...created, status: 'active', eventCreated: confirmed }),
    )

    const between = new Date('2026-11-18T12:00:00.000Z')
    await web.asAnonymous(
      record(channelId, { ...created, status: 'unpaid', purgeAfter, eventCreated: between }),
    )

    expect(await stored(web)).toMatchObject({ status: 'active', purgeAfter: null })
  })

  test('a new subscription replaces an ended one with its own plan, status and period end, and a paid one clears the purge date', async ({
    web,
    worker,
  }) => {
    const channelId = await paidChannel(web, worker)
    await web.asAnonymous(record(channelId, ended))
    const newPeriodEnd = new Date('2028-01-20T12:00:00.000Z')

    const outcome = await web.asAnonymous(
      record(channelId, {
        customer: 'cus_test_a',
        subscription: 'sub_test_b',
        plan: 'annual',
        status: 'active',
        periodEnd: newPeriodEnd,
      }),
    )

    expect(outcome).toBe('recorded')
    expect(await stored(web)).toEqual({
      customer: 'cus_test_a',
      subscription: 'sub_test_b',
      plan: 'annual',
      status: 'active',
      periodEnd: newPeriodEnd,
      purgeAfter: null,
    })
  })

  test('a new subscription not paid yet replaces an ended one and keeps its purge date, carrying none of the old plan', async ({
    web,
    worker,
  }) => {
    const channelId = await paidChannel(web, worker)
    await web.asAnonymous(record(channelId, ended))

    await web.asAnonymous(
      record(channelId, {
        customer: 'cus_test_a',
        subscription: 'sub_test_b',
        plan: null,
        status: null,
        periodEnd: null,
      }),
    )

    expect(await stored(web)).toEqual({
      customer: 'cus_test_a',
      subscription: 'sub_test_b',
      plan: null,
      status: 'incomplete',
      periodEnd: null,
      purgeAfter,
    })
  })

  test('a live event of another subscription never re-points a paid channel, and answers that it is another subscription', async ({
    web,
    worker,
  }) => {
    const channelId = await paidChannel(web, worker)
    const before = await stored(web)

    const outcome = await web.asAnonymous(
      record(channelId, { ...created, subscription: 'sub_test_old', status: 'active' }),
    )

    expect(outcome).toBe('other_subscription')
    expect(await stored(web)).toEqual(before)
  })

  test('a canceled other subscription says nothing of a paid channel', async ({ web, worker }) => {
    const channelId = await paidChannel(web, worker)
    const before = await stored(web)

    const outcome = await web.asAnonymous(
      record(channelId, { ...ended, subscription: 'sub_test_old' }),
    )

    expect(outcome).toBe('unchanged')
    expect(await stored(web)).toEqual(before)
  })

  test('an older event of another subscription never replaces a new one not paid yet', async ({
    web,
    worker,
  }) => {
    const channelId = await paidChannel(web, worker)
    const resubscribed = new Date('2026-11-20T12:00:00.000Z')
    await web.asAnonymous(record(channelId, ended))
    const again = { ...created, subscription: 'sub_test_b', eventCreated: resubscribed }
    await web.asAnonymous(record(channelId, again))
    const before = await stored(web)

    const late = { ...created, status: 'active', eventCreated: createdAt }
    expect(await web.asAnonymous(record(channelId, late))).toBe('unchanged')
    expect(await stored(web)).toEqual(before)
    expect(before).toMatchObject({ subscription: 'sub_test_b', status: 'incomplete' })
  })

  test("an older event of the stored subscription fills what the row holds as null, so a new subscription's Checkout first keeps its period end", async ({
    web,
    worker,
  }) => {
    const channelId = await paidChannel(web, worker)
    await web.asAnonymous(record(channelId, ended))
    const resubscribed = new Date('2026-11-20T12:00:00.000Z')
    const newPeriodEnd = new Date('2027-11-20T12:00:00.000Z')
    const b = { ...completed, subscription: 'sub_test_b' }
    await web.asAnonymous(
      record(channelId, { ...b, eventCreated: new Date('2026-11-20T12:00:02.000Z') }),
    )

    const createdB: Recorded = { ...b, plan: 'annual', status: null, periodEnd: newPeriodEnd }
    expect(
      await web.asAnonymous(record(channelId, { ...createdB, eventCreated: resubscribed })),
    ).toBe('recorded')
    expect(await stored(web)).toEqual({
      customer: 'cus_test_a',
      subscription: 'sub_test_b',
      plan: 'annual',
      status: 'active',
      periodEnd: newPeriodEnd,
      purgeAfter: null,
    })
  })

  test('a canceled other subscription says nothing of the channel', async ({ web, worker }) => {
    const channelId = await paidChannel(web, worker)
    await web.asAnonymous(record(channelId, ended))
    const before = await stored(web)

    const outcome = await web.asAnonymous(
      record(channelId, {
        ...ended,
        subscription: 'sub_test_old',
        purgeAfter: new Date('2026-12-01T12:00:00.000Z'),
      }),
    )

    expect(outcome).toBe('unchanged')
    expect(await stored(web)).toEqual(before)
  })
})

describe('record_subscription, the one write path of the anonymous scope to subscriptions', () => {
  test("records the channel's subscription, which its owner reads", async ({ web, worker }) => {
    const channelId = await freeChannel(web, worker, 'subscriptions-owner')

    const outcome = await web.asAnonymous(record(channelId, completed))

    expect(outcome).toBe('recorded')
    expect(await web.asUser('subscriptions-owner', readSubscriptions)).toEqual([
      {
        customer: 'cus_test_a',
        subscription: 'sub_test_a',
        plan: null,
        status: 'active',
        periodEnd: null,
        purgeAfter: null,
      },
    ])
  })

  test('the same fields again answer unchanged', async ({ web, worker }) => {
    const channelId = await freeChannel(web, worker, 'subscriptions-owner')
    await web.asAnonymous(record(channelId, completed))

    expect(await web.asAnonymous(record(channelId, completed))).toBe('unchanged')
  })

  // Stripe creates the subscription before its Checkout completes, so the Checkout is the newer.
  const completedLater = { ...completed, eventCreated: new Date('2026-11-17T12:00:02.000Z') }

  test.for([
    ['the completed Checkout first', [completedLater, created]],
    ['the created subscription first', [created, completedLater]],
  ] as const)(
    'a null keeps the stored value, so %s ends in the same row',
    async ([, events], { web, worker }) => {
      const channelId = await freeChannel(web, worker, 'subscriptions-owner')
      for (const event of events) await web.asAnonymous(record(channelId, event))

      expect(await web.asUser('subscriptions-owner', readSubscriptions)).toEqual([
        {
          customer: 'cus_test_a',
          subscription: 'sub_test_a',
          plan: 'monthly',
          status: 'active',
          periodEnd,
          purgeAfter: null,
        },
      ])
    },
  )

  test('a channel that does not exist answers no_channel and records nothing', async ({ web }) => {
    expect(await web.asAnonymous(record(randomUUID(), completed))).toBe('no_channel')
  })

  test('runs only in the anonymous scope', async ({ web, worker }) => {
    await seedUser(web, 'subscriptions-owner')
    const channelId = randomUUID()
    const attempt = (scope: Scoped<ScopeKind>) => refusalOf(scope, record(channelId, completed))
    // app_web holds EXECUTE on the function and the function checks the scope; app_worker holds none.
    const refused = { cause: { message: 'record_subscription runs only in the anonymous scope' } }
    const denied = { cause: { message: 'permission denied for function record_subscription' } }

    expect(await web.asUser('subscriptions-owner', attempt)).toMatchObject(refused)
    expect(await web.asAdmin('subscriptions-owner', attempt)).toMatchObject(refused)
    expect(await worker.forChannel(channelId, attempt)).toMatchObject(denied)
    expect(await worker.asSystem(attempt)).toMatchObject(denied)
  })

  test('the anonymous scope reads and writes no subscription row itself', async ({
    web,
    worker,
  }) => {
    const channelId = await freeChannel(web, worker, 'subscriptions-owner')
    await web.asAnonymous(record(channelId, completed))

    const seen = await web.asAnonymous(async (scope) => ({
      read: await readSubscriptions(scope),
      updated: (await scope.sql.update(subscriptions).set({ status: 'canceled' })).rowCount,
      inserted: await refusalOf(scope, (attempt) =>
        attempt.sql.insert(subscriptions).values({
          channelId,
          stripeCustomerId: 'cus_test_b',
          stripeSubscriptionId: 'sub_test_b',
          status: 'active',
          updatedAt: attempt.now,
        }),
      ),
    }))

    expect(seen).toMatchObject({
      read: [],
      updated: 0,
      inserted: {
        cause: { message: 'new row violates row-level security policy for table "subscriptions"' },
      },
    })
  })
})

const later = (minutes: number) => new Date(createdAt.getTime() + minutes * 60_000)

describe('record_subscription reports whether the stored row turned paid (#1034)', () => {
  // Each row records `before` in order, then answers what `event` reports.
  test.for<[string, Recorded[], Recorded, { outcome: string; turnedPaid: boolean }]>([
    [
      'a first event of a paid subscription turns the channel paid',
      [],
      completed,
      { outcome: 'recorded', turnedPaid: true },
    ],
    [
      'a first event of a subscription not paid yet turns nothing paid',
      [],
      created,
      { outcome: 'recorded', turnedPaid: false },
    ],
    [
      'an incomplete subscription updated to active turns the channel paid',
      [created],
      { ...created, status: 'active', eventCreated: later(1) },
      { outcome: 'recorded', turnedPaid: true },
    ],
    [
      'an ended subscription made active again turns the channel paid',
      [completed, { ...created, status: 'unpaid', purgeAfter, eventCreated: later(1) }],
      { ...created, status: 'active', eventCreated: later(2) },
      { outcome: 'recorded', turnedPaid: true },
    ],
    [
      'a new subscription that replaces a canceled one paid turns the channel paid',
      [completed, { ...ended, eventCreated: later(1) }],
      { ...completed, subscription: 'sub_test_b', eventCreated: later(2) },
      { outcome: 'recorded', turnedPaid: true },
    ],
    [
      'a renewal of a paid subscription turns nothing paid',
      [completed, created],
      {
        ...created,
        status: 'active',
        periodEnd: new Date('2027-01-17T12:00:00.000Z'),
        eventCreated: later(1),
      },
      { outcome: 'recorded', turnedPaid: false },
    ],
    [
      'a paid retry of a past due subscription turns nothing paid',
      [completed, { ...created, status: 'past_due', eventCreated: later(1) }],
      { ...created, status: 'active', eventCreated: later(2) },
      { outcome: 'recorded', turnedPaid: false },
    ],
    [
      "an older event that only fills the period end a paid row's Checkout left out turns nothing paid",
      [{ ...completed, eventCreated: later(1) }],
      { ...created, status: 'active' },
      { outcome: 'recorded', turnedPaid: false },
    ],
    [
      'an older event that only fills the period end of a row not paid turns nothing paid',
      [{ ...created, periodEnd: null, eventCreated: later(1) }],
      { ...created, status: 'active' },
      { outcome: 'recorded', turnedPaid: false },
    ],
    [
      'a repeated delivery of the event that turned the channel paid turns nothing paid',
      [completed],
      completed,
      { outcome: 'unchanged', turnedPaid: false },
    ],
  ])('%s', async ([, before, event, answer], { web, worker }) => {
    const channelId = await freeChannel(web, worker, 'subscriptions-owner')
    for (const earlier of before) await web.asAnonymous(record(channelId, earlier))

    expect(await web.asAnonymous(recordTurn(channelId, event))).toEqual(answer)
  })
})
