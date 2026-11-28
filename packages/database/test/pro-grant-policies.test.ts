import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { describe, expect, test } from 'vitest'
import { databaseUrls } from './harness.ts'

// stillstats#24: the Pro grant functions run as app_pro_grant, whose policies admit every row of
// users, memberships, user_subscriptions, pro_picks, pro_ends and pro_grants in the admin and
// system scopes and none in any other. The roles that count a capacity read a user's grants
// under their own policies on pro_grants: app_pro_state in the user and channel scopes, app_billing
// in the anonymous scope, app_pro_pick the scope user's own, and app_web the user scope's own.
// app_pro_grant and the definer roles have no login member, so the harness's `app` role cannot
// reach them: this file seeds rows past the policies on the admin connection, then SET ROLE to the
// role under test, and reads and writes under its policies alone, in one transaction that rolls
// back.
//
// Limits: the reads here run from the admin's session, not through the functions, so they show
// what the policies admit and say nothing of what the functions do with it; pro-grants.test.ts
// covers the functions through the scopes.

const grantee = `pro-grant-policy-grantee-${randomUUID()}`
const other = `pro-grant-policy-other-${randomUUID()}`
const channel = { grantees: randomUUID(), others: randomUUID() }
const grant = { grantees: randomUUID(), others: randomUUID() }
const seededUsers = [grantee, other]
const seededChannels = Object.values(channel)
const seededGrants = Object.values(grant)

async function seed(client: pg.PoolClient) {
  for (const [id, channelId, grantId] of [
    [grantee, channel.grantees, grant.grantees],
    [other, channel.others, grant.others],
  ] as const) {
    await client.query('insert into users (id, name, email) values ($1, $1, $2)', [
      id,
      `${id}@example.com`,
    ])
    await client.query(
      `insert into user_subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan,
        status, quantity, updated_at) values ($1, $2, $3, 'monthly', 'active', 1, now())`,
      [id, `cus_${id}`, `sub_${id}`],
    )
    await client.query('insert into channels (id, youtube_channel_id) values ($1, $2)', [
      channelId,
      `UC${channelId}`,
    ])
    await client.query(
      "insert into memberships (user_id, channel_id, role) values ($1, $2, 'owner')",
      [id, channelId],
    )
    await client.query(
      'insert into pro_picks (channel_id, user_id, picked_at) values ($1, $2, now())',
      [channelId, id],
    )
    await client.query(
      "insert into pro_ends (channel_id, ended_at, purge_after) values ($1, now(), now() + interval '30 days')",
      [channelId],
    )
    await client.query(
      'insert into pro_grants (id, user_id, blocks, created_at) values ($1, $2, 1, now())',
      [grantId, id],
    )
  }
}

type Role = 'app_pro_grant' | 'app_pro_state' | 'app_pro_pick' | 'app_billing' | 'app_web'

