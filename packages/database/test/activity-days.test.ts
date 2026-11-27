import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { setting } from '../src/access.ts'
import { activityDays, users } from '../src/schema.ts'
import type { Scoped, ScopeKind, WebDatabase } from '../src/scopes.ts'
import { test } from './harness.ts'
import { seedUser } from './seed.ts'

async function recordDay(web: WebDatabase, userId: string, day: string) {
  await seedUser(web, userId)
  await web.asUser(userId, (scope) => scope.sql.insert(activityDays).values({ userId, day }))
}

function readActivityDays(scope: Scoped<ScopeKind>) {
  return scope.sql
    .select({ userId: activityDays.userId, day: activityDays.day })
    .from(activityDays)
    .orderBy(activityDays.userId, activityDays.day)
}

describe('the activity days table', () => {
  test('a user scope inserts its own activity day, and the system scope reads it', async ({
    web,
    worker,
  }) => {
    await seedUser(web, 'activity-user-a')

    await web.asUser('activity-user-a', (scope) =>
      scope.sql.insert(activityDays).values({ userId: 'activity-user-a', day: '2026-11-11' }),
    )

    expect(await worker.asSystem(readActivityDays)).toEqual([
      { userId: 'activity-user-a', day: '2026-11-11' },
    ])
  })

  test("a user scope cannot insert another user's activity day", async ({ web, worker }) => {
    await seedUser(web, 'activity-user-a')
    await seedUser(web, 'activity-user-b')

    await web.asUser('activity-user-a', async (scope) => {
      // A refused statement aborts its transaction, so the attempt runs in a savepoint of its own.
      const refusal = await scope.sql
        .transaction((attempt) =>
          attempt.insert(activityDays).values({ userId: 'activity-user-b', day: '2026-11-11' }),
        )
        .then(
          () => undefined,
          (error: unknown) => error,
        )
      expect(refusal).toMatchObject({
        cause: { message: 'new row violates row-level security policy for table "activity_days"' },
      })
    })

    expect(await worker.asSystem(readActivityDays)).toEqual([])
  })

  test('a user scope reads no activity day, its own included', async ({ web, worker }) => {
    await recordDay(web, 'activity-user-a', '2026-11-11')

    expect(await web.asUser('activity-user-a', readActivityDays)).toEqual([])
    expect(await worker.asSystem(readActivityDays)).toHaveLength(1)
  })

  test('a second activity day for the same user and day, with a target-less ON CONFLICT DO NOTHING, writes nothing and does not fail', async ({
    web,
    worker,
  }) => {
    await recordDay(web, 'activity-user-a', '2026-11-11')

    const inserted = await web.asUser('activity-user-a', async (scope) => {
      const result = await scope.sql
        .insert(activityDays)
        .values({ userId: 'activity-user-a', day: '2026-11-11' })
        .onConflictDoNothing()
      return result.rowCount
    })

    expect(inserted).toBe(0)
    expect(await worker.asSystem(readActivityDays)).toEqual([
      { userId: 'activity-user-a', day: '2026-11-11' },
    ])
  })

  test("the system scope reads every user's activity days and deletes them", async ({
    web,
    worker,
  }) => {
    await recordDay(web, 'activity-user-a', '2026-11-10')
    await recordDay(web, 'activity-user-a', '2026-11-11')
    await recordDay(web, 'activity-user-b', '2026-11-11')

    expect(await worker.asSystem(readActivityDays)).toEqual([
      { userId: 'activity-user-a', day: '2026-11-10' },
      { userId: 'activity-user-a', day: '2026-11-11' },
      { userId: 'activity-user-b', day: '2026-11-11' },
    ])

    const deleted = await worker.asSystem(async (scope) => {
      const result = await scope.sql.delete(activityDays)
      return result.rowCount
    })

    expect(deleted).toBe(3)
    expect(await worker.asSystem(readActivityDays)).toEqual([])
  })

  test('the channel and anonymous scopes read no activity day and delete none', async ({
    web,
    worker,
  }) => {
    await recordDay(web, 'activity-user-a', '2026-11-11')

    expect(await worker.forChannel(randomUUID(), readActivityDays)).toEqual([])
    expect(await web.asAnonymous(readActivityDays)).toEqual([])
    await worker.forChannel(randomUUID(), (scope) => scope.sql.delete(activityDays))
    await web.asAnonymous((scope) => scope.sql.delete(activityDays))
    expect(await worker.asSystem(readActivityDays)).toHaveLength(1)
  })

  test("deleting the user removes their activity days and keeps another user's", async ({
    web,
    worker,
  }) => {
    await recordDay(web, 'activity-user-a', '2026-11-11')
    await recordDay(web, 'activity-user-b', '2026-11-11')

    await web.asUser('activity-user-a', (scope) =>
      scope.sql.delete(users).where(eq(users.id, setting('app.user_id'))),
    )

    expect(await worker.asSystem(readActivityDays)).toEqual([
      { userId: 'activity-user-b', day: '2026-11-11' },
    ])
  })
})
