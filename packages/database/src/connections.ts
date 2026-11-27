import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import {
  inScope,
  isScopeUser,
  rosterPolicy,
  webPolicy,
  webRole,
  workerScopePolicy,
} from './access.ts'
import { users } from './auth.ts'
import { channelOwned } from './channel-owned.ts'
import type { Scoped } from './scopes.ts'

export interface GrantedScope {
  name: string
  /** ISO 8601. */
  grantedAt: string
}

/**
 * The token vault's one connection per channel. Both tokens are AES-256-GCM ciphertexts under the
 * key `key_version` names; only the token vault reads or writes this table.
 */
export const connections = channelOwned(
  'connections',
  {
    refreshToken: text('refresh_token').notNull(),
    accessToken: text('access_token').notNull(),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }).notNull(),
    keyVersion: integer('key_version').notNull(),
    scopes: jsonb('scopes').$type<GrantedScope[]>().notNull(),
    status: text('status', { enum: ['active', 'revoked'] }).notNull(),
    connectedAt: timestamp('connected_at', { withTimezone: true }).notNull(),
  },
  { onePerChannel: true, extraConfig: () => [rosterPolicy('connections')] },
)

/**
 * What a Google security event names a grant by: the Google subject, or a refresh token by its
 * first 16 characters or by its double SHA-512 hash, as Google's RISC page lists them.
 */
export const googleIdentifierKinds = [
  'subject',
  'refresh_token_prefix',
  'refresh_token_hash',
] as const

export type GoogleIdentifierKind = (typeof googleIdentifierKinds)[number]

/**
 * A keyed HMAC of each identifier of a connection's grant, never the identifier itself. The
 * system scope finds the channels a security event names here, so it never reads a connection.
 */
export const connectionIdentifiers = channelOwned(
  'connection_identifiers',
  {
    kind: text('kind', { enum: googleIdentifierKinds }).notNull(),
    hmac: text('hmac').notNull(),
  },
  {
    extraConfig: (t) => [
      unique('connection_identifiers_channel_id_kind_key').on(t.channelId, t.kind),
      index('connection_identifiers_kind_hmac_idx').on(t.kind, t.hmac),
      workerScopePolicy('connection_identifiers', 'system', 'select'),
      rosterPolicy('connection_identifiers'),
    ],
  },
)

/** One active connection, as the daily roster job reads it. */
export interface RosterEntry {
  channelId: string
  subjectHmac: string | null
  connectedAt: Date
}

/**
 * The active connections, through the connection_roster function (migration 0011): the channel id,
 * the HMAC of the Google subject and the connection time, and never a token.
 */
export async function connectionRoster(tx: Scoped<'system'>): Promise<RosterEntry[]> {
  const result = await tx.sql.execute<{
    channelId: string
    subjectHmac: string | null
    connectedAt: string
  }>(sql`select channel_id as "channelId", subject_hmac as "subjectHmac",
    connected_at as "connectedAt" from connection_roster()`)
  return result.rows.map((row) => ({ ...row, connectedAt: new Date(row.connectedAt) }))
}

/**
 * A verified Google security event that revokes a grant, from the receiver until its job has
 * found the channels it names. The receiver, signed in by no one, only inserts; the system scope
 * reads it and then deletes it, as Google's RISC terms ask of received events.
 */
export const securityEvents = pgTable(
  'security_events',
  {
    id: uuid('id').primaryKey(),
    kind: text('kind', { enum: googleIdentifierKinds }).notNull(),
    hmac: text('hmac').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  },
  () => [
    pgPolicy('security_events_anonymous_insert', {
      for: 'insert',
      to: webRole,
      withCheck: inScope('anonymous'),
    }),
    workerScopePolicy('security_events', 'system', 'select'),
    workerScopePolicy('security_events', 'system', 'delete'),
  ],
)

/**
 * The state of a consent between its start and Google's callback: a connect, with the screen the
 * web app lands on after it when that is not its first, or a revenue consent for one channel. It
 * belongs to the user who started it, so a callback completes only the consent
 * of the signed-in user.
 *
 * The channel id has no foreign key, so the table is not channel-owned: the row belongs to its
 * user, lives ten minutes, and the revenue consent checks the user's membership again when it
 * completes. A channel deleted in between leaves the row to expire.
 */
export const consentStates = pgTable(
  'consent_states',
  {
    state: text('state').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text('purpose', { enum: ['connect', 'revenue'] }).notNull(),
    channelId: uuid('channel_id'),
    /**
     * Where the web app lands once a connect completes or is refused, when not on its first
     * screen: a name from a fixed set, never an address (creator-analytics#907).
     */
    landing: text('landing', { enum: ['upgrade'] }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('consent_states_user_id_idx').on(t.userId),
    check(
      'consent_states_revenue_names_channel',
      sql`(${t.purpose} = 'revenue') = (${t.channelId} is not null)`,
    ),
    check(
      'consent_states_landing',
      sql`${t.landing} is null or (${t.landing} = 'upgrade' and ${t.purpose} = 'connect')`,
    ),
    webPolicy('consent_states', 'all', isScopeUser(t.userId)),
  ],
)
