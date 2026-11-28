import { sql } from 'drizzle-orm'
import {
  index,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import {
  billingRole,
  claimPolicy,
  inScope,
  isScopeUser,
  proPickRole,
  proStateRole,
  userChannelIds,
  webPolicy,
  workerPolicy,
} from './access.ts'
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
    // Only record_user_subscription runs as app_billing: a turn to paid fills the user's free
    // slots with their owned channels in the order they were connected.
    pgPolicy('memberships_billing', {
      for: 'select',
      to: billingRole,
      using: inScope('anonymous'),
    }),
    // Only pro_state runs as app_pro_state: a pick counts while its user still owns its channel.
    pgPolicy('memberships_pro_state', {
      for: 'select',
      to: proStateRole,
      using: sql`(${inScope('user')} or ${inScope('channel')})`,
    }),
    // Only pick_pro_channel and unpick_pro_channel run as app_pro_pick: a pick or an unpick
    // checks the scope user holds and owns the channel.
    pgPolicy('memberships_pro_pick', {
      for: 'select',
      to: proPickRole,
      using: inScope('user', isScopeUser(t.userId)),
    }),
  ],
)
