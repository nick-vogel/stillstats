import { type SQL, type SQLWrapper, sql } from 'drizzle-orm'
import { type PgPolicy, type PgRole, pgPolicy, pgRole } from 'drizzle-orm/pg-core'
import type { ScopeKind } from './scopes.ts'

// Provisioned outside the migrations with LOGIN and CREATEROLE, because it is the role that runs them.
export const migrationRole = pgRole('app_migrator').existing()
export const webRole = pgRole('app_web')
export const workerRole = pgRole('app_worker')
// Owns the claim_channel function and nothing else, and no login role is a member of it. A claim
// has to see memberships the user does not hold, which no policy of app_web admits.
export const claimRole = pgRole('app_claim')
// Owns the connection_roster function and nothing else, and no login role is a member of it. It
// reads the roster columns of the connections, which the system scope must not read as app_worker.
export const rosterRole = pgRole('app_roster')
// Owns the feedback_count_today function and nothing else, and no login role is a member of it. It
// counts a user's own feedback messages, which the user scope may send and must not read.
export const feedbackCountRole = pgRole('app_feedback_count')

// Owns the record_user_subscription and record_user_subscription_payment functions, and the
// retired channel ones that raise, and nothing else, and no login role is a member of it. Stripe's
// webhook writes a user's subscription, its channel picks and its paid invoices in the anonymous
// scope, which reads and writes no row of any of them itself.
export const billingRole = pgRole('app_billing')

// Owns the pro_state function and nothing else, and no login role is a member of it. A channel's
// Pro state is the rank of its pick inside its owner's capacity, which needs the owner's
// subscription and other picks, which neither a member's user scope nor a channel scope may read.
export const proStateRole = pgRole('app_pro_state')

// Owns the pick_pro_channel and unpick_pro_channel functions and nothing else, and no login role is
// a member of it. A pick is checked against the user's free slots under a lock on their
// subscription row, which the user scope reads and may not lock as app_web, and it writes the
// user's picks and their owned channels' pro_ends rows, which the user scope writes none of itself.
export const proPickRole = pgRole('app_pro_pick')

export type SettingName = 'app.scope' | 'app.user_id' | 'app.channel_id' | 'app.now'

// A setting never set reads as null, but one set by an earlier transaction on the same connection
// reads as '', so both have to become null for an unset setting to admit no row.
export function setting(name: SettingName): SQL {
  return sql.raw(`nullif(current_setting('${name}', true), '')`)
}

/** The clock reading the scope pinned at entry, so a policy judges a row's age as the code does. */
export function scopeNow(): SQL {
  return sql`${setting('app.now')}::timestamptz`
}

export function isScopeUser(userId: SQLWrapper): SQL {
  return sql`${userId} = ${setting('app.user_id')}`
}

export const userChannelIds = sql`(select m.channel_id from memberships m where m.user_id = ${setting('app.user_id')})`

/** The channels the scope's user owns, as their memberships admit them. */
export const userOwnedChannelIds = sql`(select m.channel_id from memberships m where m.user_id = ${setting('app.user_id')} and m.role = 'owner')`

export function inScope(scope: ScopeKind, condition?: SQL): SQL {
  const scoped = sql`${setting('app.scope')} = '${sql.raw(scope)}'`
  return condition ? sql`(${scoped} and ${condition})` : sql`(${scoped})`
}

/** Admits every row to `app_web` in the anonymous scope, and no row to any other scope. */
export function anonymousPolicy(table: string): PgPolicy {
  const admitted = inScope('anonymous')
  return pgPolicy(`${table}_anonymous`, { to: webRole, using: admitted, withCheck: admitted })
}

type PolicyCommand = 'select' | 'insert' | 'delete' | 'all'

/** One policy for one command, with the clause Postgres takes for that command. */
function commandPolicy(name: string, command: PolicyCommand, to: PgRole, admitted: SQL): PgPolicy {
  // Postgres takes only WITH CHECK on an INSERT policy, and rejects it on a SELECT or DELETE one.
  if (command === 'insert') return pgPolicy(name, { for: command, to, withCheck: admitted })
  const config = { for: command, to, using: admitted }
  return pgPolicy(name, command === 'all' ? { ...config, withCheck: admitted } : config)
}

export function webPolicy(
  table: string,
  command: PolicyCommand,
  condition: SQL,
  name = `${table}_web`,
): PgPolicy {
  return commandPolicy(name, command, webRole, inScope('user', condition))
}

/**
 * Admits to `app_web` in a user scope the rows of the scope's user, to read and delete only: a
 * user deletion removes its own sign-in rows, and only sign-in, in the anonymous scope, writes them.
 */
export function ownRowsPolicies(table: string, userId: SQLWrapper): PgPolicy[] {
  return (['select', 'delete'] as const).map((command) =>
    webPolicy(table, command, isScopeUser(userId), `${table}_web_${command}`),
  )
}

/**
 * Admits every row to `app_claim` in a user scope. Only claim_channel runs as `app_claim`, and the
 * role holds SELECT and INSERT only, so the function is the whole of what the policy allows.
 */
export function claimPolicy(table: string): PgPolicy {
  const admitted = inScope('user')
  return pgPolicy(`${table}_claim`, { to: claimRole, using: admitted, withCheck: admitted })
}

/**
 * Admits every row to `app_roster` in the system scope, to read only. Only connection_roster runs
 * as `app_roster`, and the role holds SELECT on the roster columns only.
 */
export function rosterPolicy(table: string): PgPolicy {
  return pgPolicy(`${table}_roster`, { for: 'select', to: rosterRole, using: inScope('system') })
}

/**
 * Admits every row to `app_web` in a user scope and to `app_worker` in a channel scope, the two
 * scopes a YouTube gateway read runs in, for a table that holds no channel's data.
 */
export function gatewayReadPolicies(table: string): PgPolicy[] {
  const asUser = inScope('user')
  const forChannel = inScope('channel')
  return [
    pgPolicy(`${table}_web`, { to: webRole, using: asUser, withCheck: asUser }),
    pgPolicy(`${table}_worker`, { to: workerRole, using: forChannel, withCheck: forChannel }),
  ]
}

/**
 * Admits every row to `app_web` in the admin scope, to read and to update, and no row to any other
 * scope. A policy admits rows, not columns: the table's column grant is what holds the update to
 * the columns the admin scope may change.
 */
export function adminPolicies(table: string): PgPolicy[] {
  const admitted = inScope('admin')
  return [
    pgPolicy(`${table}_admin_select`, { for: 'select', to: webRole, using: admitted }),
    pgPolicy(`${table}_admin_update`, {
      for: 'update',
      to: webRole,
      using: admitted,
      withCheck: admitted,
    }),
  ]
}

export function isScopeChannel(channelId: SQLWrapper): SQL {
  return sql`${channelId} = ${setting('app.channel_id')}::uuid`
}

export function workerPolicy(table: string, channelId: SQLWrapper): PgPolicy {
  const admitted = inScope('channel', isScopeChannel(channelId))
  return pgPolicy(`${table}_worker`, { to: workerRole, using: admitted, withCheck: admitted })
}

/**
 * Admits rows to `app_worker` in the scope given, for one command, on a table no channel owns, or
 * on one a channel owns when the condition limits the command to rows no channel needs.
 */
export function workerScopePolicy(
  table: string,
  scope: 'channel' | 'system',
  command: 'select' | 'insert' | 'delete',
  condition?: SQL,
): PgPolicy {
  const name = `${table}_worker_${scope}_${command}`
  return commandPolicy(name, command, workerRole, inScope(scope, condition))
}
