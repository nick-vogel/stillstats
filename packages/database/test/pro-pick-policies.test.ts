import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { describe, expect, test } from 'vitest'
import { databaseUrls } from './harness.ts'

// stillstats#21: pick_pro_channel and unpick_pro_channel run as app_pro_pick, whose policies on
// memberships, user_subscriptions, pro_picks and pro_ends admit only the user scope's own rows,
// and the pro_ends rows and earlier owners' picks of the channels the scope user owns. The
// functions filter by the scope user themselves, so no call of theirs shows a policy that admits
// too much. app_pro_pick has no login member, so the harness's `app` role cannot reach it: this
// file seeds rows past the policies on the admin connection, then SET ROLE app_pro_pick, the role
// the functions run as, and reads and writes under its policies alone, in one transaction that
// rolls back.
//
// Limits: the reads here run as app_pro_pick from the admin's session, not through the two
// functions, so they show what the policies admit and say nothing of what the functions do with
// it; pro-picks.test.ts covers the functions through the user scope.

const owner = `pro-pick-policy-owner-${randomUUID()}`
const other = `pro-pick-policy-other-${randomUUID()}`
const channel = {
  /** The owner's, picked by the owner, with a pro_ends row. */
  picked: randomUUID(),
  /** The owner's, with the pick of an earlier owner, the other user. */
  takenOver: randomUUID(),
  /** The other user's, which the owner holds as a member, with a pro_ends row. */
  held: randomUUID(),
  /** The other user's, picked by the other user, with a pro_ends row. */
  others: randomUUID(),
  /** The other user's, with no pick and no pro_ends row, which the owner does not hold. */
  stranger: randomUUID(),
}
const seeded = Object.values(channel)

async function seed(client: pg.PoolClient) {
  for (const id of [owner, other]) {
    await client.query('insert into users (id, name, email) values ($1, $1, $2)', [
      id,
      `${id}@example.com`,
    ])
    await client.query(
      `insert into user_subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan,
        status, quantity, updated_at) values ($1, $2, $3, 'monthly', 'active', 1, now())`,
      [id, `cus_${id}`, `sub_${id}`],
    )
  }
  for (const id of seeded) {
    await client.query('insert into channels (id, youtube_channel_id) values ($1, $2)', [
      id,
      `UC${id}`,
    ])
  }
  const membership = 'insert into memberships (user_id, channel_id, role) values ($1, $2, $3)'
  await client.query(membership, [owner, channel.picked, 'owner'])
  await client.query(membership, [owner, channel.takenOver, 'owner'])
  await client.query(membership, [other, channel.held, 'owner'])
  await client.query(membership, [owner, channel.held, 'member'])
  await client.query(membership, [other, channel.others, 'owner'])
  await client.query(membership, [other, channel.stranger, 'owner'])
  const pick = 'insert into pro_picks (channel_id, user_id, picked_at) values ($1, $2, now())'
  await client.query(pick, [channel.picked, owner])
  await client.query(pick, [channel.takenOver, other])
  await client.query(pick, [channel.others, other])
  for (const id of [channel.picked, channel.held, channel.others]) {
    await client.query(
      "insert into pro_ends (channel_id, ended_at, purge_after) values ($1, now(), now() + interval '30 days')",
      [id],
    )
  }
}

/** Runs `work` as app_pro_pick in the scope given, on seeded rows, and rolls everything back. */
async function asProPick<T>(
  scope: { kind: string; userId: string },
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const pool = new pg.Pool({ connectionString: databaseUrls().admin })
  const client = await pool.connect()
  try {
    await client.query('begin')
    await seed(client)
    await client.query('set local role app_pro_pick')
    await client.query(
      "select set_config('app.scope', $1, true), set_config('app.user_id', $2, true)",
      [scope.kind, scope.userId],
    )
    return await work(client)
  } finally {
    await client.query('rollback')
    client.release()
    await pool.end()
  }
}

/** The seeded rows of a table, each as `row` reads it, sorted. */
async function readOf(client: pg.PoolClient, row: string, from: string, ids: string[]) {
  const { rows } = await client.query<{ row: string }>(
    `select ${row} as row from ${from} = any($1) order by 1`,
    [ids],
  )
  return rows.map((each) => each.row)
}

