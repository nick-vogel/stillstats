import type pg from 'pg'
import { describe, expect } from 'vitest'
import { test } from './harness.ts'

interface ChannelTable {
  table: string
  forced: boolean
  cascades: boolean
  policyRoles: string[]
}

// These hold a channel id with no foreign key. A deletion request outlives its channel, and
// completing the request clears its id; the retention engine's tests prove the clearing. A consent
// state belongs to its user and lives ten minutes; the revenue consent tests prove it changes
// nothing on a channel the user no longer holds. A subscription cancellation is written by its
// channel's deletion and outlives it until Stripe accepts it; the retention engine's tests prove
// it is deleted then.
const outlivesItsChannel = ['deletion_requests', 'consent_states', 'subscription_cancellations']

// These read the catalog, so they prove a policy exists for each role, not which rows it admits.
// The predicates themselves are proven by the row tests in scopes.test.ts.
async function channelTables(pool: pg.Pool): Promise<ChannelTable[]> {
  const { rows } = await pool.query<ChannelTable>(
    `
    select
      c.relname as table,
      c.relforcerowsecurity as forced,
      exists (
        select 1 from pg_constraint k
        where k.conrelid = c.oid and k.contype = 'f' and k.confrelid = 'channels'::regclass
          and k.conkey = array[a.attnum] and k.confdeltype = 'c'
      ) as cascades,
      array(
        select distinct r::text
        from pg_policies p, unnest(p.roles) r
        where p.schemaname = n.nspname and p.tablename = c.relname
        order by r::text
      ) as "policyRoles"
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'channel_id' and not a.attisdropped
    where c.relkind in ('r', 'p') and n.nspname = 'public' and c.relname <> all($1)
    order by c.relname`,
    [outlivesItsChannel],
  )
  expect(rows.map((row) => row.table)).toEqual(
    expect.arrayContaining(['fixture_notes', 'memberships']),
  )
  return rows
}

describe('tables with a channel id', () => {
  test('every one cascades from channels', async ({ pool }) => {
    const rows = await channelTables(pool)

    expect(rows.filter((row) => !row.cascades).map((row) => row.table)).toEqual([])
  })

  test('every one forces row-level security', async ({ pool }) => {
    const rows = await channelTables(pool)

    expect(rows.filter((row) => !row.forced).map((row) => row.table)).toEqual([])
  })

  test('every one has policies for the web and worker roles, only memberships for the claim role, only the connection roster tables for the roster role, only subscriptions, subscription payments, pro ends, pro picks and memberships for the billing role, only pro picks and memberships for the pro state role, only pro ends, pro picks and memberships for the pro pick role, and only pro ends, pro picks and memberships for the pro grant role', async ({
    pool,
  }) => {
    const rows = await channelTables(pool)
    const billingTables = ['subscriptions', 'subscription_payments', 'pro_ends']
    expect(rows.map((row) => row.table)).toEqual(
      expect.arrayContaining([...billingTables, 'pro_picks']),
    )

    const expected = (table: string) => {
      if (table === 'memberships') {
        return 'app_billing,app_claim,app_pro_grant,app_pro_pick,app_pro_state,app_web,app_worker'
      }
      if (table === 'pro_picks') {
        return 'app_billing,app_pro_grant,app_pro_pick,app_pro_state,app_web,app_worker'
      }
      if (table === 'pro_ends') return 'app_billing,app_pro_grant,app_pro_pick,app_web,app_worker'
      if (billingTables.includes(table)) return 'app_billing,app_web,app_worker'
      if (['connections', 'connection_identifiers'].includes(table)) {
        return 'app_roster,app_web,app_worker'
      }
      return 'app_web,app_worker'
    }
    expect(rows.filter((row) => row.policyRoles.join() !== expected(row.table))).toEqual([])
  })
})
