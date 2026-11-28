import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import {
  channels,
  memberships,
  proEnds,
  proPicks,
  subscriptions,
  userSubscriptions,
} from '../src/schema.ts'
import type { Scoped, ScopeKind, WebDatabase, WorkerDatabase } from '../src/scopes.ts'
import { test } from './harness.ts'
import { grantBlocks, recordUserSubscription, unpickChannel } from './pro.ts'
import { seedChannel, seedUser } from './seed.ts'

interface Recorded {
  customer: string
  subscription: string
  plan: 'monthly' | 'annual' | null
  status: string | null
  periodEnd: Date | null
  quantity?: number | null
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

const ownerId = 'subscriptions-owner'

/**
 * A channel the user owns, connected at `connectedAt`, with no pick and no end of Pro, written as
 * the claim writes it.
 */
async function ownedChannel(
  web: WebDatabase,
  worker: WorkerDatabase,
  userId: string,
  connectedAt = createdAt,
  role: 'owner' | 'member' = 'owner',
) {
  await seedUser(web, userId)
  const channelId = randomUUID()
  await worker.forChannel(channelId, async (scope) => {
    await scope.sql.insert(channels).values({ id: channelId, youtubeChannelId: `UC${channelId}` })
    await scope.sql
      .insert(memberships)
      .values({ channelId, userId, role: role as 'owner', createdAt: connectedAt })
  })
  return channelId
}

/** A channel of `ownerId`'s, which the user holds without owning it. */
async function memberChannel(web: WebDatabase, worker: WorkerDatabase, userId: string) {
  const channelId = await ownedChannel(web, worker, 'subscriptions-other-owner')
  await seedUser(web, userId)
  await worker.forChannel(channelId, (scope) =>
    scope.sql.insert(memberships).values({ channelId, userId, role: 'member' as 'owner' }),
  )
  return channelId
}

/** What record_user_subscription answers for the user's event, and the channels it turned Pro. */
function recordTurn(userId: string | null, fields: Recorded, legacyChannelId?: string) {
  return (scope: Scoped<'anonymous'>) =>
    recordUserSubscription(scope, {
      ...fields,
      userId,
      legacyChannelId: legacyChannelId ?? null,
      eventCreated: fields.eventCreated ?? createdAt,
    })
}

function record(userId: string | null, fields: Recorded, legacyChannelId?: string) {
  return (scope: Scoped<'anonymous'>) =>
    recordTurn(userId, fields, legacyChannelId)(scope).then(({ outcome }) => outcome)
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
      customer: userSubscriptions.stripeCustomerId,
      subscription: userSubscriptions.stripeSubscriptionId,
      plan: userSubscriptions.plan,
      status: userSubscriptions.status,
      quantity: userSubscriptions.quantity,
      periodEnd: userSubscriptions.currentPeriodEnd,
    })
    .from(userSubscriptions)
}

/** Whether the channel is Pro, as pro_state answers the scope. */
function proStateOf(channelId: string) {
  return (scope: Scoped<ScopeKind>) =>
    scope.sql
      .execute<{ pro: boolean }>(sql`select pro_state(${channelId}::uuid) as pro`)
      .then(({ rows }) => rows[0]?.pro)
}

/** The purge date on the channel's pro_ends row, null for none or a cleared one. */
function purgeOf(channelId: string) {
  return (scope: Scoped<ScopeKind>) =>
    scope.sql
      .select({ purgeAfter: proEnds.purgeAfter })
      .from(proEnds)
      .where(eq(proEnds.channelId, channelId))
      .then(([row]) => row?.purgeAfter ?? null)
}

const purgeAfter = new Date('2027-01-16T12:00:00.000Z')
const ended: Recorded = { ...created, status: 'canceled', purgeAfter }

