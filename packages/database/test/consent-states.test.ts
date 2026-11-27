import { randomBytes, randomUUID } from 'node:crypto'
import { describe, expect } from 'vitest'
import { consentStates } from '../src/schema.ts'
import type { Scoped, ScopeKind } from '../src/scopes.ts'
import { test } from './harness.ts'
import { seedUser } from './seed.ts'

/** A consent state's row for the user, a connect unless `change` says otherwise. */
function stateOf(userId: string, now: Date, change: Partial<typeof consentStates.$inferInsert>) {
  return {
    state: randomBytes(16).toString('base64url'),
    userId,
    purpose: 'connect' as const,
    channelId: null,
    expiresAt: new Date(now.getTime() + 600_000),
    ...change,
  }
}

/** The error the statement fails with, in a transaction of its own, or undefined if it runs. */
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

// creator-analytics#907: a connect's landing is a name from a fixed set, and only a connect has one
// (migration 0036's `consent_states_landing`).
describe('the consent_states landing check, as app_web', () => {
  test('a connect with the upgrade landing, and one with none, are stored', async ({ web }) => {
    await seedUser(web, 'consent-user-a')

    const read = await web.asUser('consent-user-a', async (scope) => {
      await scope.sql
        .insert(consentStates)
        .values([
          stateOf('consent-user-a', scope.now, { landing: 'upgrade' }),
          stateOf('consent-user-a', scope.now, {}),
        ])
      return scope.sql.select({ landing: consentStates.landing }).from(consentStates)
    })

    expect(read.map(({ landing }) => landing).sort()).toEqual(['upgrade', null].sort())
  })

  test.for([
    [
      'a revenue consent with a landing',
      { purpose: 'revenue', channelId: randomUUID(), landing: 'upgrade' },
    ],
    ['a connect with a landing other than upgrade', { landing: 'settings' }],
    ['a connect with an address for its landing', { landing: 'https://elsewhere.example' }],
  ] as const)('%s is refused by the check', async ([, change], { web }) => {
    await seedUser(web, 'consent-user-a')

    const refusal = await web.asUser('consent-user-a', (scope) =>
      refusalOf(scope, (tx) =>
        tx.insert(consentStates).values(stateOf('consent-user-a', scope.now, change as never)),
      ),
    )

    expect(refusal).toMatchObject({
      cause: { code: '23514', constraint: 'consent_states_landing' },
    })
  })
})
