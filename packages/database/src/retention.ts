import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import {
  inScope,
  isScopeChannel,
  scopeNow,
  userChannelIds,
  webPolicy,
  workerPolicy,
  workerRole,
  workerScopePolicy,
} from './access.ts'

export const deletionReasons = ['user_deletion', 'in_app_revocation', 'google_revocation'] as const

export type DeletionReason = (typeof deletionReasons)[number]

/**
 * The retention window of the deletion log and of completed deletion requests: 24 months by the
 * scope's clock, so the proof outlives an audit cycle without becoming a permanent record (#1).
 * Subtracted in UTC, because a month interval on a timestamptz follows the session TimeZone and
 * would move the cut-off by an hour across a daylight saving change. A null time fails it.
 */
function completedOver24MonthsAgo(completedAt: AnyPgColumn) {
  return sql`${completedAt} < ((${scopeNow()} at time zone 'UTC') - interval '24 months') at time zone 'UTC'`
}

/**
 * One request to delete a channel, open until the deletion job completes it. The request outlives
 * its channel, so its channel id has no foreign key: completing the request clears it instead.
 * The request ends the channel's memberships itself, before the job counts the channel's rows, so
 * the deletion log adds `endedMemberships` to the job's own count of memberships.
 */
export const deletionRequests = pgTable(
  'deletion_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id'),
    reason: text('reason', { enum: deletionReasons }).notNull(),
    endedMemberships: integer('ended_memberships').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('deletion_requests_one_open_idx')
      .on(t.channelId)
      .where(sql`${t.completedAt} is null`),
    check(
      'deletion_requests_open_until_cleared',
      sql`(${t.completedAt} is null) = (${t.channelId} is not null)`,
    ),
    // A user requests a deletion of a channel they hold, and never completes one.
    webPolicy('deletion_requests', 'select', sql`${t.channelId} in ${userChannelIds}`),
    webPolicy(
      'deletion_requests',
      'insert',
      sql`${t.channelId} in ${userChannelIds}`,
      'deletion_requests_web_insert',
    ),
    workerPolicy('deletion_requests', t.channelId),
    // Completing the request clears its channel id, which no other policy's check admits.
    pgPolicy('deletion_requests_worker_complete', {
      for: 'update',
      to: workerRole,
      using: inScope('channel', isScopeChannel(t.channelId)),
      withCheck: inScope('channel', sql`${t.channelId} is null`),
    }),
    // A completed request keeps no channel data, and goes when the deletion log entry it produced
    // goes. An open request has no completion time, so it is never deleted.
    workerScopePolicy(
      'deletion_requests',
      'system',
      'delete',
      completedOver24MonthsAgo(t.completedAt),
    ),
  ],
)

/**
 * The proof that a channel was deleted, without the data it deleted: a keyed hash of the YouTube
 * channel id, never the id. The deletion job writes it in a channel scope and cannot read it back;
 * only the system scope reads it, for the operator's audit query, and deletes it at 24 months.
 */
export const deletionLog = pgTable(
  'deletion_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    youtubeChannelHmac: text('youtube_channel_hmac').notNull(),
    reason: text('reason', { enum: deletionReasons }).notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
    /**
     * The channel's rows in each channel-owned table, counted before the deletion, with the
     * memberships its request ended added to the memberships count.
     */
    rowCounts: jsonb('row_counts').$type<Record<string, number>>().notNull(),
  },
  (t) => [
    index('deletion_log_youtube_channel_hmac_idx').on(t.youtubeChannelHmac),
    workerScopePolicy('deletion_log', 'channel', 'insert'),
    workerScopePolicy('deletion_log', 'system', 'select'),
    workerScopePolicy('deletion_log', 'system', 'delete', completedOver24MonthsAgo(t.completedAt)),
  ],
)

/**
 * A Stripe subscription a channel deletion still has to cancel and refund. The deletion writes it
 * before it deletes the channel's rows, which take the channel's subscriptions row with them, so
 * it outlives its channel and its channel id has no foreign key. It exists only while the
 * cancellation is pending: the cancellation job deletes it once Stripe accepts the cancellation
 * and the refund, so no Stripe id outlives a completed cancellation. Only the deletion's channel
 * scope reads or writes it.
 */
export const subscriptionCancellations = pgTable(
  'subscription_cancellations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id').notNull(),
    deletionRequestId: uuid('deletion_request_id').notNull().unique(),
    stripeSubscriptionId: text('stripe_subscription_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [workerPolicy('subscription_cancellations', t.channelId)],
)

/**
 * A user's Stripe subscription that their account deletion still has to cancel and refund
 * (stillstats#20, ADR 0024). The deletion writes it in the user's scope, before it deletes the user
 * row, which takes the user's subscription row with it, so it outlives its user and holds no user
 * id. A user pends only their own: the insert's check reads `user_subscriptions` under the user's
 * own policy. It exists only while the cancellation is pending: the system scope's cancellation
 * job deletes it once Stripe accepts the cancellation and the refund, so no Stripe id outlives a
 * completed cancellation. The user scope writes it and cannot read it back.
 */
export const accountCancellations = pgTable(
  'account_cancellations',
  {
    id: uuid('id').primaryKey(),
    stripeSubscriptionId: text('stripe_subscription_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    webPolicy(
      'account_cancellations',
      'insert',
      sql`${t.stripeSubscriptionId} in (select s.stripe_subscription_id from user_subscriptions s)`,
      'account_cancellations_web_insert',
    ),
    workerScopePolicy('account_cancellations', 'system', 'select'),
    workerScopePolicy('account_cancellations', 'system', 'delete'),
  ],
)