describe("record_user_subscription, the end of a user's subscription and the purge date of its picked channel (#787)", () => {
  let picked = ''

  async function paidChannel(web: WebDatabase, worker: WorkerDatabase) {
    picked = await ownedChannel(web, worker, ownerId)
    await web.asAnonymous(record(ownerId, completed))
    await web.asAnonymous(record(ownerId, created))
    return picked
  }

  /** The user's subscription as 0040's tests read a channel's, with its picked channel's purge date. */
  const stored = async (web: WebDatabase) => {
    const [row] = await web.asUser(ownerId, readSubscriptions)
    if (!row) return undefined
    const { quantity: _, ...fields } = row
    return { ...fields, purgeAfter: await web.asUser(ownerId, purgeOf(picked)) }
  }

  test('an end event stores its purge date with the canceled status', async ({ web, worker }) => {
    await paidChannel(web, worker)

    expect(await web.asAnonymous(record(ownerId, ended))).toBe('recorded')
    expect(await stored(web)).toMatchObject({ status: 'canceled', purgeAfter })
  })

  test('a later end event never moves the purge date', async ({ web, worker }) => {
    await paidChannel(web, worker)
    await web.asAnonymous(record(ownerId, { ...created, status: 'unpaid', purgeAfter }))

    const later = new Date('2027-02-01T12:00:00.000Z')
    await web.asAnonymous(record(ownerId, { ...ended, purgeAfter: later }))

    expect(await stored(web)).toMatchObject({ status: 'canceled', purgeAfter })
  })

  test('a paid status clears the purge date, so a return before it keeps the history', async ({
    web,
    worker,
  }) => {
    await paidChannel(web, worker)
    await web.asAnonymous(record(ownerId, { ...created, status: 'unpaid', purgeAfter }))

    expect(await web.asAnonymous(record(ownerId, { ...created, status: 'active' }))).toBe(
      'recorded',
    )
    expect(await stored(web)).toMatchObject({ status: 'active', purgeAfter: null })
  })

  test('the same subscription, once canceled, stays canceled with its purge date whatever a later event says', async ({
    web,
    worker,
  }) => {
    await paidChannel(web, worker)
    await web.asAnonymous(record(ownerId, ended))

    expect(await web.asAnonymous(record(ownerId, { ...created, status: 'active' }))).toBe(
      'unchanged',
    )
    expect(await web.asAnonymous(record(ownerId, ended))).toBe('unchanged')
    expect(await stored(web)).toMatchObject({ status: 'canceled', purgeAfter })
  })

  test('an event of the same subscription older than the newest the row holds changes nothing', async ({
    web,
    worker,
  }) => {
    await paidChannel(web, worker)
    const later = new Date('2026-11-20T12:00:00.000Z')
    const annual = { ...created, plan: 'annual', status: 'active', eventCreated: later } as const
    await web.asAnonymous(record(ownerId, annual))

    const older = { ...created, status: 'unpaid', purgeAfter, eventCreated: createdAt }
    expect(await web.asAnonymous(record(ownerId, older))).toBe('unchanged')
    expect(await stored(web)).toMatchObject({ plan: 'annual', status: 'active', purgeAfter: null })
  })

  test('an event that changes no field still moves the time on, so an older one cannot undo it', async ({
    web,
    worker,
  }) => {
    await paidChannel(web, worker)
    const confirmed = new Date('2026-11-20T12:00:00.000Z')
    await web.asAnonymous(
      record(ownerId, { ...created, status: 'active', eventCreated: confirmed }),
    )

    const between = new Date('2026-11-18T12:00:00.000Z')
    await web.asAnonymous(
      record(ownerId, { ...created, status: 'unpaid', purgeAfter, eventCreated: between }),
    )

    expect(await stored(web)).toMatchObject({ status: 'active', purgeAfter: null })
  })

  test('a new subscription replaces an ended one with its own plan, status and period end, and a paid one clears the purge date', async ({
    web,
    worker,
  }) => {
    await paidChannel(web, worker)
    await web.asAnonymous(record(ownerId, ended))
    const newPeriodEnd = new Date('2028-01-20T12:00:00.000Z')

    const outcome = await web.asAnonymous(
      record(ownerId, {
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
    await paidChannel(web, worker)
    await web.asAnonymous(record(ownerId, ended))

    await web.asAnonymous(
      record(ownerId, {
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

  test('a live event of another subscription never re-points a paid user, and answers that it is another subscription', async ({
    web,
    worker,
  }) => {
    await paidChannel(web, worker)
    const before = await stored(web)

    const outcome = await web.asAnonymous(
      record(ownerId, { ...created, subscription: 'sub_test_old', status: 'active' }),
    )

    expect(outcome).toBe('other_subscription')
    expect(await stored(web)).toEqual(before)
  })

  test('a canceled other subscription says nothing of a paid user', async ({ web, worker }) => {
    await paidChannel(web, worker)
    const before = await stored(web)

    const outcome = await web.asAnonymous(
      record(ownerId, { ...ended, subscription: 'sub_test_old' }),
    )

    expect(outcome).toBe('unchanged')
    expect(await stored(web)).toEqual(before)
  })

  test('an older event of another subscription never replaces a new one not paid yet', async ({
    web,
    worker,
  }) => {
    await paidChannel(web, worker)
    const resubscribed = new Date('2026-11-20T12:00:00.000Z')
    await web.asAnonymous(record(ownerId, ended))
    const again = { ...created, subscription: 'sub_test_b', eventCreated: resubscribed }
    await web.asAnonymous(record(ownerId, again))
    const before = await stored(web)

    const late = { ...created, status: 'active', eventCreated: createdAt }
    expect(await web.asAnonymous(record(ownerId, late))).toBe('unchanged')
    expect(await stored(web)).toEqual(before)
    expect(before).toMatchObject({ subscription: 'sub_test_b', status: 'incomplete' })
  })

  test("an older event of the stored subscription fills what the row holds as null, so a new subscription's Checkout first keeps its period end", async ({
    web,
    worker,
  }) => {
    await paidChannel(web, worker)
    await web.asAnonymous(record(ownerId, ended))
    const resubscribed = new Date('2026-11-20T12:00:00.000Z')
    const newPeriodEnd = new Date('2027-11-20T12:00:00.000Z')
    const b = { ...completed, subscription: 'sub_test_b' }
    await web.asAnonymous(
      record(ownerId, { ...b, eventCreated: new Date('2026-11-20T12:00:02.000Z') }),
    )

    const createdB: Recorded = { ...b, plan: 'annual', status: null, periodEnd: newPeriodEnd }
    expect(
      await web.asAnonymous(record(ownerId, { ...createdB, eventCreated: resubscribed })),
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

  test('a canceled other subscription says nothing of the user', async ({ web, worker }) => {
    await paidChannel(web, worker)
    await web.asAnonymous(record(ownerId, ended))
    const before = await stored(web)

    const outcome = await web.asAnonymous(
      record(ownerId, {
        ...ended,
        subscription: 'sub_test_old',
        purgeAfter: new Date('2026-12-01T12:00:00.000Z'),
      }),
    )

    expect(outcome).toBe('unchanged')
    expect(await stored(web)).toEqual(before)
  })
})

describe("record_user_subscription, the one write path of the anonymous scope to a user's subscription", () => {
  test("records the user's subscription with its quantity, which the user reads", async ({
    web,
    worker,
  }) => {
    await ownedChannel(web, worker, ownerId)

    const outcome = await web.asAnonymous(record(ownerId, { ...completed, quantity: 2 }))

    expect(outcome).toBe('recorded')
    expect(await web.asUser(ownerId, readSubscriptions)).toEqual([
      {
        customer: 'cus_test_a',
        subscription: 'sub_test_a',
        plan: null,
        status: 'active',
        quantity: 2,
        periodEnd: null,
      },
    ])
  })

  test('the same fields again answer unchanged', async ({ web, worker }) => {
    await ownedChannel(web, worker, ownerId)
    await web.asAnonymous(record(ownerId, completed))

    expect(await web.asAnonymous(record(ownerId, completed))).toBe('unchanged')
  })

  test('a null quantity, the Checkout event, keeps the stored quantity, and is 1 for a new row', async ({
    web,
    worker,
  }) => {
    await ownedChannel(web, worker, ownerId)
    await web.asAnonymous(record(ownerId, completed))
    const first = await web.asUser(ownerId, readSubscriptions)

    await web.asAnonymous(
      record(ownerId, { ...created, quantity: 3, eventCreated: new Date('2026-11-18T12:00:00Z') }),
    )
    await web.asAnonymous(
      record(ownerId, { ...completed, eventCreated: new Date('2026-11-19T12:00:00Z') }),
    )

    expect(first).toMatchObject([{ quantity: 1 }])
    expect(await web.asUser(ownerId, readSubscriptions)).toMatchObject([{ quantity: 3 }])
  })

  // Stripe creates the subscription before its Checkout completes, so the Checkout is the newer.
  const completedLater = { ...completed, eventCreated: new Date('2026-11-17T12:00:02.000Z') }

  test.for([
    ['the completed Checkout first', [completedLater, created]],
    ['the created subscription first', [created, completedLater]],
  ] as const)(
    'a null keeps the stored value, so %s ends in the same row',
    async ([, events], { web, worker }) => {
      await ownedChannel(web, worker, ownerId)
      for (const event of events) await web.asAnonymous(record(ownerId, event))

      expect(await web.asUser(ownerId, readSubscriptions)).toEqual([
        {
          customer: 'cus_test_a',
          subscription: 'sub_test_a',
          plan: 'monthly',
          status: 'active',
          quantity: 1,
          periodEnd,
        },
      ])
    },
  )

  test('a user that does not exist answers no_user and records nothing', async ({ web }) => {
    expect(await web.asAnonymous(record('subscriptions-nobody', completed))).toBe('no_user')
  })

  test("a subscription made before blocks names a channel, and records onto the channel's owner", async ({
    web,
    worker,
  }) => {
    const channelId = await ownedChannel(web, worker, ownerId)

    expect(await web.asAnonymous(record(null, completed, channelId))).toBe('recorded')
    expect(await web.asUser(ownerId, readSubscriptions)).toMatchObject([
      { subscription: 'sub_test_a', status: 'active', quantity: 1 },
    ])
    expect(await web.asUser(ownerId, proStateOf(channelId))).toBe(true)
  })

  test('a channel that does not exist, or one with no owner, answers no_user', async ({
    web,
    worker,
  }) => {
    const ownerless = randomUUID()
    await worker.forChannel(ownerless, (scope) =>
      scope.sql.insert(channels).values({ id: ownerless, youtubeChannelId: `UC${ownerless}` }),
    )

    expect(await web.asAnonymous(record(null, completed, randomUUID()))).toBe('no_user')
    expect(await web.asAnonymous(record(null, completed, ownerless))).toBe('no_user')
  })

  test('runs only in the anonymous scope', async ({ web, worker }) => {
    await seedUser(web, ownerId)
    const channelId = randomUUID()
    const attempt = (scope: Scoped<ScopeKind>) =>
      refusalOf(scope, (each) => record(ownerId, completed)(each as Scoped<'anonymous'>))
    // app_web holds EXECUTE on the function and the function checks the scope; app_worker holds none.
    const refused = {
      cause: { message: 'record_user_subscription runs only in the anonymous scope' },
    }
    const denied = { cause: { message: 'permission denied for function record_user_subscription' } }

    expect(await web.asUser(ownerId, attempt)).toMatchObject(refused)
    expect(await web.asAdmin(ownerId, attempt)).toMatchObject(refused)
    expect(await worker.forChannel(channelId, attempt)).toMatchObject(denied)
    expect(await worker.asSystem(attempt)).toMatchObject(denied)
  })

  test('the anonymous scope reads and writes no subscription or pick row itself, and the user writes none either', async ({
    web,
    worker,
  }) => {
    const channelId = await ownedChannel(web, worker, ownerId)
    await web.asAnonymous(record(ownerId, completed))
    const writes = async (scope: Scoped<ScopeKind>) => ({
      updated: (await scope.sql.update(userSubscriptions).set({ status: 'canceled' })).rowCount,
      inserted: await refusalOf(scope, (attempt) =>
        attempt.sql.insert(userSubscriptions).values({
          userId: ownerId,
          stripeCustomerId: 'cus_test_b',
          stripeSubscriptionId: 'sub_test_b',
          status: 'active',
          quantity: 9,
          updatedAt: attempt.now,
        }),
      ),
      unpicked: (await scope.sql.delete(proPicks)).rowCount,
      picked: await refusalOf(scope, (attempt) =>
        attempt.sql.insert(proPicks).values({ channelId, userId: ownerId, pickedAt: attempt.now }),
      ),
    })
    const refusedEverything = {
      updated: 0,
      inserted: {
        cause: {
          message: 'new row violates row-level security policy for table "user_subscriptions"',
        },
      },
      unpicked: 0,
      picked: {
        cause: { message: 'new row violates row-level security policy for table "pro_picks"' },
      },
    }

    expect(await web.asAnonymous(readSubscriptions)).toEqual([])
    expect(await web.asAnonymous((scope) => scope.sql.select().from(proPicks))).toEqual([])
    expect(await web.asAnonymous(writes)).toMatchObject(refusedEverything)
    expect(await web.asUser(ownerId, writes)).toMatchObject(refusedEverything)
    expect(await web.asUser(ownerId, proStateOf(channelId))).toBe(true)
  })

  test("the release before blocks' record_subscription and record_subscription_payment raise, so an old image's delivery answers 500 and Stripe delivers it again", async ({
    web,
    worker,
  }) => {
    const channelId = await ownedChannel(web, worker, ownerId)
    const legacy = (scope: Scoped<ScopeKind>) =>
      refusalOf(scope, (each) =>
        each.sql.execute(
          sql`select * from record_subscription(${channelId}::uuid, 'cus_test_a', 'sub_test_a', null, 'active', null, null, ${createdAt.toISOString()}::timestamptz)`,
        ),
      )
    const legacyPayment = (scope: Scoped<ScopeKind>) =>
      refusalOf(scope, (each) =>
        each.sql.execute(sql`select record_subscription_payment('in_test_a', ${channelId}::uuid)`),
      )

    expect(await web.asAnonymous(legacy)).toMatchObject({
      cause: { message: expect.stringContaining('record_subscription is retired') },
    })
    expect(await web.asAnonymous(legacyPayment)).toMatchObject({
      cause: { message: expect.stringContaining('record_subscription_payment is retired') },
    })
    expect(
      await worker.forChannel(channelId, (scope) => scope.sql.select().from(subscriptions)),
    ).toEqual([])
  })
})

const later = (minutes: number) => new Date(createdAt.getTime() + minutes * 60_000)

describe('record_user_subscription reports the channels it turned Pro (#1034)', () => {
  // Each row records `before` in order, then answers what `event` reports.
  test.for<[string, Recorded[], Recorded, { outcome: string; turnedPaid: boolean }]>([
    [
      'a first event of a paid subscription turns the channel Pro',
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
    const channelId = await ownedChannel(web, worker, ownerId)
    for (const earlier of before) await web.asAnonymous(record(ownerId, earlier))

    const { outcome, turnedPro } = await web.asAnonymous(recordTurn(ownerId, event))
    expect({ outcome, turnedPaid: turnedPro.includes(channelId) }).toEqual(answer)
  })
})

const hour = 60 * 60 * 1000
const connected = (n: number) => new Date(createdAt.getTime() - (10 - n) * hour)

describe("a block of Pro covers 4 of the user's channels (stillstats#20)", () => {
  /** The user's owned channels, connected in the order given. */
  async function ownedChannels(web: WebDatabase, worker: WorkerDatabase, count: number) {
    const ids: string[] = []
    // Connected out of order of their ids, so the fill is shown to follow the connection.
    for (let n = count; n > 0; n--) {
      ids.unshift(await ownedChannel(web, worker, ownerId, connected(n)))
    }
    return ids
  }

  const proStates = (web: WebDatabase, ids: string[]) =>
    web.asUser(ownerId, async (scope) => {
      const states: boolean[] = []
      for (const id of ids) states.push((await proStateOf(id)(scope)) ?? false)
      return states
    })

  test('a purchase picks up to 4 owned channels in connection order and answers them; a fifth stays free', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 5)

    const { turnedPro } = await web.asAnonymous(recordTurn(ownerId, completed))

    expect(turnedPro).toEqual(ids.slice(0, 4))
    expect(await proStates(web, ids)).toEqual([true, true, true, true, false])
  })

  test('a channel the user holds without owning it is never picked, and never Pro', async ({
    web,
    worker,
  }) => {
    const owned = await ownedChannel(web, worker, ownerId)
    const held = await memberChannel(web, worker, ownerId)

    const { turnedPro } = await web.asAnonymous(recordTurn(ownerId, completed))

    expect(turnedPro).toEqual([owned])
    expect(await proStates(web, [owned, held])).toEqual([true, false])
    // The stored pick, which the answer and the Pro state both filter on ownership again.
    expect(
      await worker.forChannel(held, (scope) =>
        scope.sql.select({ userId: proPicks.userId }).from(proPicks),
      ),
    ).toEqual([])
  })

  test('a second block covers 4 more channels', async ({ web, worker }) => {
    const ids = await ownedChannels(web, worker, 6)

    await web.asAnonymous(record(ownerId, { ...completed, quantity: 2 }))

    expect(await proStates(web, ids)).toEqual(ids.map(() => true))
  })

  test('an end gives every picked channel the purge date, and a return before it clears them and keeps the same channels', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 5)
    await web.asAnonymous(record(ownerId, completed))
    const purgeAfter = new Date('2027-01-16T12:00:00.000Z')

    await web.asAnonymous(
      record(ownerId, { ...created, status: 'unpaid', purgeAfter, eventCreated: later(1) }),
    )
    const ended = await web.asUser(ownerId, async (scope) =>
      Promise.all(ids.map((id) => purgeOf(id)(scope))),
    )
    await web.asAnonymous(record(ownerId, { ...created, status: 'active', eventCreated: later(2) }))
    const returned = await web.asUser(ownerId, async (scope) =>
      Promise.all(ids.map((id) => purgeOf(id)(scope))),
    )

    expect(ended).toEqual([purgeAfter, purgeAfter, purgeAfter, purgeAfter, null])
    expect(returned).toEqual(ids.map(() => null))
    expect(await proStates(web, ids)).toEqual([true, true, true, true, false])
  })

  test('a later end keeps the purge date each picked channel holds', async ({ web, worker }) => {
    const [channelId = ''] = await ownedChannels(web, worker, 1)
    await web.asAnonymous(record(ownerId, completed))
    const purgeAfter = new Date('2027-01-16T12:00:00.000Z')
    await web.asAnonymous(
      record(ownerId, { ...created, status: 'unpaid', purgeAfter, eventCreated: later(1) }),
    )

    await web.asAnonymous(
      record(ownerId, {
        ...created,
        status: 'canceled',
        purgeAfter: new Date('2027-02-01T12:00:00.000Z'),
        eventCreated: later(2),
      }),
    )

    expect(await web.asUser(ownerId, purgeOf(channelId))).toEqual(purgeAfter)
  })

  test('a disconnect frees its slot at once, before the deletion removes the pick', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 5)
    await web.asAnonymous(record(ownerId, completed))
    const [first = ''] = ids

    // What a disconnect does at once: the user ends their membership, and the channel waits for
    // its deletion with its rows.
    await web.asUser(ownerId, (scope) =>
      scope.sql.delete(memberships).where(eq(memberships.channelId, first)),
    )

    expect(await proStates(web, ids.slice(1))).toEqual([true, true, true, false])
    expect(await worker.forChannel(first, proStateOf(first))).toBe(false)
  })
})

describe('a block added while paid fills its new slots at once (stillstats#22)', () => {
  /** The user's owned channels, connected in the order given, out of order of their ids. */
  async function ownedChannels(web: WebDatabase, worker: WorkerDatabase, count: number) {
    const ids: string[] = []
    for (let n = count; n > 0; n--) {
      ids.unshift(await ownedChannel(web, worker, ownerId, connected(n)))
    }
    return ids
  }

  const proStates = (web: WebDatabase, ids: string[]) =>
    web.asUser(ownerId, async (scope) => {
      const states: boolean[] = []
      for (const id of ids) states.push((await proStateOf(id)(scope)) ?? false)
      return states
    })

  const raise = (quantity: number, minutes: number) =>
    recordTurn(ownerId, { ...created, status: 'active', quantity, eventCreated: later(minutes) })

  test('a raise from 1 block to 2 picks the fifth and sixth channels in connection order and answers only them', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 6)
    await web.asAnonymous(record(ownerId, completed))

    const { outcome, turnedPro } = await web.asAnonymous(raise(2, 1))

    expect(outcome).toBe('recorded')
    expect(turnedPro).toEqual(ids.slice(4))
    expect(await proStates(web, ids)).toEqual(ids.map(() => true))
  })

  test('a raise for an owner whose every channel is already picked answers nothing', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 3)
    await web.asAnonymous(record(ownerId, completed))

    const { outcome, turnedPro } = await web.asAnonymous(raise(2, 1))

    expect({ outcome, turnedPro }).toEqual({ outcome: 'recorded', turnedPro: [] })
    expect(await web.asUser(ownerId, readSubscriptions)).toMatchObject([{ quantity: 2 }])
    expect(await proStates(web, ids)).toEqual([true, true, true])
  })

  test('an older event carrying a higher quantity raises nothing and picks nothing', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 5)
    await web.asAnonymous(record(ownerId, { ...completed, eventCreated: later(2) }))

    const { outcome, turnedPro } = await web.asAnonymous(raise(2, 1))

    expect(turnedPro).toEqual([])
    expect(outcome).toBe('recorded')
    expect(await web.asUser(ownerId, readSubscriptions)).toMatchObject([{ quantity: 1 }])
    expect(await proStates(web, ids)).toEqual([true, true, true, true, false])
  })

  test('a channel the user holds without owning it is never picked on a raise', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 5)
    const held = await memberChannel(web, worker, ownerId)
    await web.asAnonymous(record(ownerId, completed))

    const { turnedPro } = await web.asAnonymous(raise(2, 1))

    expect(turnedPro).toEqual(ids.slice(4))
    expect(await proStates(web, [held])).toEqual([false])
    expect(
      await worker.forChannel(held, (scope) =>
        scope.sql.select({ userId: proPicks.userId }).from(proPicks),
      ),
    ).toEqual([])
  })

  test('a channel taken out of its block is picked again by the raise, and keeps its history', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 4)
    const [first = ''] = ids
    await web.asAnonymous(record(ownerId, completed))
    await web.asUser(ownerId, (scope) => unpickChannel(scope, first, purgeAfter))

    const { turnedPro } = await web.asAnonymous(raise(2, 1))

    expect(turnedPro).toEqual([first])
    expect(await web.asUser(ownerId, purgeOf(first))).toBeNull()
    expect(await proStates(web, ids)).toEqual([true, true, true, true])
  })

  test('picks a cut left outside the capacity count again on a raise, and the raise picks nothing more', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 9)
    await web.asAnonymous(record(ownerId, { ...completed, quantity: 2 }))
    const cut = await web.asAnonymous(raise(1, 1))

    const { turnedPro } = await web.asAnonymous(raise(2, 2))

    expect(cut.turnedPro).toEqual([])
    expect(turnedPro).toEqual(ids.slice(4, 8))
    expect(await proStates(web, ids)).toEqual([...ids.slice(0, 8).map(() => true), false])
  })

  test('a repeated delivery of the raise answers unchanged and nothing turned Pro', async ({
    web,
    worker,
  }) => {
    await ownedChannels(web, worker, 6)
    await web.asAnonymous(record(ownerId, completed))
    await web.asAnonymous(raise(2, 1))

    const { outcome, turnedPro } = await web.asAnonymous(raise(2, 1))

    expect({ outcome, turnedPro }).toEqual({ outcome: 'unchanged', turnedPro: [] })
  })

  test('a later paid event at the same quantity, as a renewal sends, picks nothing again: a channel taken out stays out and keeps its purge date', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 4)
    const [first = ''] = ids
    await web.asAnonymous(record(ownerId, completed))
    await web.asUser(ownerId, (scope) => unpickChannel(scope, first, purgeAfter))

    const { outcome, turnedPro } = await web.asAnonymous(raise(1, 1))

    expect({ outcome, turnedPro }).toEqual({ outcome: 'recorded', turnedPro: [] })
    expect(await web.asUser(ownerId, purgeOf(first))).toEqual(purgeAfter)
    expect(await proStates(web, ids)).toEqual([false, true, true, true])
  })
})

