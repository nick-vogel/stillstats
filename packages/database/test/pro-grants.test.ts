import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import {
  channels,
  memberships,
  proEnds,
  proGrants,
  proPicks,
  userSubscriptions,
  users,
} from '../src/schema.ts'
import type { Scoped, ScopeKind, WebDatabase, WorkerDatabase } from '../src/scopes.ts'
import { test } from './harness.ts'
import { endGrant, grantBlocks, recordUserSubscription } from './pro.ts'
import { seedUser } from './seed.ts'

// stillstats#24: a Pro grant gives a user blocks without a purchase, through create_pro_grant in
// the admin scope, and its end, end_pro_grant, in the admin scope (a removal) or the system scope
// (the end date), takes the newest picks out of the capacity with their purge date.

const userId = 'grants-user'
const email = `${userId}@example.com`
const connectedAt = new Date('2026-11-20T12:00:00.000Z')
const dayMs = 24 * 60 * 60 * 1000

/** The time `n` minutes after the first channel was connected. */
const connected = (n: number) => new Date(connectedAt.getTime() + n * 60 * 1000)

/** The user's channels, owned and connected a minute apart in the order given. */
async function ownedChannels(web: WebDatabase, worker: WorkerDatabase, count: number) {
  await seedUser(web, userId)
  const ids: string[] = []
  for (let n = 1; n <= count; n++) {
    const channelId = randomUUID()
    await worker.forChannel(channelId, async (scope) => {
      await scope.sql.insert(channels).values({ id: channelId, youtubeChannelId: `UC${channelId}` })
      await scope.sql
        .insert(memberships)
        .values({ channelId, userId, role: 'owner', createdAt: connected(n) })
    })
    ids.push(channelId)
  }
  return ids
}

/** The user subscribes to `quantity` blocks, whose fill picks their oldest unpicked channels. */
function subscribe(
  web: WebDatabase,
  { quantity = 1, status = 'active', purgeAfter = null as Date | null, at = connected(100) } = {},
) {
  return web.asAnonymous((scope) =>
    recordUserSubscription(scope, {
      userId,
      customer: 'cus_grants',
      subscription: 'sub_grants',
      plan: 'monthly',
      status,
      periodEnd: null,
      quantity,
      purgeAfter,
      eventCreated: at,
    }),
  )
}

