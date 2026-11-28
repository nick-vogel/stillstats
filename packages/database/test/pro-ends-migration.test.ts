import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
// The product's read of a channel's purge date. The entitlements package depends on this one, so
// the test reaches it by path, as the web app's tests reach the API's.
import { entitlementOf } from '../../entitlements/src/entitlements.ts'
import { openWorkerDatabase } from '../src/open.ts'
import { type MigrationDatabase, migrationDatabase, noJobs } from './migration-database.ts'

// stillstats#19: migration 0040 moves each subscription's purge date onto its channel's pro_ends
// row, on a database that 0039 left with row-level security forced on every table.

const clock = () => new Date('2027-01-01T12:00:00.000Z')
const purgeAfter = new Date('2027-01-16T12:00:00.000Z')

const channels = { ended: randomUUID(), active: randomUUID(), purged: randomUUID() }

describe('migration 0040 under forced row-level security, as staging and production run it', () => {
  let database: MigrationDatabase

  beforeAll(async () => {
    database = await migrationDatabase('pro_ends_migration', '0039_subscription_turned_paid')

    // Setup only: the rows 0039's release left, written past the policies.
    await database.asAdmin(async (setup) => {
      // Each channel has an owner, so migration 0041, which the migrate step runs on, moves its
      // subscription onto the owner and keeps its Entitlement.
      for (const id of Object.values(channels)) {
        await setup.query('insert into channels (id, youtube_channel_id) values ($1, $2)', [
          id,
          `UC${id}`,
        ])
        await setup.query('insert into users (id, name, email) values ($1, $1, $2)', [
          `owner-${id}`,
          `owner-${id}@example.com`,
        ])
        await setup.query(
          "insert into memberships (user_id, channel_id, role) values ($1, $2, 'owner')",
          [`owner-${id}`, id],
        )
      }
      const subscription = `insert into subscriptions (channel_id, stripe_customer_id,
        stripe_subscription_id, status, purge_after, updated_at) values ($1, $2, $3, $4, $5, $6)`
      const at = new Date('2026-12-17T12:00:00.000Z')
      await setup.query(subscription, [
        channels.ended,
        'cus_test_a',
        'sub_test_a',
        'canceled',
        purgeAfter,
        at,
      ])
      await setup.query(subscription, [
        channels.active,
        'cus_test_b',
        'sub_test_b',
        'active',
        null,
        at,
      ])
      await setup.query(subscription, [
        channels.purged,
        'cus_test_c',
        'sub_test_c',
        'canceled',
        null,
        at,
      ])
    })
  }, 60_000)

  afterAll(async () => {
    await database?.drop()
  })

  test("moves each subscription's purge date onto its channel, so the channel keeps it without the subscription's", async () => {
    await database.migrateOn()
    // What the remove release does to the subscription's copy.
    await database.asAdmin((setup) => setup.query('update subscriptions set purge_after = null'))

    await database.asApp(async (app) => {
      const worker = await openWorkerDatabase(app, { jobs: noJobs, clock })
      const entitlement = (channelId: string) =>
        worker.forChannel(channelId, (scope) => entitlementOf(scope, channelId))

      expect(await entitlement(channels.ended)).toEqual({ tier: 'free', purgeDate: purgeAfter })
      expect(await entitlement(channels.active)).toEqual({ tier: 'paid', purgeDate: null })
      expect(await entitlement(channels.purged)).toEqual({ tier: 'free', purgeDate: null })
    })
  }, 60_000)
})
