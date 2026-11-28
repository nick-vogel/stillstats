import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { connectionRoster } from '../src/connections.ts'
import {
  accounts,
  channels,
  connectionIdentifiers,
  connections,
  deletionRequests,
  memberships,
  quotaUsage,
  securityEvents,
  sessions,
  users,
  verifications,
} from '../src/schema.ts'
import { type Scoped, type ScopeKind, type WebDatabase, workerDatabase } from '../src/scopes.ts'
import { fixtureNotes } from './fixtures.ts'
import { test as databaseTest } from './harness.ts'
import { seedChannel, seedUser } from './seed.ts'

const test = databaseTest.extend<{
  $test: { seedChannel: (ownerId: string) => Promise<string> }
}>({
  seedChannel: async ({ web, worker }, use) => {
    await use((ownerId) => seedChannel(web, worker, ownerId))
  },
})

async function seedSignIn(web: WebDatabase, userId: string): Promise<void> {
  await seedUser(web, userId)
  await web.asAnonymous(async (scope) => {
    await scope.sql
      .insert(sessions)
      .values({ id: `${userId}-session`, token: `${userId}-token`, userId, expiresAt: scope.now })
    await scope.sql
      .insert(accounts)
      .values({ id: `${userId}-account`, accountId: userId, providerId: 'google', userId })
    await scope.sql.insert(verifications).values({
      id: `${userId}-verification`,
      identifier: userId,
      value: 'state',
      expiresAt: scope.now,
    })
  })
}

const betterAuthTables = ['accounts', 'sessions', 'users', 'verifications'] as const
type BetterAuthRows = Record<(typeof betterAuthTables)[number], string[]>

function signInRows(...userIds: string[]): BetterAuthRows {
  return {
    accounts: userIds.map((id) => `${id}-account`),
    sessions: userIds.map((id) => `${id}-session`),
    users: userIds,
    verifications: userIds.map((id) => `${id}-verification`),
  }
}

async function readBetterAuthRows(scope: Scoped<ScopeKind>): Promise<BetterAuthRows> {
  const rows: Partial<BetterAuthRows> = {}
  for (const table of betterAuthTables) {
    const result = await scope.sql.execute<{ id: string }>(
      sql`select id from ${sql.identifier(table)} order by id`,
    )
    rows[table] = result.rows.map((row) => row.id)
  }
  return rows as BetterAuthRows
}

async function readNotes(scope: Scoped<ScopeKind>) {
  return scope.sql.select({ channelId: fixtureNotes.channelId }).from(fixtureNotes)
}

/**
 * The channels table and every table with a foreign key to it, read from the catalog, but the
 * channel subscription payments of the release before blocks, which nothing writes any more
 * (stillstats#20), so no seeded channel holds one.
 */
async function channelOwnedTables(scope: Scoped<ScopeKind>): Promise<string[]> {
  const result = await scope.sql.execute<{ name: string }>(sql`
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname <> 'subscription_payments'
    and (
      c.oid = 'channels'::regclass
      or exists (
        select 1 from pg_constraint k
        where k.conrelid = c.oid and k.contype = 'f' and k.confrelid = 'channels'::regclass
      )
    )
    order by c.relname`)
  return result.rows.map((row) => row.name)
}

async function publicTables(scope: Scoped<ScopeKind>): Promise<string[]> {
  const result = await scope.sql.execute<{ name: string }>(
    sql`select tablename as name from pg_tables where schemaname = 'public' order by tablename`,
  )
  return result.rows.map((row) => row.name)
}

async function countRows(scope: Scoped<ScopeKind>, tables: string[]): Promise<number[]> {
  const counts: number[] = []
  for (const table of tables) {
    const result = await scope.sql.execute<{ n: number }>(
      sql`select count(*)::int as n from ${sql.identifier(table)}`,
    )
    counts.push(result.rows[0]?.n ?? -1)
  }
  return counts
}

async function readScopeIds(scope: Scoped<ScopeKind>) {
  const result = await scope.sql.execute<{ userId: string; channelId: string }>(sql`select
    current_setting('app.user_id', true) as "userId",
    current_setting('app.channel_id', true) as "channelId"`)
  return result.rows[0]
}