function proStatesOf(web: WebDatabase, ids: string[]) {
  return web.asUser(userId, async (scope) => {
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

function purgesOf(web: WebDatabase, ids: string[]) {
  return web.asUser(userId, async (scope) => {
    const purges: (Date | null)[] = []
    for (const id of ids) {
      const [row] = await scope.sql
        .select({ purgeAfter: proEnds.purgeAfter })
        .from(proEnds)
        .where(eq(proEnds.channelId, id))
      purges.push(row?.purgeAfter ?? null)
    }
    return purges
  })
}

function listOf(web: WebDatabase) {
  return web.asAdmin('grants-admin', async (scope) => {
    const { rows } = await scope.sql.execute<{
      id: string
      email: string
      blocks: number
      ends_at: Date | null
      created_at: Date
      paid_blocks: number
      granted_blocks: number
    }>(sql`select * from pro_grants_list()`)
    return rows.map((row) => ({
      ...row,
      ends_at: row.ends_at && new Date(row.ends_at),
      created_at: new Date(row.created_at),
    }))
  })
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

describe('create_pro_grant, the admin scope gives a user blocks of Pro (stillstats#24)', () => {
  test('a grant of 1 block to a user with no subscription fills their 4 oldest owned channels, and the 5th stays free', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(connected(200))
    const ids = await ownedChannels(web, worker, 5)

    const answer = await grantBlocks(web, { email, blocks: 1 })

    expect(answer).toEqual({
      outcome: 'granted',
      grantId: expect.any(String),
      turnedPro: ids.slice(0, 4),
    })
    expect(await proStatesOf(web, ids)).toEqual([true, true, true, true, false])
  })

  test('a grant beside a paid block gives 8 slots, and names only the channels it turned Pro', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(connected(100))
    const ids = await ownedChannels(web, worker, 9)
    await subscribe(web)
    clock.set(connected(200))

    const answer = await grantBlocks(web, { email, blocks: 1 })

    expect(answer.turnedPro).toEqual(ids.slice(4, 8))
    expect(await proStatesOf(web, ids)).toEqual([...Array(8).fill(true), false])
  })

  test('a grant turns Pro again the picks an ended subscription left with a purge date, and clears it', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(connected(100))
    const ids = await ownedChannels(web, worker, 5)
    await subscribe(web)
    const purgeAfter = new Date(connected(150).getTime() + 30 * dayMs)
    await subscribe(web, { status: 'canceled', purgeAfter, at: connected(150) })
    expect(await purgesOf(web, ids.slice(0, 4))).toEqual(Array(4).fill(purgeAfter))
    clock.set(connected(200))

    const answer = await grantBlocks(web, { email, blocks: 1 })

    expect(answer.turnedPro).toEqual(ids.slice(0, 4))
    expect(await proStatesOf(web, ids)).toEqual([true, true, true, true, false])
    expect(await purgesOf(web, ids.slice(0, 4))).toEqual([null, null, null, null])
  })

  test('the email is compared lower-cased', async ({ web, worker }) => {
    const ids = await ownedChannels(web, worker, 1)

    const answer = await grantBlocks(web, { email: email.toUpperCase(), blocks: 1 })

    expect(answer.outcome).toBe('granted')
    expect(await proStatesOf(web, ids)).toEqual([true])
  })

  test('an email no user holds answers no_user and writes nothing', async ({ web, worker }) => {
    await ownedChannels(web, worker, 1)

    expect(await grantBlocks(web, { email: 'nobody@example.com', blocks: 1 })).toEqual({
      outcome: 'no_user',
      grantId: null,
      turnedPro: [],
    })
    expect(await listOf(web)).toEqual([])
  })

  test('a grant is its own record, never a subscription: the user still reads no subscription row', async ({
    web,
    worker,
  }) => {
    await ownedChannels(web, worker, 1)
    await grantBlocks(web, { email, blocks: 2 })

    const read = await web.asUser(userId, async (scope) => ({
      subscriptions: await scope.sql.select().from(userSubscriptions),
      grants: await scope.sql
        .select({ blocks: proGrants.blocks, endsAt: proGrants.endsAt })
        .from(proGrants),
    }))

    expect(read).toEqual({ subscriptions: [], grants: [{ blocks: 2, endsAt: null }] })
  })

  test('the admin list holds every grant newest first, with its email and the paid and granted blocks beside it', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(connected(100))
    await ownedChannels(web, worker, 1)
    await subscribe(web, { quantity: 2 })
    await seedUser(web, 'grants-other')
    clock.set(connected(200))
    const first = await grantBlocks(web, { email, blocks: 1, endsAt: connected(10_000) })
    clock.set(connected(300))
    const second = await grantBlocks(web, { email: 'grants-other@example.com', blocks: 3 })
    clock.set(connected(400))
    const third = await grantBlocks(web, { email, blocks: 2 })

    expect(await listOf(web)).toEqual([
      {
        id: third.grantId,
        email,
        blocks: 2,
        ends_at: null,
        created_at: connected(400),
        paid_blocks: 2,
        granted_blocks: 3,
      },
      {
        id: second.grantId,
        email: 'grants-other@example.com',
        blocks: 3,
        ends_at: null,
        created_at: connected(300),
        paid_blocks: 0,
        granted_blocks: 3,
      },
      {
        id: first.grantId,
        email,
        blocks: 1,
        ends_at: connected(10_000),
        created_at: connected(200),
        paid_blocks: 2,
        granted_blocks: 3,
      },
    ])
  })

  test('a user deletion cascades their grants away', async ({ web }) => {
    await seedUser(web, userId)
    await seedUser(web, 'grants-other')
    await grantBlocks(web, { email, blocks: 1 })
    await grantBlocks(web, { email: 'grants-other@example.com', blocks: 1 })

    await web.asUser(userId, (scope) => scope.sql.delete(users))

    expect((await listOf(web)).map((row) => row.email)).toEqual(['grants-other@example.com'])
  })
})

