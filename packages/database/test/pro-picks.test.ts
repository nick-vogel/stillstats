import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { channels, memberships, proEnds, proPicks } from '../src/schema.ts'
import type { Scoped, ScopeKind, WebDatabase, WorkerDatabase } from '../src/scopes.ts'
import { test } from './harness.ts'
import { pickChannel, recordUserSubscription, unpickChannel } from './pro.ts'
import { seedUser } from './seed.ts'

const ownerId = 'picks-owner'
const connectedAt = new Date('2026-11-17T12:00:00.000Z')
const dayMs = 24 * 60 * 60 * 1000

/** The time `n` minutes after the first channel was connected. */
const connected = (n: number) => new Date(connectedAt.getTime() + n * 60 * 1000)

/** A channel the user holds, connected at `at`, with no pick and no end of Pro. */
async function heldChannel(
  web: WebDatabase,
  worker: WorkerDatabase,
  userId: string,
  at: Date,
  role: 'owner' | 'member' = 'owner',
) {
  await seedUser(web, userId)
  const channelId = randomUUID()
  await worker.forChannel(channelId, async (scope) => {
    await scope.sql.insert(channels).values({ id: channelId, youtubeChannelId: `UC${channelId}` })
    await scope.sql
      .insert(memberships)
      .values({ channelId, userId, role: role as 'owner', createdAt: at })
  })
  return channelId
}

/** The owner's channels, connected in the order given. */
async function ownedChannels(web: WebDatabase, worker: WorkerDatabase, count: number) {
  const ids: string[] = []
  for (let n = 1; n <= count; n++) ids.push(await heldChannel(web, worker, ownerId, connected(n)))
  return ids
}

/** The owner subscribes to `quantity` blocks, whose fill picks their oldest channels. */
function subscribe(web: WebDatabase, { quantity = 1, status = 'active' } = {}) {
  return web.asAnonymous((scope) =>
    recordUserSubscription(scope, {
      userId: ownerId,
      customer: 'cus_picks',
      subscription: 'sub_picks',
      plan: 'monthly',
      status,
      periodEnd: null,
      quantity,
      eventCreated: connected(100),
    }),
  )
}

function proStatesOf(web: WebDatabase, ids: string[]) {
  return web.asUser(ownerId, async (scope) => {
    const states: boolean[] = []
    for (const id of ids) {
      const { rows } = await scope.sql.execute<{ pro: boolean }>(
        sql`select pro_state(${id}::uuid) as pro`,
      )
      states.push(rows[0]?.pro === true)
    }
    return states
  })
}

function purgeOf(web: WebDatabase, channelId: string) {
  return web.asUser(ownerId, (scope) =>
    scope.sql
      .select({ endedAt: proEnds.endedAt, purgeAfter: proEnds.purgeAfter })
      .from(proEnds)
      .where(eq(proEnds.channelId, channelId))
      .then(([row]) => row ?? null),
  )
}

