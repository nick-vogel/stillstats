import { randomUUID } from 'node:crypto'
import { asc, eq, getTableColumns, sql } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { setting } from '../src/access.ts'
import { feedbackCountToday } from '../src/feedback.ts'
import {
  accounts,
  activityDays,
  consentStates,
  deletionLog,
  deletionRequests,
  feedbackMessages,
  preferences,
  quotaUsage,
  securityEvents,
  sessions,
  subscriptionCancellations,
  tips,
  users,
  verifications,
} from '../src/schema.ts'
import type { Scoped, ScopeKind, WebDatabase } from '../src/scopes.ts'
import { readFeedbackMessages } from './feedback-rows.ts'
import { test } from './harness.ts'
import { seedChannel, seedUser } from './seed.ts'

function messageOf(userId: string, createdAt: Date) {
  return {
    id: randomUUID(),
    userId,
    type: 'idea' as const,
    text: 'A thought',
    screen: 'video_list' as const,
    createdAt,
  }
}

async function sendMessage(web: WebDatabase, userId: string) {
  await seedUser(web, userId)
  await web.asUser(userId, (scope) =>
    scope.sql.insert(feedbackMessages).values(messageOf(userId, scope.now)),
  )
}

/** A message the user sent and Nick marked "Done" at the time given. */
async function sendHandledMessage(web: WebDatabase, userId: string, doneAt: Date, text: string) {
  await seedUser(web, userId)
  await web.asUser(userId, (scope) =>
    scope.sql.insert(feedbackMessages).values({ ...messageOf(userId, doneAt), text, doneAt }),
  )
}

const dayMs = 24 * 60 * 60 * 1000
const pinnedNow = new Date('2026-11-15T12:00:00.000Z')
const handledOverAYearAgo = new Date('2025-11-14T12:00:00.000Z')

/** The error a statement fails with, run in a savepoint so a refusal leaves the scope usable. */
function refusalOf(scope: Scoped<ScopeKind>, statement: (tx: Scoped<ScopeKind>['sql']) => unknown) {
  return scope.sql
    .transaction(async (attempt) => {
      await statement(attempt)
    })
    .then(
      () => undefined,
      (error: unknown) => error,
    )
}

function readOwn(scope: Scoped<ScopeKind>) {
  return scope.sql.select({ id: feedbackMessages.id }).from(feedbackMessages)
}

const policyRefusal = {
  cause: { message: 'new row violates row-level security policy for table "feedback_messages"' },
}

// A policy admits rows, not columns: the column grant of migration 0027 is what refuses this.
const columnRefusal = { cause: { message: 'permission denied for table feedback_messages' } }