describe('end_pro_grant, a removal or the end date takes the newest picks out (stillstats#24)', () => {
  test('of 6 picks on 1 paid and 1 granted block, the end takes out the newest 2 with the purge date given, and the oldest 4 stay Pro', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(connected(100))
    const ids = await ownedChannels(web, worker, 6)
    await subscribe(web)
    clock.set(connected(200))
    const { grantId } = await grantBlocks(web, { email, blocks: 1 })
    expect(await proStatesOf(web, ids)).toEqual(Array(6).fill(true))
    const purgeAfter = new Date(connected(300).getTime() + 30 * dayMs)

    const outcome = await web.asAdmin('grants-admin', (scope) =>
      endGrant(scope, grantId ?? '', purgeAfter),
    )

    expect(outcome).toBe('ended')
    expect(await proStatesOf(web, ids)).toEqual([true, true, true, true, false, false])
    expect(await purgesOf(web, ids)).toEqual([null, null, null, null, purgeAfter, purgeAfter])
    const ended = await web.asUser(userId, (scope) =>
      scope.sql.select({ endedAt: proEnds.endedAt }).from(proEnds).orderBy(proEnds.channelId),
    )
    expect(ended).toEqual([{ endedAt: connected(300) }, { endedAt: connected(300) }])
    expect(await listOf(web)).toEqual([])
  })

  test('the newest picks leave first whichever block picked them: a grant before a subscription keeps the oldest 4 when it ends', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(connected(100))
    const ids = await ownedChannels(web, worker, 6)
    const { grantId } = await grantBlocks(web, { email, blocks: 1 })
    clock.set(connected(200))
    await subscribe(web, { at: connected(200) })
    const purgeAfter = new Date(connected(300).getTime() + 30 * dayMs)

    await worker.asSystem((scope) => endGrant(scope, grantId ?? '', purgeAfter))

    expect(await proStatesOf(web, ids)).toEqual([true, true, true, true, false, false])
    expect(await purgesOf(web, ids.slice(4))).toEqual([purgeAfter, purgeAfter])
  })

  test('a grant ended twice answers no_grant the second time and moves no date', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(connected(100))
    const ids = await ownedChannels(web, worker, 4)
    const { grantId } = await grantBlocks(web, { email, blocks: 1 })
    const first = new Date(connected(300).getTime() + 30 * dayMs)
    await web.asAdmin('grants-admin', (scope) => endGrant(scope, grantId ?? '', first))

    const second = await worker.asSystem((scope) =>
      endGrant(scope, grantId ?? '', new Date(first.getTime() + dayMs)),
    )

    expect(second).toBe('no_grant')
    expect(await purgesOf(web, ids)).toEqual(Array(4).fill(first))
  })

  test('the end of a grant that leaves the capacity above the picks takes none out', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(connected(100))
    const ids = await ownedChannels(web, worker, 3)
    await subscribe(web)
    const { grantId } = await grantBlocks(web, { email, blocks: 1 })

    await web.asAdmin('grants-admin', (scope) => endGrant(scope, grantId ?? '', connected(100_000)))

    expect(await proStatesOf(web, ids)).toEqual([true, true, true])
    expect(await purgesOf(web, ids)).toEqual([null, null, null])
  })

  test('the system scope reads a grant end date through pro_grant_end_of, null for no end or a grant gone', async ({
    web,
    worker,
  }) => {
    await seedUser(web, userId)
    const ending = await grantBlocks(web, { email, blocks: 1, endsAt: connected(1_000) })
    const endless = await grantBlocks(web, { email, blocks: 1 })
    await web.asAdmin('grants-admin', (scope) =>
      endGrant(scope, endless.grantId ?? '', connected(100_000)),
    )

    const ends = await worker.asSystem(async (scope) => {
      const read = async (id: string) => {
        const { rows } = await scope.sql.execute<{ ends: Date | null }>(
          sql`select pro_grant_end_of(${id}::uuid) as ends`,
        )
        return rows[0]?.ends ? new Date(rows[0].ends) : null
      }
      return [await read(ending.grantId ?? ''), await read(endless.grantId ?? '')]
    })

    expect(ends).toEqual([connected(1_000), null])
  })
})