/** Runs `work` as the role in the scope given, on seeded rows, and rolls everything back. */
async function asRole<T>(
  role: Role,
  scope: { kind: string; userId?: string; channelId?: string },
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const pool = new pg.Pool({ connectionString: databaseUrls().admin })
  const client = await pool.connect()
  try {
    await client.query('begin')
    await seed(client)
    await client.query(`set local role ${role}`)
    await client.query(
      "select set_config('app.scope', $1, true), set_config('app.user_id', $2, true), set_config('app.channel_id', $3, true)",
      [scope.kind, scope.userId ?? '', scope.channelId ?? ''],
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

const readGrants = (client: pg.PoolClient) =>
  readOf(client, 'user_id', 'pro_grants where id', seededGrants)

/** The error a statement fails with, in a savepoint so the transaction goes on. */
async function refusalOf(client: pg.PoolClient, statement: string, values: unknown[] = []) {
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

describe("app_pro_grant's policies, which the grant functions run under (stillstats#24)", () => {
  test('the admin and system scopes read every seeded user, membership, subscription, pick, end and grant', async () => {
    for (const kind of ['admin', 'system']) {
      const read = await asRole('app_pro_grant', { kind }, async (client) => ({
        users: await readOf(client, 'email', 'users where id', seededUsers),
        memberships: await readOf(
          client,
          'user_id',
          'memberships where channel_id',
          seededChannels,
        ),
        subscriptions: await readOf(
          client,
          'user_id',
          'user_subscriptions where user_id',
          seededUsers,
        ),
        picks: await readOf(client, 'user_id', 'pro_picks where channel_id', seededChannels),
        ends: await readOf(client, 'channel_id::text', 'pro_ends where channel_id', seededChannels),
        grants: await readGrants(client),
      }))

      expect({ kind, read }).toEqual({
        kind,
        read: {
          users: sorted([`${grantee}@example.com`, `${other}@example.com`]),
          memberships: sorted(seededUsers),
          subscriptions: sorted(seededUsers),
          picks: sorted(seededUsers),
          ends: sorted(seededChannels),
          grants: sorted(seededUsers),
        },
      })
    }
  })

  test("it reads a user's ID and email and no other column", async () => {
    const refusal = await asRole('app_pro_grant', { kind: 'admin' }, (client) =>
      refusalOf(client, 'select name from users'),
    )

    expect(refusal).toBe('permission denied for table users')
  })

  test('any other scope reads nothing and changes no grant', async () => {
    for (const kind of ['user', 'anonymous', 'channel']) {
      const read = await asRole(
        'app_pro_grant',
        { kind, userId: grantee, channelId: channel.grantees },
        async (client) => ({
          rows: [
            ...(await readOf(client, 'email', 'users where id', seededUsers)),
            ...(await readOf(client, 'user_id', 'memberships where channel_id', seededChannels)),
            ...(await readOf(client, 'user_id', 'user_subscriptions where user_id', seededUsers)),
            ...(await readOf(client, 'user_id', 'pro_picks where channel_id', seededChannels)),
            ...(await readOf(
              client,
              'channel_id::text',
              'pro_ends where channel_id',
              seededChannels,
            )),
            ...(await readGrants(client)),
          ],
          deleted: (await client.query('delete from pro_grants')).rowCount,
          inserted: await refusalOf(
            client,
            'insert into pro_grants (user_id, blocks, created_at) values ($1, 1, now())',
            [grantee],
          ),
        }),
      )

      expect({ kind, read }).toEqual({
        kind,
        read: {
          rows: [],
          deleted: 0,
          inserted: 'new row violates row-level security policy for table "pro_grants"',
        },
      })
    }
  })
})

describe('the policies on pro_grants of the roles that count a capacity (stillstats#24)', () => {
  test('app_pro_state reads every grant in the user and channel scopes and none in any other', async () => {
    const reads: Record<string, string[]> = {}
    for (const kind of ['user', 'channel', 'anonymous', 'admin', 'system']) {
      reads[kind] = await asRole(
        'app_pro_state',
        { kind, userId: grantee, channelId: channel.grantees },
        readGrants,
      )
    }

    expect(reads).toEqual({
      user: sorted(seededUsers),
      channel: sorted(seededUsers),
      anonymous: [],
      admin: [],
      system: [],
    })
  })

  test('app_billing reads and locks every grant in the anonymous scope and none in any other', async () => {
    const reads: Record<string, unknown> = {}
    for (const kind of ['anonymous', 'user', 'admin', 'system']) {
      reads[kind] = await asRole('app_billing', { kind, userId: grantee }, async (client) => ({
        grants: await readGrants(client),
        locked: (await client.query('select 1 from pro_grants for update')).rowCount,
      }))
    }

    expect(reads).toEqual({
      anonymous: { grants: sorted(seededUsers), locked: 2 },
      user: { grants: [], locked: 0 },
      admin: { grants: [], locked: 0 },
      system: { grants: [], locked: 0 },
    })
  })

  test("app_pro_pick reads and locks only the user scope's own grant, and none in any other scope", async () => {
    const reads: Record<string, unknown> = {}
    for (const kind of ['user', 'anonymous', 'admin', 'channel']) {
      reads[kind] = await asRole(
        'app_pro_pick',
        { kind, userId: grantee, channelId: channel.grantees },
        async (client) => ({
          grants: await readGrants(client),
          locked: (await client.query('select 1 from pro_grants for update')).rowCount,
          deleted: await refusalOf(client, 'delete from pro_grants'),
        }),
      )
    }

    const deleteRefused = 'permission denied for table pro_grants'
    expect(reads).toEqual({
      user: { grants: [grantee], locked: 1, deleted: deleteRefused },
      anonymous: { grants: [], locked: 0, deleted: deleteRefused },
      admin: { grants: [], locked: 0, deleted: deleteRefused },
      channel: { grants: [], locked: 0, deleted: deleteRefused },
    })
  })

  test("app_web reads only the user scope's own grant and changes none, and reads none in any other scope", async () => {
    const reads: Record<string, unknown> = {}
    for (const kind of ['user', 'anonymous', 'admin']) {
      reads[kind] = await asRole('app_web', { kind, userId: grantee }, async (client) => ({
        grants: await readGrants(client),
        updated: (await client.query('update pro_grants set blocks = 9')).rowCount,
        deleted: (await client.query('delete from pro_grants')).rowCount,
      }))
    }

    expect(reads).toEqual({
      user: { grants: [grantee], updated: 0, deleted: 0 },
      anonymous: { grants: [], updated: 0, deleted: 0 },
      admin: { grants: [], updated: 0, deleted: 0 },
    })
  })
})