function picksOf(web: WebDatabase, userId: string) {
  return web.asUser(userId, (scope) =>
    scope.sql.select({ channelId: proPicks.channelId, userId: proPicks.userId }).from(proPicks),
  )
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

describe("pick_pro_channel, the owner's pick of a channel into a free slot (stillstats#21)", () => {
  test('an owner picks a channel into a free slot, and it turns Pro', async ({ web, worker }) => {
    const [first = ''] = await ownedChannels(web, worker, 1)
    await subscribe(web)
    await web.asUser(ownerId, (scope) => unpickChannel(scope, first, connected(200)))
    const second = await heldChannel(web, worker, ownerId, connected(2))

    const answer = await web.asUser(ownerId, (scope) => pickChannel(scope, second))

    expect(answer).toEqual({ outcome: 'picked', turnedPro: [second] })
    expect(await proStatesOf(web, [first, second])).toEqual([false, true])
  })

  test('a channel already picked answers unchanged', async ({ web, worker }) => {
    const [first = ''] = await ownedChannels(web, worker, 1)
    await subscribe(web)

    expect(await web.asUser(ownerId, (scope) => pickChannel(scope, first))).toEqual({
      outcome: 'unchanged',
      turnedPro: [],
    })
  })

  test("a member who isn't the owner answers not_owner and picks nothing", async ({
    web,
    worker,
  }) => {
    await ownedChannels(web, worker, 1)
    await subscribe(web)
    const held = await heldChannel(web, worker, 'picks-other-owner', connected(2))
    await worker.forChannel(held, (scope) =>
      scope.sql
        .insert(memberships)
        .values({ channelId: held, userId: ownerId, role: 'member' as 'owner' }),
    )

    expect(await web.asUser(ownerId, (scope) => pickChannel(scope, held))).toEqual({
      outcome: 'not_owner',
      turnedPro: [],
    })
    expect(await worker.forChannel(held, (scope) => scope.sql.select().from(proPicks))).toEqual([])
  })

  test('a channel the user does not hold answers not_connected', async ({ web, worker }) => {
    await ownedChannels(web, worker, 1)
    await subscribe(web)
    const stranger = await heldChannel(web, worker, 'picks-other-owner', connected(2))

    expect(await web.asUser(ownerId, (scope) => pickChannel(scope, stranger))).toMatchObject({
      outcome: 'not_connected',
    })
    expect(await web.asUser(ownerId, (scope) => pickChannel(scope, randomUUID()))).toMatchObject({
      outcome: 'not_connected',
    })
  })

  test('a pick with every slot in use answers no_free_slot and picks nothing', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 5)
    await subscribe(web)
    const fifth = ids[4] ?? ''

    expect(await web.asUser(ownerId, (scope) => pickChannel(scope, fifth))).toEqual({
      outcome: 'no_free_slot',
      turnedPro: [],
    })
    expect((await picksOf(web, ownerId)).map(({ channelId }) => channelId).sort()).toEqual(
      ids.slice(0, 4).sort(),
    )
  })

  test('a pick with no live paid subscription answers no_free_slot', async ({ web, worker }) => {
    const [never = ''] = await ownedChannels(web, worker, 1)
    const noSubscription = await web.asUser(ownerId, (scope) => pickChannel(scope, never))
    await subscribe(web, { status: 'incomplete' })
    const notPaid = await web.asUser(ownerId, (scope) => pickChannel(scope, never))

    expect(noSubscription).toMatchObject({ outcome: 'no_free_slot' })
    expect(notPaid).toMatchObject({ outcome: 'no_free_slot' })
    expect(await picksOf(web, ownerId)).toEqual([])
  })

  // The harness runs these two picks one after the other, so this shows the second counts the
  // first's pick once it committed; pro-picks-locks.test.ts runs them at once, on two connections.
  test('two picks of the last free slot, one after the other, leave one picked and the other refused', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 5)
    await subscribe(web)
    await web.asUser(ownerId, (scope) => unpickChannel(scope, ids[0] ?? '', connected(200)))
    const sixth = await heldChannel(web, worker, ownerId, connected(6))

    const answers = await Promise.all(
      [ids[4] ?? '', sixth].map((id) =>
        web.asUser(ownerId, (scope) => pickChannel(scope, id)).then(({ outcome }) => outcome),
      ),
    )

    expect([...answers].sort()).toEqual(['no_free_slot', 'picked'])
    expect(await proStatesOf(web, [...ids, sixth])).toEqual([
      false,
      true,
      true,
      true,
      answers[0] === 'picked',
      answers[1] === 'picked',
    ])
  })

  test("an earlier owner's pick of the channel is taken over", async ({ web, worker }) => {
    await ownedChannels(web, worker, 1)
    await subscribe(web, { quantity: 2 })
    const earlierOwner = 'picks-earlier-owner'
    const taken = await heldChannel(web, worker, earlierOwner, connected(2))
    // The earlier owner's own purchase picks the channel; then the owner membership moves.
    await web.asAnonymous((scope) =>
      recordUserSubscription(scope, {
        userId: earlierOwner,
        customer: 'cus_earlier',
        subscription: 'sub_earlier',
        plan: 'monthly',
        status: 'active',
        periodEnd: null,
        eventCreated: connected(100),
      }),
    )
    await worker.forChannel(taken, async (scope) => {
      await scope.sql.delete(memberships).where(eq(memberships.userId, earlierOwner))
      await scope.sql
        .insert(memberships)
        .values({ channelId: taken, userId: ownerId, role: 'owner' })
    })
    const readPicker = (scope: Scoped<'channel'>) =>
      scope.sql.select({ userId: proPicks.userId }).from(proPicks)
    const before = await worker.forChannel(taken, readPicker)

    const answer = await web.asUser(ownerId, (scope) => pickChannel(scope, taken))

    expect(before).toEqual([{ userId: earlierOwner }])
    expect(answer).toEqual({ outcome: 'picked', turnedPro: [taken] })
    expect(await worker.forChannel(taken, readPicker)).toEqual([{ userId: ownerId }])
  })

  test('runs only in the user scope, and the user scope writes no pick itself', async ({
    web,
    worker,
  }) => {
    const [channelId = ''] = await ownedChannels(web, worker, 1)
    const attempt = (scope: Scoped<ScopeKind>) =>
      refusalOf(scope, (each) => pickChannel(each as Scoped<'user'>, channelId))
    const refused = { cause: { message: 'pick_pro_channel runs only in the user scope' } }
    const denied = { cause: { message: 'permission denied for function pick_pro_channel' } }

    expect(await web.asAnonymous(attempt)).toMatchObject(refused)
    expect(await web.asAdmin(ownerId, attempt)).toMatchObject(refused)
    expect(await worker.forChannel(channelId, attempt)).toMatchObject(denied)
    expect(
      await web.asUser(ownerId, (scope) =>
        refusalOf(scope, (each) =>
          each.sql.insert(proPicks).values({ channelId, userId: ownerId, pickedAt: each.now }),
        ),
      ),
    ).toMatchObject({
      cause: { message: 'new row violates row-level security policy for table "pro_picks"' },
    })
  })
})