const readMemberships = (client: pg.PoolClient) =>
  readOf(client, "channel_id || ' ' || user_id", 'memberships where channel_id', seeded)
const readSubscriptions = (client: pg.PoolClient) =>
  readOf(client, 'user_id', 'user_subscriptions where user_id', [owner, other])
const readPicks = (client: pg.PoolClient) =>
  readOf(client, "channel_id || ' ' || user_id", 'pro_picks where channel_id', seeded)
const readEnds = (client: pg.PoolClient) =>
  readOf(client, 'channel_id::text', 'pro_ends where channel_id', seeded)

/** The error a statement fails with, in a savepoint so the transaction goes on. */
async function refusalOf(client: pg.PoolClient, statement: string, values: unknown[]) {
  await client.query('savepoint attempt')
  try {
    await client.query(statement, values)
    return undefined
  } catch (error) {
    return (error as Error).message
  } finally {
    await client.query('rollback to savepoint attempt')
  }
}

const sorted = (rows: string[]) => [...rows].sort()

describe("app_pro_pick's policies, which the owner's pick and unpick run under (stillstats#21)", () => {
  test("the user scope reads only the user's memberships, subscription and picks, an earlier owner's pick of a channel they own, and the ends of the channels they own", async () => {
    const read = await asProPick({ kind: 'user', userId: owner }, async (client) => ({
      memberships: await readMemberships(client),
      subscriptions: await readSubscriptions(client),
      picks: await readPicks(client),
      ends: await readEnds(client),
    }))

    expect(read).toEqual({
      memberships: sorted([
        `${channel.picked} ${owner}`,
        `${channel.takenOver} ${owner}`,
        `${channel.held} ${owner}`,
      ]),
      subscriptions: [owner],
      picks: sorted([`${channel.picked} ${owner}`, `${channel.takenOver} ${other}`]),
      ends: [channel.picked],
    })
  })

  test("the user scope changes no other user's subscription, pick or end, and writes neither another user's pick nor the end of a channel it does not own", async () => {
    const changed = await asProPick({ kind: 'user', userId: owner }, async (client) => ({
      // No WHERE and no read of a stored value, so the update policy alone limits the rows, and
      // not the select policy too.
      subscriptions: (await client.query('update user_subscriptions set quantity = 1')).rowCount,
      picks: (
        await client.query('delete from pro_picks where channel_id = any($1::uuid[])', [seeded])
      ).rowCount,
      ends: (
        await client.query('delete from pro_ends where channel_id = any($1::uuid[])', [seeded])
      ).rowCount,
      pickOfHeld: await refusalOf(
        client,
        'insert into pro_picks (channel_id, user_id, picked_at) values ($1, $2, now())',
        [channel.held, other],
      ),
      pickOfStranger: await refusalOf(
        client,
        'insert into pro_picks (channel_id, user_id, picked_at) values ($1, $2, now())',
        [channel.stranger, other],
      ),
      endOfStranger: await refusalOf(
        client,
        'insert into pro_ends (channel_id, ended_at) values ($1, now())',
        [channel.stranger],
      ),
    }))

    expect(changed).toEqual({
      subscriptions: 1,
      // The owner's own pick, and the earlier owner's pick of a channel the owner now owns.
      picks: 2,
      ends: 1,
      pickOfHeld: 'new row violates row-level security policy for table "pro_picks"',
      pickOfStranger: 'new row violates row-level security policy for table "pro_picks"',
      endOfStranger: 'new row violates row-level security policy for table "pro_ends"',
    })
  })

  test('any other scope reads nothing', async () => {
    for (const kind of ['anonymous', 'admin', 'channel']) {
      const read = await asProPick({ kind, userId: owner }, async (client) => [
        ...(await readMemberships(client)),
        ...(await readSubscriptions(client)),
        ...(await readPicks(client)),
        ...(await readEnds(client)),
      ])

      expect({ kind, read }).toEqual({ kind, read: [] })
    }
  })
})
