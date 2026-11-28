import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
// The product's read of a channel's Entitlement, reached by path as pro-ends-migration.test.ts
// explains.
import { entitlementOf } from '../../entitlements/src/entitlements.ts'
import { openWebDatabase, openWorkerDatabase } from '../src/open.ts'
import { proPicks, userSubscriptionPayments, userSubscriptions } from '../src/schema.ts'
import { type MigrationDatabase, migrationDatabase, noJobs } from './migration-database.ts'

// stillstats#20: migration 0041 copies each channel subscription onto its owner, with quantity 1
// and its channel picked, on a database that 0040 left with row-level security forced on every
// table. Without the copy's NO FORCE, it reads no row and copies nothing, with no error.

const clock = () => new Date('2027-01-01T12:00:00.000Z')

const owners = { single: 'owner-single', double: 'owner-double' }
const channels = {
  single: randomUUID(),
  doublePaid: randomUUID(),
  doubleEnded: randomUUID(),
  ownerless: randomUUID(),
}

describe('migration 0041 under forced row-level security, as staging and production run it', () => {
  let database: MigrationDatabase

  beforeAll(async () => {
    database = await migrationDatabase('user_subscriptions_migration', '0040_pro_ends')

    // Setup only: the rows 0040's release left, written past the policies.
    await database.asAdmin(async (setup) => {
      for (const id of Object.values(channels)) {
        await setup.query('insert into channels (id, youtube_channel_id) values ($1, $2)', [
          id,
          `UC${id}`,
        ])
      }
      for (const id of Object.values(owners)) {
        await setup.query('insert into users (id, name, email) values ($1, $1, $2)', [
          id,
          `${id}@example.com`,
        ])
      }
      const owns = "insert into memberships (user_id, channel_id, role) values ($1, $2, 'owner')"
      await setup.query(owns, [owners.single, channels.single])
      await setup.query(owns, [owners.double, channels.doublePaid])
      await setup.query(owns, [owners.double, channels.doubleEnded])

      const subscription = `insert into subscriptions (channel_id, stripe_customer_id,
        stripe_subscription_id, plan, status, updated_at) values ($1, $2, $3, 'monthly', $4, $5)`
      await setup.query(subscription, [
        channels.single,
        'cus_test_single',
        'sub_test_single',
        'active',
        new Date('2026-12-01T12:00:00.000Z'),
      ])
      // The paid one is the older: the copy keeps a paid one first.
      await setup.query(subscription, [
        channels.doublePaid,
        'cus_test_double',
        'sub_test_double_paid',
        'active',
        new Date('2026-12-02T12:00:00.000Z'),
      ])
      await setup.query(subscription, [
        channels.doubleEnded,
        'cus_test_double',
        'sub_test_double_ended',
        'canceled',
        new Date('2026-12-10T12:00:00.000Z'),
      ])
      await setup.query(
        "insert into pro_ends (channel_id, ended_at, purge_after) values ($1, '2026-12-10T12:00:00Z', '2027-01-09T12:00:00Z')",
        [channels.doubleEnded],
      )
      await setup.query(subscription, [
        channels.ownerless,
        'cus_test_ownerless',
        'sub_test_ownerless',
        'active',
        new Date('2026-12-03T12:00:00.000Z'),
      ])
      await setup.query(
        'insert into subscription_payments (stripe_invoice_id, channel_id) values ($1, $2)',
        ['in_test_single', channels.single],
      )
    })

    await database.migrateOn()
  }, 60_000)

  afterAll(async () => {
    await database?.drop()
  })

  test("each owner's channels read as paid, and a channel with no owner is not copied", async () => {
    await database.asApp(async (app) => {
      const worker = await openWorkerDatabase(app, { jobs: noJobs, clock })
      const entitlement = (channelId: string) =>
        worker.forChannel(channelId, (scope) => entitlementOf(scope, channelId))

      expect(await entitlement(channels.single)).toEqual({ tier: 'paid', purgeDate: null })
      expect(await entitlement(channels.doublePaid)).toEqual({ tier: 'paid', purgeDate: null })
      expect(await entitlement(channels.doubleEnded)).toEqual({ tier: 'paid', purgeDate: null })
      expect(await entitlement(channels.ownerless)).toEqual({ tier: 'free', purgeDate: null })
    })
  }, 60_000)

  test('each owner holds one subscription of quantity 1 with its channels picked, the paid one of two kept, and its paid invoices', async () => {
    await database.asApp(async (app) => {
      const web = await openWebDatabase(app, { jobs: noJobs, clock })
      const accountOf = (userId: string) =>
        web.asUser(userId, async (scope) => ({
          subscriptions: await scope.sql
            .select({
              subscription: userSubscriptions.stripeSubscriptionId,
              status: userSubscriptions.status,
              quantity: userSubscriptions.quantity,
            })
            .from(userSubscriptions),
          picks: (await scope.sql.select({ channelId: proPicks.channelId }).from(proPicks))
            .map(({ channelId }) => channelId)
            .sort(),
          payments: await scope.sql
            .select({ invoice: userSubscriptionPayments.stripeInvoiceId })
            .from(userSubscriptionPayments),
          paid: (await entitlementOf(scope, channels.doubleEnded)).tier,
        }))

      expect(await accountOf(owners.single)).toEqual({
        subscriptions: [{ subscription: 'sub_test_single', status: 'active', quantity: 1 }],
        picks: [channels.single],
        payments: [{ invoice: 'in_test_single' }],
        paid: 'free',
      })
      expect(await accountOf(owners.double)).toEqual({
        subscriptions: [{ subscription: 'sub_test_double_paid', status: 'active', quantity: 1 }],
        picks: [channels.doublePaid, channels.doubleEnded].sort(),
        payments: [],
        paid: 'paid',
      })
    })
  }, 60_000)
})