/**
 * Awaits one query inside the scope before its real work. That await is the gap in which another
 * scope opened at the same time would write its own settings over this one's, were the harness not
 * running scopes one at a time, so a test of the queue needs it even before a read that awaits too.
 */
async function letOtherScopesIn(scope: Scoped<ScopeKind>) {
  await scope.sql.execute(sql`select 1`)
}

async function claim(scope: Scoped<ScopeKind>, youtubeChannelId: string) {
  const result = await scope.sql.execute<{ outcome: string; channelId: string | null }>(
    sql`select outcome, channel_id as "channelId" from claim_channel(${youtubeChannelId})`,
  )
  return result.rows[0]
}

async function readOwnChannels(scope: Scoped<ScopeKind>) {
  return scope.sql
    .select({
      id: channels.id,
      youtubeChannelId: channels.youtubeChannelId,
      role: memberships.role,
    })
    .from(channels)
    .innerJoin(memberships, eq(memberships.channelId, channels.id))
}

describe('seam 3: the database roles', () => {
  test('a user reads the rows of a channel they hold a membership to', async ({
    web,
    seedChannel,
  }) => {
    const channelId = await seedChannel('user-a')

    expect(await web.asUser('user-a', readNotes)).toEqual([{ channelId }])
  })

  // The member read is the presence check, as in the anonymous scope test below.
  test('a user without a membership reads no row of a channel', async ({ web, seedChannel }) => {
    await seedChannel('user-a')
    const tables = await web.asAnonymous(channelOwnedTables)
    const rowCounts = (scope: Scoped<ScopeKind>) => countRows(scope, tables)
    expect(await web.asUser('user-a', rowCounts)).not.toContain(0)

    expect(await web.asUser('user-b', rowCounts)).toEqual(tables.map(() => 0))
  })

  test('a channel scope reads no row of another channel', async ({ worker, seedChannel }) => {
    await seedChannel('user-a')
    const channelB = await seedChannel('user-b')

    expect(await worker.forChannel(channelB, readNotes)).toEqual([{ channelId: channelB }])
  })

  // Seeding through a channel scope and reading as a member leaves app.channel_id and
  // app.user_id set in the test transaction, because SET LOCAL survives RELEASE SAVEPOINT.
  // The member read is the presence check: a table seedChannel leaves empty fails it, so a new
  // channel-owned table cannot pass this test by holding nothing.
  test('the anonymous scope reads no row of any channel-owned table', async ({
    web,
    seedChannel,
  }) => {
    await seedChannel('user-a')
    const tables = await web.asAnonymous(channelOwnedTables)
    expect(tables).toEqual(
      expect.arrayContaining([
        'channels',
        'connection_identifiers',
        'connections',
        'fixture_notes',
        'memberships',
        'read_cache',
      ]),
    )

    const rowCounts = (scope: Scoped<ScopeKind>) => countRows(scope, tables)
    expect(await web.asUser('user-a', rowCounts)).not.toContain(0)

    expect(await web.asAnonymous(rowCounts)).toEqual(tables.map(() => 0))
  })

  // Not every channel-owned table: the system scope reads the connection roster (#16), which is
  // channel-owned. fixture_notes stands in for an analytics table. The member read is the
  // presence check and leaves both scope ids set, as above.
  test('the system scope reads no analytics row', async ({ web, worker, seedChannel }) => {
    const channelId = await seedChannel('user-a')
    expect(await web.asUser('user-a', readNotes)).toEqual([{ channelId }])

    expect(await worker.asSystem(readNotes)).toEqual([])
  })

  test('a user cannot grant themselves a membership to a channel', async ({ web, seedChannel }) => {
    const ownChannel = await seedChannel('user-a')
    const otherChannel = await seedChannel('user-b')

    const visible = await web.asUser('user-a', async (scope) => {
      // A refused statement aborts its transaction, so the attempt runs in a savepoint of its own.
      const refusal = await scope.sql
        .transaction((attempt) =>
          attempt
            .insert(memberships)
            .values({ channelId: otherChannel, userId: 'user-a', role: 'owner' }),
        )
        .then(
          () => undefined,
          (error: unknown) => error,
        )
      expect(refusal).toMatchObject({
        cause: { message: 'new row violates row-level security policy for table "memberships"' },
      })
      return scope.sql.select({ id: channels.id }).from(channels)
    })

    expect(visible).toEqual([{ id: ownChannel }])
  })

  test('a user cannot insert a channel row', async ({ web }) => {
    const refusal = await web
      .asUser('user-a', (scope) =>
        scope.sql.insert(channels).values({ id: randomUUID(), youtubeChannelId: 'UC-new' }),
      )
      .then(
        () => undefined,
        (error: unknown) => error,
      )

    expect(refusal).toMatchObject({
      cause: { message: 'new row violates row-level security policy for table "channels"' },
    })
  })

  test('a claim of a new channel creates it with the user as its owner', async ({ web }) => {
    await seedUser(web, 'user-a')

    const claimed = await web.asUser('user-a', (scope) => claim(scope, 'UC-new'))

    expect(claimed?.outcome).toBe('created')
    expect(await web.asUser('user-a', readOwnChannels)).toEqual([
      { id: claimed?.channelId, youtubeChannelId: 'UC-new', role: 'owner' },
    ])
  })

  test('a claim of a channel the user owns returns that channel', async ({ web, seedChannel }) => {
    const channelId = await seedChannel('user-a')

    const claimed = await web.asUser('user-a', (scope) => claim(scope, `UC${channelId}`))

    expect(claimed).toEqual({ outcome: 'held', channelId })
  })

  test('a claim of a channel another user holds is refused and changes nothing', async ({
    web,
    seedChannel,
  }) => {
    const channelId = await seedChannel('user-b')
    await seedUser(web, 'user-a')

    const claimed = await web.asUser('user-a', (scope) => claim(scope, `UC${channelId}`))

    expect(claimed).toEqual({ outcome: 'channel_held_elsewhere', channelId: null })
    expect(await web.asUser('user-a', readOwnChannels)).toEqual([])
    expect(await web.asUser('user-b', readOwnChannels)).toEqual([
      { id: channelId, youtubeChannelId: `UC${channelId}`, role: 'owner' },
    ])
  })

  test('a claim of a channel waiting for its deletion is refused as disconnecting', async ({
    web,
    worker,
    seedChannel,
  }) => {
    const channelId = await seedChannel('user-b')
    await worker.forChannel(channelId, (scope) => scope.sql.delete(memberships))
    await seedUser(web, 'user-a')

    const claimed = await web.asUser('user-a', (scope) => claim(scope, `UC${channelId}`))

    expect(claimed).toEqual({ outcome: 'channel_disconnecting', channelId: null })
  })

  test('a claim outside a user scope is refused', async ({ web }) => {
    const refusal = await web
      .asAnonymous((scope) => claim(scope, 'UC-new'))
      .then(
        () => undefined,
        (error: unknown) => error,
      )

    expect(refusal).toMatchObject({ cause: { message: 'claim_channel runs only in a user scope' } })
  })

  test('each scope clears the ids of the scope before it', async ({ web, worker }) => {
    const channelId = randomUUID()

    await worker.forChannel(channelId, readScopeIds)
    expect(await web.asUser('user-a', readScopeIds)).toEqual({ userId: 'user-a', channelId: '' })
    expect(await worker.forChannel(channelId, readScopeIds)).toEqual({ userId: '', channelId })
    await web.asUser('user-a', readScopeIds)
    expect(await worker.asSystem(readScopeIds)).toEqual({ userId: '', channelId: '' })
  })

  test('a role whose scope id is unset reads no row', async ({ transaction, seedChannel }) => {
    await seedChannel('user-a')
    const count = async (role: string, scope: string) => {
      await transaction.execute(sql`select
        set_config('role', ${role}, true),
        set_config('app.scope', ${scope}, true),
        set_config('app.user_id', '', true),
        set_config('app.channel_id', '', true)`)
      const result = await transaction.execute<{ n: number }>(
        sql`select count(*)::int as n from fixture_notes`,
      )
      return result.rows[0]?.n
    }

    expect(await count('app_web', 'user')).toBe(0)
    expect(await count('app_worker', 'channel')).toBe(0)
  })

  test('the anonymous scope reads every row of the Better Auth tables', async ({ web }) => {
    await seedSignIn(web, 'user-a')
    await seedSignIn(web, 'user-b')

    expect(await web.asAnonymous(readBetterAuthRows)).toEqual(signInRows('user-a', 'user-b'))
  })

  test('a user scope reads only their own users, sessions and accounts rows and no verification row', async ({
    web,
  }) => {
    await seedSignIn(web, 'user-a')
    await seedSignIn(web, 'user-b')

    expect(await web.asUser('user-a', readBetterAuthRows)).toEqual({
      ...signInRows('user-a'),
      verifications: [],
    })
  })

  test("a user scope deletes their own users, sessions and accounts rows and no other user's", async ({
    web,
  }) => {
    await seedSignIn(web, 'user-a')
    await seedSignIn(web, 'user-b')
    expect(await web.asAnonymous(readBetterAuthRows)).toEqual(signInRows('user-a', 'user-b'))

    // Sessions and accounts go first, so the cascade from users cannot stand in for their policies.
    await web.asUser('user-a', async (scope) => {
      await scope.sql.delete(sessions)
      await scope.sql.delete(accounts)
      await scope.sql.delete(users)
    })

    expect(await web.asAnonymous(readBetterAuthRows)).toEqual({
      ...signInRows('user-b'),
      verifications: signInRows('user-a', 'user-b').verifications,
    })
  })

  test('a user scope updates no Better Auth row of their own', async ({ web }) => {
    await seedSignIn(web, 'user-a')
    const readNames = (scope: Scoped<ScopeKind>) =>
      scope.sql.select({ name: users.name }).from(users)

    await web.asUser('user-a', (scope) => scope.sql.update(users).set({ name: 'renamed' }))

    expect(await web.asAnonymous(readNames)).toEqual([{ name: 'user-a' }])
  })

  test('the channel and system scopes read no row of any Better Auth table', async ({
    web,
    worker,
  }) => {
    await seedSignIn(web, 'user-a')
    expect(await web.asAnonymous(readBetterAuthRows)).toEqual(signInRows('user-a'))

    expect(await worker.forChannel(randomUUID(), readBetterAuthRows)).toEqual(signInRows())
    expect(await worker.asSystem(readBetterAuthRows)).toEqual(signInRows())
  })

  test('only the user and channel scopes, where a gateway read runs, read the quota count', async ({
    web,
    worker,
  }) => {
    const readQuota = (scope: Scoped<ScopeKind>) =>
      scope.sql.select({ units: quotaUsage.units }).from(quotaUsage)
    await web.asUser('user-a', (scope) =>
      scope.sql.insert(quotaUsage).values({ api: 'data', quotaDay: '2026-10-04', units: 1 }),
    )

    expect(await web.asUser('user-b', readQuota)).toEqual([{ units: 1 }])
    expect(await worker.forChannel(randomUUID(), readQuota)).toEqual([{ units: 1 }])
    expect(await web.asAnonymous(readQuota)).toEqual([])
    expect(await worker.asSystem(readQuota)).toEqual([])
  })

  test('the system scope finds a channel by the HMAC of its Google subject and reads no connection', async ({
    worker,
    seedChannel,
  }) => {
    const channelId = await seedChannel('user-a')

    const read = await worker.asSystem(async (scope) => ({
      identified: await scope.sql
        .select({ channelId: connectionIdentifiers.channelId })
        .from(connectionIdentifiers)
        .where(eq(connectionIdentifiers.hmac, `hmac-${channelId}`)),
      connections: await scope.sql.select().from(connections),
    }))

    expect(read).toEqual({ identified: [{ channelId }], connections: [] })
  })

  test('the system scope reads the roster of active connections, with no token and no analytics row', async ({
    web,
    worker,
    seedChannel,
    clock,
  }) => {
    clock.set(new Date('2026-10-04T08:00:00.000Z'))
    const active = await seedChannel('user-a')
    const revoked = await seedChannel('user-b')
    await worker.forChannel(revoked, (scope) =>
      scope.sql
        .update(connections)
        .set({ status: 'revoked' })
        .where(eq(connections.channelId, revoked)),
    )
    expect(await web.asUser('user-a', readNotes)).toEqual([{ channelId: active }])

    const read = await worker.asSystem(async (scope) => ({
      roster: await connectionRoster(scope),
      notes: await readNotes(scope),
    }))

    expect(read).toEqual({
      roster: [
        {
          channelId: active,
          subjectHmac: `hmac-${active}`,
          connectedAt: new Date('2026-10-04T08:00:00.000Z'),
        },
      ],
      notes: [],
    })
  })

  test('only the system scope reads the connection roster', async ({
    web,
    worker,
    seedChannel,
  }) => {
    const channelId = await seedChannel('user-a')
    const readRoster = (scope: Scoped<ScopeKind>) =>
      scope.sql.execute(sql`select * from connection_roster()`)
    const refusal = (read: Promise<unknown>) =>
      read.then(
        () => undefined,
        (error: unknown) => error,
      )
    // app_web holds no EXECUTE on the function; app_worker does, and the function checks the scope.
    const denied = { cause: { message: 'permission denied for function connection_roster' } }
    const refused = { cause: { message: 'connection_roster runs only in the system scope' } }

    expect(await refusal(web.asUser('user-a', readRoster))).toMatchObject(denied)
    expect(await refusal(web.asAnonymous(readRoster))).toMatchObject(denied)
    expect(await refusal(worker.forChannel(channelId, readRoster))).toMatchObject(refused)
  })

  test('the anonymous scope inserts a security event and reads none, and only the system scope reads it', async ({
    web,
    worker,
  }) => {
    const id = randomUUID()
    const event = { id, kind: 'subject' as const, hmac: 'hmac', receivedAt: new Date() }

    const anonymousRead = await web.asAnonymous(async (scope) => {
      await scope.sql.insert(securityEvents).values(event)
      return scope.sql.select().from(securityEvents)
    })

    expect(anonymousRead).toEqual([])
    expect(await web.asUser('user-a', (scope) => scope.sql.select().from(securityEvents))).toEqual(
      [],
    )
    expect(
      await worker.forChannel(randomUUID(), (scope) => scope.sql.select().from(securityEvents)),
    ).toEqual([])
    expect(await worker.asSystem((scope) => scope.sql.select().from(securityEvents))).toEqual([
      event,
    ])
  })

  test('the system scope deletes no row of a table other than the cache, the deletion log, the deletion requests, the security events, the activity days, the feedback messages and the account cancellations', async ({
    web,
    worker,
    seedChannel,
  }) => {
    await seedChannel('user-a')
    await seedSignIn(web, 'user-b')
    const tables = (await web.asAnonymous(publicTables)).filter(
      (table) =>
        ![
          'read_cache',
          'deletion_log',
          'deletion_requests',
          'security_events',
          'activity_days',
          'feedback_messages',
          'account_cancellations',
        ].includes(table),
    )
    expect(tables).toEqual(expect.arrayContaining(['channels', 'connections', 'users']))

    const deleted = await worker.asSystem(async (scope) => {
      const counts: number[] = []
      for (const table of tables) {
        const result = await scope.sql.execute(sql`delete from ${sql.identifier(table)}`)
        counts.push(result.rowCount ?? -1)
      }
      return counts
    })

    expect(deleted).toEqual(tables.map(() => 0))
    expect(await web.asUser('user-a', readOwnChannels)).toHaveLength(1)
  })

  test('the system scope deletes a request completed more than 24 months ago, and no open request however old', async ({
    worker,
    clock,
  }) => {
    clock.set(new Date('2026-10-04T12:00:00.000Z'))
    const requestedAt = new Date('2023-10-04T12:00:00.000Z')
    const [openChannelId, completedChannelId] = [randomUUID(), randomUUID()]
    for (const channelId of [openChannelId, completedChannelId]) {
      await worker.forChannel(channelId, (scope) =>
        scope.sql
          .insert(deletionRequests)
          .values({ channelId, reason: 'in_app_revocation', endedMemberships: 0, requestedAt }),
      )
    }
    // No WHERE clause, as the deletion job completes a request: the channel scope limits the update.
    await worker.forChannel(completedChannelId, (scope) =>
      scope.sql.update(deletionRequests).set({ channelId: null, completedAt: requestedAt }),
    )
    const readOpen = () =>
      worker.forChannel(openChannelId, (scope) =>
        scope.sql.select({ channelId: deletionRequests.channelId }).from(deletionRequests),
      )
    expect(await readOpen()).toEqual([{ channelId: openChannelId }])

    const deleted = await worker.asSystem(async (scope) => {
      const result = await scope.sql.execute(sql`delete from deletion_requests`)
      return result.rowCount
    })

    expect(deleted).toBe(1)
    expect(await readOpen()).toEqual([{ channelId: openChannelId }])
  })

  test('a scope pins the clock reading as app.now', async ({ transaction, jobs }) => {
    const now = new Date('2026-10-03T12:00:00.000Z')
    const pinned = workerDatabase(transaction, { jobs, clock: () => now })

    const appNow = await pinned.asSystem(async (scope) => {
      const result = await scope.sql.execute<{ now: string }>(
        sql`select current_setting('app.now') as now`,
      )
      return result.rows[0]?.now
    })

    expect(appNow).toBe(now.toISOString())
  })
})

