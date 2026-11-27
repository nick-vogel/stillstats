import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { subscriptionPayments } from '../src/schema.ts'
import type { Scoped, ScopeKind } from '../src/scopes.ts'
import { test } from './harness.ts'
import { seedChannel, seedUser } from './seed.ts'

function record(invoice: string, channelId: string) {
  return (scope: Scoped<ScopeKind>) =>
    scope.sql
      .execute<{ recorded: boolean }>(
        sql`select record_subscription_payment(${invoice}, ${channelId}::uuid) as recorded`,
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
    .select({ invoice: subscriptionPayments.stripeInvoiceId })
    .from(subscriptionPayments)
}

const policyRefusal = {
  cause: {
    message: 'new row violates row-level security policy for table "subscription_payments"',
  },
}

describe('record_subscription_payment, the one write path to subscription_payments', () => {
  test('a new invoice answers true, and the same invoice again answers false', async ({
    web,
    worker,
  }) => {
    const channelId = await seedChannel(web, worker, 'payments-owner')

    expect(await web.asAnonymous(record('in_test_first', channelId))).toBe(true)
    expect(await web.asAnonymous(record('in_test_first', channelId))).toBe(false)
    expect(await web.asAnonymous(record('in_test_renewal', channelId))).toBe(true)
    expect(await worker.forChannel(channelId, readPayments)).toEqual(
      expect.arrayContaining([{ invoice: 'in_test_first' }, { invoice: 'in_test_renewal' }]),
    )
  })

  test('a channel that does not exist answers false and records nothing', async ({ web }) => {
    const channelId = randomUUID()

    expect(await web.asAnonymous(record('in_test_gone', channelId))).toBe(false)
    expect(await web.asAnonymous(record('in_test_gone', channelId))).toBe(false)
  })

  test('runs only in the anonymous scope', async ({ web, worker }) => {
    await seedUser(web, 'payments-owner')
    const channelId = randomUUID()
    const attempt = (scope: Scoped<ScopeKind>) =>
      refusalOf(scope, record('in_test_scope', channelId))
    // app_web holds EXECUTE on the function and the function checks the scope; app_worker holds none.
    const refused = {
      cause: { message: 'record_subscription_payment runs only in the anonymous scope' },
    }
    const denied = {
      cause: { message: 'permission denied for function record_subscription_payment' },
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
    await web.asAnonymous(record('in_test_stored', channelId))
    const writes = async (scope: Scoped<ScopeKind>) => ({
      inserted: await refusalOf(scope, (attempt) =>
        attempt.sql
          .insert(subscriptionPayments)
          .values({ stripeInvoiceId: 'in_test_written', channelId }),
      ),
      updated: (
        await scope.sql.update(subscriptionPayments).set({ stripeInvoiceId: 'in_test_changed' })
      ).rowCount,
      deleted: (await scope.sql.delete(subscriptionPayments)).rowCount,
    })
    const refusedEverything = { inserted: policyRefusal, updated: 0, deleted: 0 }

    expect(await web.asAnonymous(readPayments)).toEqual([])
    expect(await web.asAnonymous(writes)).toMatchObject(refusedEverything)
    expect(await web.asUser('payments-owner', writes)).toMatchObject(refusedEverything)
    expect(await worker.forChannel(channelId, writes)).toMatchObject(refusedEverything)
    expect(await worker.forChannel(channelId, readPayments)).toContainEqual({
      invoice: 'in_test_stored',
    })
  })
})