describe('the granted slots come first in the capacity a subscription counts (stillstats#24)', () => {
  /** The user's owned channels, connected in the order given, out of order of their ids. */
  async function ownedChannels(web: WebDatabase, worker: WorkerDatabase, count: number) {
    const ids: string[] = []
    for (let n = count; n > 0; n--) {
      ids.unshift(await ownedChannel(web, worker, ownerId, connected(n)))
    }
    return ids
  }

  const proStates = (web: WebDatabase, ids: string[]) =>
    web.asUser(ownerId, async (scope) => {
      const states: boolean[] = []
      for (const id of ids) states.push((await proStateOf(id)(scope)) ?? false)
      return states
    })

  const purges = (web: WebDatabase, ids: string[]) =>
    web.asUser(ownerId, (scope) => Promise.all(ids.map((id) => purgeOf(id)(scope))))

  const grant = (web: WebDatabase, blocks = 1) =>
    grantBlocks(web, { email: `${ownerId}@example.com`, blocks })

  test('a granted user who buys a block gets the next 4 owned channels picked, and only those turned Pro', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(later(-1))
    const ids = await ownedChannels(web, worker, 9)
    await grant(web)

    const { turnedPro } = await web.asAnonymous(recordTurn(ownerId, completed))

    expect(turnedPro).toEqual(ids.slice(4, 8))
    expect(await proStates(web, ids)).toEqual([...ids.slice(0, 8).map(() => true), false])
  })

  test('a granted user whose subscription ends keeps the granted 4 Pro, and the paid 4 get the purge date', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(later(-1))
    const ids = await ownedChannels(web, worker, 8)
    await grant(web)
    await web.asAnonymous(record(ownerId, completed))

    await web.asAnonymous(record(ownerId, { ...ended, eventCreated: later(1) }))

    expect(await proStates(web, ids)).toEqual([
      ...ids.slice(0, 4).map(() => true),
      false,
      false,
      false,
      false,
    ])
    expect(await purges(web, ids)).toEqual([
      null,
      null,
      null,
      null,
      ...ids.slice(4).map(() => purgeAfter),
    ])
  })

  test('a raise of a granted user picks past the granted and the stored paid slots, and answers only those', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(later(-1))
    const ids = await ownedChannels(web, worker, 13)
    await grant(web)
    await web.asAnonymous(record(ownerId, completed))

    const { turnedPro } = await web.asAnonymous(
      recordTurn(ownerId, { ...created, status: 'active', quantity: 2, eventCreated: later(1) }),
    )

    expect(turnedPro).toEqual(ids.slice(8, 12))
    expect(await proStates(web, ids)).toEqual([...ids.slice(0, 12).map(() => true), false])
  })
})