// Limits: production gives each scope its own pooled connection, so these tests cannot show two
// scopes running in parallel. They show only that the harness's one connection stays sound when a
// test opens scopes at once, as every request of a test fired through Promise.all does.
describe('the test harness: scopes opened at once', () => {
  test('twenty scopes opened at once each run as their own user', async ({ web }) => {
    const userIds = Array.from({ length: 20 }, (_, i) => `user-${i}`)

    const seen = await Promise.all(
      userIds.map((userId) =>
        web.asUser(userId, async (scope) => {
          await letOtherScopesIn(scope)
          return (await readScopeIds(scope))?.userId
        }),
      ),
    )

    expect(seen).toEqual(userIds)
  })

  test('web and worker scopes opened at once take turns on the one connection', async ({
    web,
    worker,
  }) => {
    const channelId = randomUUID()

    const seen = await Promise.all([
      web.asUser('user-a', async (scope) => {
        await letOtherScopesIn(scope)
        return readScopeIds(scope)
      }),
      worker.forChannel(channelId, async (scope) => {
        await letOtherScopesIn(scope)
        return readScopeIds(scope)
      }),
      web.asAnonymous(readScopeIds),
      worker.asSystem(readScopeIds),
    ])

    expect(seen).toEqual([
      { userId: 'user-a', channelId: '' },
      { userId: '', channelId },
      { userId: '', channelId: '' },
      { userId: '', channelId: '' },
    ])
  })

  test('a scope opened inside a scope runs at once rather than waiting for its parent', async ({
    web,
    worker,
  }) => {
    const channelId = randomUUID()

    const inner = await web.asUser('user-a', () => worker.forChannel(channelId, readScopeIds))

    expect(inner).toEqual({ userId: '', channelId })
  })

  test('a scope that throws leaves the next scope free to run', async ({ web }) => {
    const opened = await Promise.allSettled([
      web.asUser('user-a', async (scope) => {
        await letOtherScopesIn(scope)
        throw new Error('the work failed')
      }),
      web.asUser('user-b', readScopeIds),
    ])

    expect(opened[0]).toMatchObject({ status: 'rejected', reason: { message: 'the work failed' } })
    expect(opened[1]).toEqual({ status: 'fulfilled', value: { userId: 'user-b', channelId: '' } })
  })
})

// Vitest cannot cancel a test body that times out: it fails the test and starts the next one while
// the old body goes on opening scopes. The second test here stands in for the test that runs after
// a timed-out one, since tests in one file run in order (creator-analytics#299).
describe('the test harness: work a test leaves running', () => {
  let leftBehind: WebDatabase | undefined

  test('a test keeps its web past its end', async ({ web }) => {
    leftBehind = web

    expect(await web.asUser('user-a', readScopeIds)).toEqual({ userId: 'user-a', channelId: '' })
  })

  test("a scope opened on an earlier test's web is refused and leaves this test's transaction sound", async ({
    web,
  }) => {
    if (!leftBehind) throw new Error('the earlier test kept no web')

    await expect(leftBehind.asUser('user-a', readScopeIds)).rejects.toThrow()

    expect(await web.asUser('user-b', readScopeIds)).toEqual({ userId: 'user-b', channelId: '' })
  })
})
