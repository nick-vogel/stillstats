import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { preferences } from '../src/schema.ts'
import type { Scoped, ScopeKind, WebDatabase } from '../src/scopes.ts'
import { test } from './harness.ts'
import { seedUser } from './seed.ts'

async function seedPreferences(
  web: WebDatabase,
  userId: string,
  pageSize: NonNullable<typeof preferences.$inferSelect.pageSize>,
) {
  await seedUser(web, userId)
  await web.asUser(userId, (scope) =>
    scope.sql.insert(preferences).values({ userId, pageSize, chartMode: 'aggregate' }),
  )
}

function readPreferences(scope: Scoped<ScopeKind>) {
  return scope.sql
    .select({ userId: preferences.userId, pageSize: preferences.pageSize })
    .from(preferences)
}

describe('the preferences table, as app_web', () => {
  test('a user scope reads only its own preferences row', async ({ web }) => {
    await seedPreferences(web, 'preferences-user-a', 25)
    await seedPreferences(web, 'preferences-user-b', 50)

    expect(await web.asUser('preferences-user-a', readPreferences)).toEqual([
      { userId: 'preferences-user-a', pageSize: 25 },
    ])
  })

  test('a user scope cannot insert a preferences row for another user', async ({ web }) => {
    await seedUser(web, 'preferences-user-a')
    await seedUser(web, 'preferences-user-b')

    const stored = await web.asUser('preferences-user-a', async (scope) => {
      // A refused statement aborts its transaction, so the attempt runs in a savepoint of its own.
      const refusal = await scope.sql
        .transaction((attempt) =>
          attempt.insert(preferences).values({ userId: 'preferences-user-b', pageSize: 50 }),
        )
        .then(
          () => undefined,
          (error: unknown) => error,
        )
      expect(refusal).toMatchObject({
        cause: { message: 'new row violates row-level security policy for table "preferences"' },
      })
      return readPreferences(scope)
    })

    expect(stored).toEqual([])
    expect(await web.asUser('preferences-user-b', readPreferences)).toEqual([])
  })

  // No WHERE clause, so only the policy limits the update and the delete to the scope's own row.
  test("a user scope's update and delete change only its own row", async ({ web }) => {
    await seedPreferences(web, 'preferences-user-a', 25)
    await seedPreferences(web, 'preferences-user-b', 50)

    await web.asUser('preferences-user-a', (scope) =>
      scope.sql.update(preferences).set({ pageSize: 10 }),
    )
    expect(await web.asUser('preferences-user-a', readPreferences)).toEqual([
      { userId: 'preferences-user-a', pageSize: 10 },
    ])
    await web.asUser('preferences-user-a', (scope) => scope.sql.delete(preferences))

    expect(await web.asUser('preferences-user-a', readPreferences)).toEqual([])
    expect(await web.asUser('preferences-user-b', readPreferences)).toEqual([
      { userId: 'preferences-user-b', pageSize: 50 },
    ])
  })

  // Seeding through a user scope leaves app.user_id set in the test transaction, because SET
  // LOCAL survives RELEASE SAVEPOINT, so these scopes would admit a row a user check alone admits.
  test('the anonymous, channel and system scopes read no preferences row', async ({
    web,
    worker,
  }) => {
    await seedPreferences(web, 'preferences-user-a', 25)
    expect(await web.asUser('preferences-user-a', readPreferences)).toHaveLength(1)

    expect(await web.asAnonymous(readPreferences)).toEqual([])
    expect(await worker.forChannel(randomUUID(), readPreferences)).toEqual([])
    expect(await worker.asSystem(readPreferences)).toEqual([])
  })

  test.for([
    ['a page size outside 10, 25 and 50', 'page_size', 20, 'preferences_page_size'],
    ['a lower-case currency', 'currency', 'usd', 'preferences_currency'],
    ['an unknown chart mode', 'chart_mode', 'weekly', 'preferences_chart_mode'],
    ['an unknown chart card', 'chart_card', 'views', 'preferences_chart_card'],
    ['an unknown visibility', 'visibility', 'private', 'preferences_visibility'],
    ['an unknown theme', 'theme', 'sepia', 'preferences_theme'],
  ] as const)('the table refuses %s', async ([, column, value, constraint], { web }) => {
    await seedUser(web, 'preferences-user-a')

    // A refused insert aborts its scope's savepoint, so the refusal is read outside the scope.
    const refused = await web
      .asUser('preferences-user-a', (scope) =>
        scope.sql.execute(
          sql`insert into preferences (user_id, ${sql.identifier(column)}) values ('preferences-user-a', ${value})`,
        ),
      )
      .then(
        () => undefined,
        (error: { cause?: { constraint?: string } }) => error.cause?.constraint,
      )

    expect(refused).toBe(constraint)
  })
})