describe('the feedback messages table', () => {
  test('a user scope inserts a message of its own', async ({ web, transaction }) => {
    await seedUser(web, 'feedback-user-a')
    const message = messageOf('feedback-user-a', new Date('2026-11-15T12:00:00Z'))

    await web.asUser('feedback-user-a', (scope) =>
      scope.sql.insert(feedbackMessages).values(message),
    )

    expect(await readFeedbackMessages(transaction)).toEqual([
      { ...message, appVersion: null, replyTo: null, doneAt: null },
    ])
  })

  test("a user scope cannot insert another user's message", async ({ web, transaction }) => {
    await seedUser(web, 'feedback-user-a')
    await seedUser(web, 'feedback-user-b')

    const refusal = await web.asUser('feedback-user-a', (scope) =>
      refusalOf(scope, (tx) =>
        tx.insert(feedbackMessages).values(messageOf('feedback-user-b', scope.now)),
      ),
    )

    expect(refusal).toMatchObject(policyRefusal)
    expect(await readFeedbackMessages(transaction)).toEqual([])
  })

  test('a user scope reads, updates and deletes no message, its own included', async ({
    web,
    transaction,
    clock,
  }) => {
    clock.set(pinnedNow)
    await sendHandledMessage(web, 'feedback-user-a', handledOverAYearAgo, 'A handled thought')
    await sendMessage(web, 'feedback-user-a')

    const seen = await web.asUser('feedback-user-a', async (scope) => {
      const updated = await scope.sql.update(feedbackMessages).set({ doneAt: scope.now })
      const textChange = await refusalOf(scope, (tx) =>
        tx.update(feedbackMessages).set({ text: 'Changed' }),
      )
      const deleted = await scope.sql.delete(feedbackMessages)
      return {
        read: await readOwn(scope),
        updated: updated.rowCount,
        textChange,
        deleted: deleted.rowCount,
      }
    })

    expect(seen).toMatchObject({ read: [], updated: 0, textChange: columnRefusal, deleted: 0 })
    expect(await readFeedbackMessages(transaction)).toMatchObject([
      { text: 'A handled thought' },
      { text: 'A thought', doneAt: null },
    ])
  })

  test('the anonymous and channel scopes read, insert, update and delete no message', async ({
    web,
    worker,
    transaction,
    clock,
  }) => {
    clock.set(pinnedNow)
    await sendHandledMessage(web, 'feedback-user-a', handledOverAYearAgo, 'A handled thought')
    await sendMessage(web, 'feedback-user-a')
    const reachOf = async (scope: Scoped<ScopeKind>) => {
      const inserted = await refusalOf(scope, (tx) =>
        tx.insert(feedbackMessages).values(messageOf('feedback-user-a', scope.now)),
      )
      const updated = await scope.sql.update(feedbackMessages).set({ doneAt: scope.now })
      const deleted = await scope.sql.delete(feedbackMessages)
      return {
        read: await readOwn(scope),
        inserted: inserted === undefined,
        updated: updated.rowCount,
        deleted: deleted.rowCount,
      }
    }
    const none = { read: [], inserted: false, updated: 0, deleted: 0 }

    expect(await web.asAnonymous(reachOf)).toEqual(none)
    expect(await worker.forChannel(randomUUID(), reachOf)).toEqual(none)
    // app_web holds UPDATE on the "Done" time alone, so a change of the text is refused outright.
    expect(
      await web.asAnonymous((scope) =>
        refusalOf(scope, (tx) => tx.update(feedbackMessages).set({ text: 'Changed' })),
      ),
    ).toMatchObject(columnRefusal)
    expect(await readFeedbackMessages(transaction)).toMatchObject([
      { text: 'A handled thought' },
      { text: 'A thought', doneAt: null },
    ])
  })

  test('the system scope deletes the messages "Done" more than one year before the pinned clock, and keeps the younger and the open ones', async ({
    web,
    worker,
    transaction,
    clock,
  }) => {
    clock.set(pinnedNow)
    const exactlyAYearAgo = new Date('2025-11-15T12:00:00.000Z')
    await sendHandledMessage(web, 'feedback-user-a', handledOverAYearAgo, 'A year and a day')
    await sendHandledMessage(web, 'feedback-user-a', exactlyAYearAgo, 'Exactly a year')
    await sendHandledMessage(
      web,
      'feedback-user-a',
      new Date(pinnedNow.getTime() - 364 * dayMs),
      '364 days',
    )
    await sendMessage(web, 'feedback-user-a')
    const deleteAll = () =>
      worker.asSystem(async (scope) => (await scope.sql.delete(feedbackMessages)).rowCount)

    const deleted = await deleteAll()
    const kept = await readFeedbackMessages(transaction)
    clock.advance(1)
    const deletedPastExactlyAYear = await deleteAll()

    expect([deleted, deletedPastExactlyAYear]).toEqual([1, 1])
    expect(kept).toMatchObject([
      { text: 'Exactly a year' },
      { text: '364 days' },
      { text: 'A thought', doneAt: null },
    ])
    expect(await readFeedbackMessages(transaction)).toMatchObject([
      { text: '364 days' },
      { text: 'A thought', doneAt: null },
    ])
  })

  test('the system scope cannot insert a message, and reads and updates none, however old its "Done" time', async ({
    web,
    worker,
    transaction,
    clock,
  }) => {
    clock.set(pinnedNow)
    await sendHandledMessage(web, 'feedback-user-a', handledOverAYearAgo, 'A handled thought')

    const seen = await worker.asSystem(async (scope) => {
      const inserted = await refusalOf(scope, (tx) =>
        tx.insert(feedbackMessages).values(messageOf('feedback-user-a', scope.now)),
      )
      const updated = await scope.sql.update(feedbackMessages).set({ text: 'Changed' })
      return { inserted, read: await readOwn(scope), updated: updated.rowCount }
    })

    expect(seen).toMatchObject({ inserted: policyRefusal, read: [], updated: 0 })
    expect(await readFeedbackMessages(transaction)).toMatchObject([{ text: 'A handled thought' }])
  })

  test.for([
    ['type', { type: 'complaint' }],
    ['screen', { screen: '/app/videos/abc' }],
  ] as const)('a message of an unknown %s is refused', async ([, change], { web }) => {
    await seedUser(web, 'feedback-user-a')

    const refusal = await web.asUser('feedback-user-a', (scope) =>
      refusalOf(scope, (tx) =>
        tx
          .insert(feedbackMessages)
          .values({ ...messageOf('feedback-user-a', scope.now), ...change } as never),
      ),
    )

    expect(refusal).toMatchObject({ cause: { code: '23514' } })
  })

  test("deleting the user removes their messages and keeps another user's", async ({
    web,
    transaction,
  }) => {
    await sendMessage(web, 'feedback-user-a')
    await sendMessage(web, 'feedback-user-b')

    await web.asUser('feedback-user-a', (scope) =>
      scope.sql.delete(users).where(eq(users.id, setting('app.user_id'))),
    )

    expect(await readFeedbackMessages(transaction)).toMatchObject([{ userId: 'feedback-user-b' }])
  })
})

