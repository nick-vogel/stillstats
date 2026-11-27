import { sql } from 'drizzle-orm'
import { index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { claimPolicy, isScopeUser, userChannelIds, webPolicy, workerPolicy } from './access.ts'
import { users } from './auth.ts'

export function channelIdColumn() {
  return uuid('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' })
}

// The two tables that define access. The web role only reads them: the claim_channel function
// (migration 0004) is the one path that writes them, never a row a user inserts directly.
export const channels = pgTable(
  'channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    youtubeChannelId: text('youtube_channel_id').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    webPolicy('channels', 'select', sql`${t.id} in ${userChannelIds}`),
    workerPolicy('channels', t.id),
    claimPolicy('channels'),
  ],
)

export const memberships = pgTable(
  'memberships',
  {
    // No cascade: deleting a user row directly would leave channels with no membership that
    // nothing deletes. A user deletion ends the memberships first (#15).
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    channelId: channelIdColumn(),
    role: text('role', { enum: ['owner'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.channelId] }),
    index('memberships_channel_id_idx').on(t.channelId),
    uniqueIndex('memberships_one_owner_idx').on(t.channelId).where(sql`${t.role} = 'owner'`),
    // Not userChannelIds: that reads memberships, so a policy on memberships cannot use it.
    webPolicy('memberships', 'select', isScopeUser(t.userId)),
    // A user ends their own membership on a disconnect or a user deletion, and only their own.
    webPolicy('memberships', 'delete', isScopeUser(t.userId), 'memberships_web_delete'),
    workerPolicy('memberships', t.channelId),
    claimPolicy('memberships'),
  ],
)
