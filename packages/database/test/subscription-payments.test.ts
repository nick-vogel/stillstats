import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { userSubscriptionPayments } from '../src/schema.ts'
import type { Scoped, ScopeKind } from '../src/scopes.ts'
import { test } from './harness.ts'
import { seedChannel, seedUser } from './seed.ts'

/** Records the invoice of the user's subscription, or of the legacy channel's owner's. */
function record(invoice: string, userId: string | null, legacyChannelId: string | null = null) {
  return (scope: Scoped<ScopeKind>) =>
    scope.sql
      .execute<{ recorded: boolean }>(
        sql`select record_user_subscription_payment(${invoice}, ${userId}, ${legacyChannelId}::uuid) as recorded`,
      )
      .then(({ rows }) => rows[0]?.recorded)
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

function readPayments(scope: Scoped<ScopeKind>) {
  return scope.sql
    .select({ invoice: userSubscriptionPayments.stripeInvoiceId })
    .from(userSubscriptionPayments)
}

const policyRefusal = {
  cause: {
    message: 'new row violates row-level security policy for table "user_subscription_payments"',
  },
}

const ownerId = 'payments-owner'

describe('record_user_subscription_payment, the one write path to user_subscription_payments', () => {
  test('a new invoice answers true, and the same invoice again answers false', async ({ web }) => {
    await seedUser(web, ownerId)

    expect(await web.asAnonymous(record('in_test_first', ownerId))).toBe(true)
    expect(await web.asAnonymous(record('in_test_first', ownerId))).toBe(false)
    expect(await web.asAnonymous(record('in_test_renewal', ownerId))).toBe(true)
    expect(await web.asUser(ownerId, readPayments)).toEqual(
      expect.arrayContaining([{ invoice: 'in_test_first' }, { invoice: 'in_test_renewal' }]),
    )
  })

  test("an invoice of a subscription made before blocks names a channel, and records onto the channel's owner", async ({
    web,
    worker,
  }) => {
    const channelId = await seedChannel(web, worker, ownerId)

    expect(await web.asAnonymous(record('in_test_legacy', null, channelId))).toBe(true)
    expect(await web.asUser(ownerId, readPayments)).toContainEqual({ invoice: 'in_test_legacy' })
  })

  test('a user or a channel that does not exist answers false and records nothing', async ({
    web,
  }) => {
    expect(await web.asAnonymous(record('in_test_gone', 'payments-nobody'))).toBe(false)
    expect(await web.asAnonymous(record('in_test_gone', 'payments-nobody'))).toBe(false)
    expect(await web.asAnonymous(record('in_test_gone', null, randomUUID()))).toBe(false)
  })

  test('runs only in the anonymous scope', async ({ web, worker }) => {
    await seedUser(web, 'payments-owner')
    const channelId = randomUUID()
    const attempt = (scope: Scoped<ScopeKind>) => refusalOf(scope, record('in_test_scope', ownerId))
    // app_web holds EXECUTE on the function and the function checks the scope; app_worker holds none.
    const refused = {
      cause: { message: 'record_user_subscription_payment runs only in the anonymous scope' },
    }
    const denied = {
      cause: { message: 'permission denied for function record_user_subscription_payment' },
    }

    expect(await web.asUser('payments-owner', attempt)).toMatchObject(refused)
    expect(await web.asAdmin('payments-owner', attempt)).toMatchObject(refused)
    expect(await worker.forChannel(channelId, attempt)).toMatchObject(denied)
    expect(await worker.asSystem(attempt)).toMatchObject(denied)
  })

  test('no scope writes a payment row itself, and the anonymous scope reads none', async ({
    web,
    worker,
  }) => {
    const channelId = await seedChannel(web, worker, 'payments-owner')
    await web.asAnonymous(record('in_test_stored', ownerId))
    const writes = async (scope: Scoped<ScopeKind>) => ({
      inserted: await refusalOf(scope, (attempt) =>
        attempt.sql
          .insert(userSubscriptionPayments)
          .values({ stripeInvoiceId: 'in_test_written', userId: ownerId }),
      ),
      updated: (
        await scope.sql.update(userSubscriptionPayments).set({ stripeInvoiceId: 'in_test_changed' })
      ).rowCount,
      deleted: (await scope.sql.delete(userSubscriptionPayments)).rowCount,
    })
    const refusedEverything = { inserted: policyRefusal, updated: 0, deleted: 0 }

    expect(await web.asAnonymous(readPayments)).toEqual([])
    expect(await web.asAnonymous(writes)).toMatchObject(refusedEverything)
    expect(await web.asUser('payments-owner', writes)).toMatchObject(refusedEverything)
    expect(await worker.forChannel(channelId, writes)).toMatchObject(refusedEverything)
    expect(await worker.forChannel(channelId, readPayments)).toEqual([])
    expect(await web.asUser(ownerId, readPayments)).toContainEqual({ invoice: 'in_test_stored' })
  })
})