describe("unpick_pro_channel, the owner's unpick, which starts the channel's 30 days (stillstats#21)", () => {
  test('an unpick of a Pro channel frees its slot and writes its purge date', async ({
    web,
    worker,
  }) => {
    const [first = '', second = ''] = await ownedChannels(web, worker, 2)
    await subscribe(web)
    const purgeAfter = new Date(connected(200).getTime() + 30 * dayMs)

    const answer = await web.asUser(ownerId, (scope) => unpickChannel(scope, first, purgeAfter))

    expect(answer).toEqual({ outcome: 'unpicked', turnedPro: [] })
    expect(await proStatesOf(web, [first, second])).toEqual([false, true])
    expect(await purgeOf(web, first)).toEqual({ endedAt: connected(200), purgeAfter })
    expect(await purgeOf(web, second)).toBeNull()
  })

  test('a pick again before the purge date clears it', async ({ web, worker }) => {
    const [first = ''] = await ownedChannels(web, worker, 1)
    await subscribe(web)
    await web.asUser(ownerId, (scope) =>
      unpickChannel(scope, first, new Date(connected(200).getTime() + 30 * dayMs)),
    )

    const answer = await web.asUser(ownerId, (scope) => pickChannel(scope, first))

    expect(answer).toEqual({ outcome: 'picked', turnedPro: [first] })
    expect(await proStatesOf(web, [first])).toEqual([true])
    expect(await purgeOf(web, first)).toBeNull()
  })

  test('an unpick of a channel that was not Pro writes no purge date', async ({ web, worker }) => {
    const [first = ''] = await ownedChannels(web, worker, 1)
    await subscribe(web)
    const ended = new Date('2027-01-16T12:00:00.000Z')
    await web.asAnonymous((scope) =>
      recordUserSubscription(scope, {
        userId: ownerId,
        customer: 'cus_picks',
        subscription: 'sub_picks',
        plan: 'monthly',
        status: 'canceled',
        periodEnd: null,
        purgeAfter: ended,
        eventCreated: connected(150),
      }),
    )

    const answer = await web.asUser(ownerId, (scope) =>
      unpickChannel(scope, first, new Date(connected(200).getTime() + 30 * dayMs)),
    )

    expect(answer).toEqual({ outcome: 'unpicked', turnedPro: [] })
    expect(await purgeOf(web, first)).toMatchObject({ purgeAfter: ended })
    expect(await picksOf(web, ownerId)).toEqual([])
  })

  test('a channel not picked answers unchanged, and a member or a stranger is refused', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 5)
    await subscribe(web)
    const held = await heldChannel(web, worker, 'picks-other-owner', connected(6))
    await worker.forChannel(held, (scope) =>
      scope.sql
        .insert(memberships)
        .values({ channelId: held, userId: ownerId, role: 'member' as 'owner' }),
    )
    const unpick = (channelId: string) =>
      web.asUser(ownerId, (scope) => unpickChannel(scope, channelId, connected(200)))

    expect(await unpick(ids[4] ?? '')).toEqual({ outcome: 'unchanged', turnedPro: [] })
    expect(await unpick(held)).toEqual({ outcome: 'not_owner', turnedPro: [] })
    expect(await unpick(randomUUID())).toEqual({ outcome: 'not_connected', turnedPro: [] })
    expect(await picksOf(web, 'picks-other-owner')).toEqual([])
    expect(await proStatesOf(web, ids)).toEqual([true, true, true, true, false])
  })

  test('a pick beyond the capacity that moves inside it once one ahead of it leaves turns Pro', async ({
    web,
    worker,
  }) => {
    const ids = await ownedChannels(web, worker, 5)
    await subscribe(web, { quantity: 2 })
    // A cut to one block, as a removed block makes: the fifth pick stays, beyond the capacity.
    await web.asAnonymous((scope) =>
      recordUserSubscription(scope, {
        userId: ownerId,
        customer: 'cus_picks',
        subscription: 'sub_picks',
        plan: 'monthly',
        status: 'active',
        periodEnd: null,
        quantity: 1,
        eventCreated: connected(150),
      }),
    )
    const fifth = ids[4] ?? ''

    const answer = await web.asUser(ownerId, (scope) =>
      unpickChannel(scope, ids[0] ?? '', new Date(connected(200).getTime() + 30 * dayMs)),
    )

    expect(answer).toEqual({ outcome: 'unpicked', turnedPro: [fifth] })
    expect(await proStatesOf(web, ids)).toEqual([false, true, true, true, true])
  })

  test('runs only in the user scope', async ({ web, worker }) => {
    const [channelId = ''] = await ownedChannels(web, worker, 1)
    const attempt = (scope: Scoped<ScopeKind>) =>
      refusalOf(scope, (each) => unpickChannel(each as Scoped<'user'>, channelId, each.now))
    const refused = { cause: { message: 'unpick_pro_channel runs only in the user scope' } }
    const denied = { cause: { message: 'permission denied for function unpick_pro_channel' } }

    expect(await web.asAnonymous(attempt)).toMatchObject(refused)
    expect(await worker.forChannel(channelId, attempt)).toMatchObject(denied)
  })
})