const admin = 'feedback-admin'

function readAll(scope: Scoped<ScopeKind>) {
  return scope.sql
    .select({ userId: feedbackMessages.userId, text: feedbackMessages.text })
    .from(feedbackMessages)
    .orderBy(asc(feedbackMessages.createdAt))
}

/** Every table in `public`, read from the catalog, so a table added later is in the list too. */
async function publicTables(scope: Scoped<ScopeKind>): Promise<string[]> {
  const result = await scope.sql.execute<{ name: string }>(
    sql`select tablename as name from pg_tables where schemaname = 'public' order by tablename`,
  )
  return result.rows.map((row) => row.name)
}

/** How many rows of each table the scope reads, or 'refused' where the read is refused. */
async function rowCountsOf(
  scope: Scoped<ScopeKind>,
  tables: string[],
): Promise<Record<string, number | 'refused'>> {
  const counts: Record<string, number | 'refused'> = {}
  for (const table of tables) {
    counts[table] = await scope.sql
      .transaction(async (attempt) => {
        const result = await attempt.execute<{ n: number }>(
          sql`select count(*)::int as n from ${sql.identifier(table)}`,
        )
        return result.rows[0]?.n ?? 0
      })
      .catch(() => 'refused' as const)
  }
  return counts
}

describe('the admin scope (creator-analytics#583)', () => {
  test("reads every user's messages", async ({ web, clock }) => {
    clock.set(new Date('2026-11-15T12:00:00Z'))
    await sendMessage(web, 'feedback-user-a')
    clock.advance(1000)
    await sendMessage(web, 'feedback-user-b')

    expect(await web.asAdmin(admin, readAll)).toEqual([
      { userId: 'feedback-user-a', text: 'A thought' },
      { userId: 'feedback-user-b', text: 'A thought' },
    ])
  })

  test('sets and clears the "Done" time of any message', async ({ web, transaction, clock }) => {
    clock.set(new Date('2026-11-15T12:00:00Z'))
    await sendMessage(web, 'feedback-user-a')
    clock.advance(1000)
    await sendMessage(web, 'feedback-user-b')
    const doneAt = new Date('2026-11-15T13:00:00Z')

    const set = await web.asAdmin(admin, (scope) =>
      scope.sql
        .update(feedbackMessages)
        .set({ doneAt })
        .where(eq(feedbackMessages.userId, 'feedback-user-b')),
    )

    expect(set.rowCount).toBe(1)
    expect(await readFeedbackMessages(transaction)).toMatchObject([
      { userId: 'feedback-user-a', doneAt: null },
      { userId: 'feedback-user-b', doneAt },
    ])

    await web.asAdmin(admin, (scope) => scope.sql.update(feedbackMessages).set({ doneAt: null }))

    expect(await readFeedbackMessages(transaction)).toMatchObject([
      { userId: 'feedback-user-a', doneAt: null },
      { userId: 'feedback-user-b', doneAt: null },
    ])
  })

  test('changes no column but the "Done" time', async ({ web, transaction }) => {
    await sendMessage(web, 'feedback-user-a')
    await seedUser(web, 'feedback-user-b')
    const changes: Partial<typeof feedbackMessages.$inferInsert> = {
      id: randomUUID(),
      userId: 'feedback-user-b',
      type: 'other',
      text: 'Changed',
      screen: 'settings',
      appVersion: '2026.11.9',
      replyTo: 'changed@example.com',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }
    // Every column the table holds but the "Done" time, so a column added later is tried too.
    expect(Object.keys(changes).sort()).toEqual(
      Object.keys(getTableColumns(feedbackMessages))
        .filter((column) => column !== 'doneAt')
        .sort(),
    )

    const refusals = await web.asAdmin(admin, async (scope) => {
      const refused: Record<string, unknown> = {}
      for (const [column, value] of Object.entries(changes)) {
        refused[column] = await refusalOf(scope, (tx) =>
          tx.update(feedbackMessages).set({ [column]: value }),
        )
      }
      return refused
    })

    expect(refusals).toMatchObject(
      Object.fromEntries(Object.keys(changes).map((column) => [column, columnRefusal])),
    )
    expect(await readFeedbackMessages(transaction)).toMatchObject([
      { userId: 'feedback-user-a', text: 'A thought', type: 'idea', screen: 'video_list' },
    ])
  })

  // The admin enters as the user who owns the message and the row it tries, as Nick is a user too,
  // so an insert or delete policy that admits rows by app.user_id without the user scope check fails.
  test('inserts no message and deletes none', async ({ web, transaction }) => {
    await sendMessage(web, 'feedback-user-a')

    const reach = await web.asAdmin('feedback-user-a', async (scope) => ({
      inserted: await refusalOf(scope, (tx) =>
        tx.insert(feedbackMessages).values(messageOf('feedback-user-a', scope.now)),
      ),
      deleted: (await scope.sql.delete(feedbackMessages)).rowCount,
    }))

    expect(reach).toMatchObject({ inserted: policyRefusal, deleted: 0 })
    expect(await readFeedbackMessages(transaction)).toHaveLength(1)
  })

  // The other scopes read the presence check: a table no scope reads a row of proves nothing here,
  // so every table in public holds a row some other scope reads, and a table added later fails the
  // check until this test seeds it. The admin enters as the user who owns every seeded row, as Nick
  // is a user too, so a policy that admits rows by app.user_id without the user scope check fails.
  test('reads no row of any other table in public', async ({ web, worker }) => {
    const userId = 'feedback-user-a'
    const channelId = await seedChannel(web, worker, userId)
    await web.asAnonymous(async (scope) => {
      await scope.sql
        .insert(securityEvents)
        .values({ id: randomUUID(), kind: 'subject', hmac: 'hmac', receivedAt: scope.now })
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
    await web.asUser(userId, async (scope) => {
      await scope.sql.insert(preferences).values({ userId, pageSize: 50 })
      await scope.sql.insert(activityDays).values({ userId, day: '2026-11-15' })
      await scope.sql
        .insert(consentStates)
        .values({ state: `${userId}-state`, userId, purpose: 'connect', expiresAt: scope.now })
      await scope.sql.insert(quotaUsage).values({ api: 'data', quotaDay: '2026-11-15', units: 1 })
      await scope.sql.insert(deletionRequests).values({
        channelId,
        reason: 'in_app_revocation',
        endedMemberships: 0,
        requestedAt: scope.now,
      })
    })
    await web.asAnonymous((scope) =>
      scope.sql
        .insert(tips)
        .values({ checkoutSessionId: `${userId}-checkout`, userId, recordedAt: scope.now }),
    )
    await worker.forChannel(channelId, async (scope) => {
      await scope.sql.insert(deletionLog).values({
        youtubeChannelHmac: 'hmac',
        reason: 'in_app_revocation',
        requestedAt: scope.now,
        completedAt: scope.now,
        rowCounts: {},
      })
      await scope.sql.insert(subscriptionCancellations).values({
        channelId,
        deletionRequestId: randomUUID(),
        stripeSubscriptionId: `sub_${channelId}`,
        createdAt: scope.now,
      })
    })
    await sendMessage(web, userId)
    const tables = (await web.asAnonymous(publicTables)).filter(
      (table) => table !== 'feedback_messages',
    )
    const counts = (scope: Scoped<ScopeKind>) => rowCountsOf(scope, tables)
    const seen = [
      await web.asUser(userId, counts),
      await web.asAnonymous(counts),
      await worker.forChannel(channelId, counts),
      await worker.asSystem(counts),
    ]
    const held = tables.filter((table) =>
      seen.some((count) => typeof count[table] === 'number' && count[table] > 0),
    )
    expect(held).toEqual(tables)

    const read = await web.asAdmin(userId, counts)

    expect(Object.fromEntries(held.map((table) => [table, read[table]]))).toEqual(
      Object.fromEntries(held.map((table) => [table, 0])),
    )
  })
})

// Limits: the harness runs every scope on one connection, so these tests cannot show two sends at
// once waiting on the count's advisory lock. Nothing in the suite covers it.
describe("the count of a user's messages in the last 24 hours", () => {
  test("counts the scope user's messages after the pinned time less 24 hours, and no other user's", async ({
    web,
    clock,
  }) => {
    clock.set(new Date('2026-11-14T12:00:00Z'))
    await sendMessage(web, 'feedback-user-a')
    clock.set(new Date('2026-11-15T11:00:00Z'))
    await sendMessage(web, 'feedback-user-a')
    await sendMessage(web, 'feedback-user-b')

    expect(await web.asUser('feedback-user-a', feedbackCountToday)).toBe(2)
    clock.set(new Date('2026-11-15T12:00:00Z'))
    expect(await web.asUser('feedback-user-a', feedbackCountToday)).toBe(1)
    expect(await web.asUser('feedback-user-c', feedbackCountToday)).toBe(0)
  })

  test('runs only in a user scope', async ({ web, worker }) => {
    const count = (scope: Scoped<ScopeKind>) =>
      refusalOf(scope, (tx) => tx.execute(sql`select feedback_count_today()`))
    // app_web holds EXECUTE on the function and the function checks the scope; app_worker holds none.
    const refused = { cause: { message: 'feedback_count_today runs only in a user scope' } }
    const denied = { cause: { message: 'permission denied for function feedback_count_today' } }

    expect(await web.asAnonymous(count)).toMatchObject(refused)
    expect(await worker.forChannel(randomUUID(), count)).toMatchObject(denied)
    expect(await worker.asSystem(count)).toMatchObject(denied)
  })
})