describe('who may make, end and read grants (stillstats#24)', () => {
  const calls = {
    create: sql`select * from create_pro_grant('grants-user@example.com', 1, null)`,
    end: sql`select * from end_pro_grant(${randomUUID()}::uuid, now())`,
    list: sql`select * from pro_grants_list()`,
    endOf: sql`select pro_grant_end_of(${randomUUID()}::uuid)`,
  }

  test('the user and anonymous scopes call none of the grant functions', async ({ web }) => {
    await seedUser(web, userId)
    for (const enter of [
      (work: (scope: Scoped<ScopeKind>) => Promise<unknown[]>) => web.asUser(userId, work),
      (work: (scope: Scoped<ScopeKind>) => Promise<unknown[]>) => web.asAnonymous(work),
    ]) {
      const refusals = await enter(async (scope) => {
        const errors: unknown[] = []
        for (const call of Object.values(calls)) {
          errors.push(await refusalOf(scope, (attempt) => attempt.sql.execute(call)))
        }
        return errors
      })
      expect(refusals.every((error) => error instanceof Error)).toBe(true)
    }
    expect(await listOf(web)).toEqual([])
  })

  test('the system scope makes and lists no grant, and the admin scope reads no end date', async ({
    web,
    worker,
  }) => {
    await seedUser(web, userId)
    const system = await worker.asSystem(async (scope) => [
      await refusalOf(scope, (attempt) => attempt.sql.execute(calls.create)),
      await refusalOf(scope, (attempt) => attempt.sql.execute(calls.list)),
    ])
    const admin = await web.asAdmin('grants-admin', (scope) =>
      refusalOf(scope, (attempt) => attempt.sql.execute(calls.endOf)),
    )

    expect(system.every((error) => error instanceof Error)).toBe(true)
    expect(admin).toBeInstanceOf(Error)
    expect(await listOf(web)).toEqual([])
  })

  test('the user scope reads only its own grants and writes none', async ({ web }) => {
    await seedUser(web, userId)
    await seedUser(web, 'grants-other')
    await grantBlocks(web, { email, blocks: 1 })
    await grantBlocks(web, { email: 'grants-other@example.com', blocks: 2 })

    const read = await web.asUser(userId, async (scope) => ({
      grants: await scope.sql.select({ blocks: proGrants.blocks }).from(proGrants),
      insert: await refusalOf(scope, (attempt) =>
        attempt.sql.insert(proGrants).values({ userId, blocks: 5, createdAt: attempt.now }),
      ),
      updated: await scope.sql.update(proGrants).set({ blocks: 9 }).returning({ id: proGrants.id }),
      deleted: await scope.sql.delete(proGrants).returning({ id: proGrants.id }),
    }))

    expect(read.grants).toEqual([{ blocks: 1 }])
    expect(read.insert).toBeInstanceOf(Error)
    expect(read.updated).toEqual([])
    expect(read.deleted).toEqual([])
    expect((await listOf(web)).map((row) => row.blocks)).toEqual([2, 1])
  })

  test('the admin, anonymous and system scopes read no grant row as their login roles', async ({
    web,
    worker,
  }) => {
    await seedUser(web, userId)
    await grantBlocks(web, { email, blocks: 1 })

    const reads = [
      await web.asAdmin('grants-admin', (scope) => scope.sql.select().from(proGrants)),
      await web.asAnonymous((scope) => scope.sql.select().from(proGrants)),
      await worker.asSystem((scope) => scope.sql.select().from(proGrants)),
    ]

    expect(reads).toEqual([[], [], []])
  })

  test('the admin scope reads no user email and no subscription row as app_web', async ({
    web,
  }) => {
    await seedUser(web, userId)
    await subscribe(web)

    const reads = await web.asAdmin('grants-admin', async (scope) => [
      await scope.sql.select({ email: users.email }).from(users),
      await scope.sql.select().from(userSubscriptions),
      await scope.sql.select().from(proPicks),
    ])

    expect(reads).toEqual([[], [], []])
  })
})