describe('pro_state answers only for a channel the scope admits', () => {
  test("the owner, a member and the channel's own scope read it; another user and another channel's scope read false", async ({
    web,
    worker,
  }) => {
    const channelId = await ownedChannel(web, worker, ownerId)
    await seedUser(web, 'subscriptions-member')
    await worker.forChannel(channelId, (scope) =>
      scope.sql
        .insert(memberships)
        .values({ channelId, userId: 'subscriptions-member', role: 'member' as 'owner' }),
    )
    await seedUser(web, 'subscriptions-stranger')
    await web.asAnonymous(record(ownerId, completed))

    expect(await web.asUser(ownerId, proStateOf(channelId))).toBe(true)
    expect(await web.asUser('subscriptions-member', proStateOf(channelId))).toBe(true)
    expect(await worker.forChannel(channelId, proStateOf(channelId))).toBe(true)
    expect(await web.asUser('subscriptions-stranger', proStateOf(channelId))).toBe(false)
    expect(await worker.forChannel(randomUUID(), proStateOf(channelId))).toBe(false)
    expect(await web.asAnonymous(proStateOf(channelId))).toBe(false)
    expect(await worker.asSystem(proStateOf(channelId))).toBe(false)
  })

  test("a member reads no row of the owner's subscription", async ({ web, worker }) => {
    const channelId = await ownedChannel(web, worker, ownerId)
    await seedUser(web, 'subscriptions-member')
    await worker.forChannel(channelId, (scope) =>
      scope.sql
        .insert(memberships)
        .values({ channelId, userId: 'subscriptions-member', role: 'member' as 'owner' }),
    )
    await web.asAnonymous(record(ownerId, completed))

    expect(await web.asUser('subscriptions-member', readSubscriptions)).toEqual([])
    expect(await worker.forChannel(channelId, readSubscriptions)).toEqual([])
  })
})

test('a seeded channel is picked and free, so a test of Pro starts from the free tier', async ({
  web,
  worker,
}) => {
  const channelId = await seedChannel(web, worker, ownerId)

  expect(await worker.forChannel(channelId, proStateOf(channelId))).toBe(false)
  expect(
    await worker.forChannel(channelId, (scope) =>
      scope.sql.select({ userId: proPicks.userId }).from(proPicks),
    ),
  ).toEqual([{ userId: ownerId }])
})
