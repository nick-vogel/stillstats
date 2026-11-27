import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { setting } from '../src/access.ts'
import { tips, users } from '../src/schema.ts'
import type { Scoped, ScopeKind, WebDatabase } from '../src/scopes.ts'
import { test } from './harness.ts'
import { seedUser } from './seed.ts'

async function recordTip(web: WebDatabase, userId: string, checkoutSessionId: string) {
  await web.asAnonymous((scope) =>
    scope.sql.insert(tips).values({ checkoutSessionId, userId, recordedAt: scope.now }),
  )
}

function readTips(scope: Scoped<ScopeKind>) {
  return scope.sql
    .select({ checkoutSessionId: tips.checkoutSessionId, userId: tips.userId })
    .from(tips)
}

describe('the tips table, as app_web', () => {
  test('the anonymous scope inserts a tip and reads none', async ({ web }) => {
    await seedUser(web, 'tips-user-a')

    const anonymousRead = await web.asAnonymous(async (scope) => {
      await scope.sql
        .insert(tips)
        .values({ checkoutSessionId: 'cs_test_a', userId: 'tips-user-a', recordedAt: scope.now })
      return readTips(scope)
    })

    expect(anonymousRead).toEqual([])
    expect(await web.asUser('tips-user-a', readTips)).toEqual([
      { checkoutSessionId: 'cs_test_a', userId: 'tips-user-a' },
    ])
  })

  test('a second tip with the same Checkout Session ID is refused, and a target-less ON CONFLICT DO NOTHING writes nothing', async ({
    web,
  }) => {
    await seedUser(web, 'tips-user-a')
    await recordTip(web, 'tips-user-a', 'cs_test_a')

    const inserted = await web.asAnonymous(async (scope) => {
      const result = await scope.sql
        .insert(tips)
        .values({ checkoutSessionId: 'cs_test_a', userId: 'tips-user-a', recordedAt: scope.now })
        .onConflictDoNothing()
      return result.rowCount
    })

    expect(inserted).toBe(0)
    expect(await web.asUser('tips-user-a', readTips)).toHaveLength(1)
  })

  test('a user scope reads only its own tip', async ({ web }) => {
    await seedUser(web, 'tips-user-a')
    await seedUser(web, 'tips-user-b')
    await recordTip(web, 'tips-user-a', 'cs_test_a')
    await recordTip(web, 'tips-user-b', 'cs_test_b')

    expect(await web.asUser('tips-user-a', readTips)).toEqual([
      { checkoutSessionId: 'cs_test_a', userId: 'tips-user-a' },
    ])
  })

  test('a user scope cannot insert a tip, even its own', async ({ web }) => {
    await seedUser(web, 'tips-user-a')

    const stored = await web.asUser('tips-user-a', async (scope) => {
      // A refused statement aborts its transaction, so the attempt runs in a savepoint of its own.
      const refusal = await scope.sql
        .transaction((attempt) =>
          attempt.insert(tips).values({
            checkoutSessionId: 'cs_test_a',
            userId: 'tips-user-a',
            recordedAt: scope.now,
          }),
        )
        .then(
          () => undefined,
          (error: unknown) => error,
        )
      expect(refusal).toMatchObject({
        cause: { message: 'new row violates row-level security policy for table "tips"' },
      })
      return readTips(scope)
    })

    expect(stored).toEqual([])
  })

  // No WHERE clause, so only the policy limits the delete to the scope's own row.
  test("a user scope's delete removes only its own tip", async ({ web }) => {
    await seedUser(web, 'tips-user-a')
    await seedUser(web, 'tips-user-b')
    await recordTip(web, 'tips-user-a', 'cs_test_a')
    await recordTip(web, 'tips-user-b', 'cs_test_b')

    await web.asUser('tips-user-a', (scope) => scope.sql.delete(tips))

    expect(await web.asUser('tips-user-a', readTips)).toEqual([])
    expect(await web.asUser('tips-user-b', readTips)).toEqual([
      { checkoutSessionId: 'cs_test_b', userId: 'tips-user-b' },
    ])
  })

  // Seeding through a user scope leaves app.user_id set in the test transaction, because SET
  // LOCAL survives RELEASE SAVEPOINT, so these scopes would admit a row a user check alone admits.
  test('the anonymous, channel and system scopes read no tip', async ({ web, worker }) => {
    await seedUser(web, 'tips-user-a')
    await recordTip(web, 'tips-user-a', 'cs_test_a')
    expect(await web.asUser('tips-user-a', readTips)).toHaveLength(1)

    expect(await web.asAnonymous(readTips)).toEqual([])
    expect(await worker.forChannel(randomUUID(), readTips)).toEqual([])
    expect(await worker.asSystem(readTips)).toEqual([])
  })

  test('deleting the user removes their tip', async ({ web }) => {
    await seedUser(web, 'tips-user-a')
    await seedUser(web, 'tips-user-b')
    await recordTip(web, 'tips-user-a', 'cs_test_a')
    await recordTip(web, 'tips-user-b', 'cs_test_b')

    await web.asUser('tips-user-a', (scope) =>
      scope.sql.delete(users).where(eq(users.id, setting('app.user_id'))),
    )

    // A new user with the old ID would read the old tip, had the cascade left it.
    await seedUser(web, 'tips-user-a')
    expect(await web.asUser('tips-user-a', readTips)).toEqual([])
    expect(await web.asUser('tips-user-b', readTips)).toHaveLength(1)
  })
})
