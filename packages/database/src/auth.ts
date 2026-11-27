import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { anonymousPolicy, ownRowsPolicies } from './access.ts'

// Better Auth's core tables, as Better Auth 1.7 defines them, under plural names. They hold no
// channel data, so they sit outside the channel policies. The anonymous scope, which serves
// sign-in, reads and writes them. A user scope reads and deletes its own users, sessions and
// accounts rows, for a user deletion. Verifications hold sign-in state keyed by an identifier,
// not a user, so they stay with the anonymous scope. The worker scopes read none of them.

function timestamps() {
  return {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  }
}

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    ...timestamps(),
  },
  (t) => [anonymousPolicy('users'), ...ownRowsPolicies('users', t.id)],
)

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps(),
  },
  (t) => [
    index('sessions_user_id_idx').on(t.userId),
    anonymousPolicy('sessions'),
    ...ownRowsPolicies('sessions', t.userId),
  ],
)

// Better Auth's word for a user's link to a sign-in provider. It holds the sign-in grant only,
// never a connection: the YouTube tokens live in the token vault.
export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    ...timestamps(),
  },
  (t) => [
    index('accounts_user_id_idx').on(t.userId),
    anonymousPolicy('accounts'),
    ...ownRowsPolicies('accounts', t.userId),
  ],
)

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier), anonymousPolicy('verifications')],
)
