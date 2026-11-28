import { type SQLWrapper, sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import {
  billingRole,
  inScope,
  isScopeChannel,
  isScopeUser,
  proStateRole,
  userChannelIds,
  webPolicy,
  workerScopePolicy,
} from './access.ts'
import { users } from './auth.ts'
import { channelOwned } from './channel-owned.ts'
import { channelIdColumn } from './channels.ts'

export const subscriptionPlans = ['monthly', 'annual'] as const

function planCheck(name: string, plan: SQLWrapper) {
  return check(
    name,
    sql`${plan} in (${sql.raw(subscriptionPlans.map((each) => `'${each}'`).join(', '))})`,
  )
}

/** Admits every row to `app_billing` in the anonymous scope, where only its functions run. */
function billingPolicy(table: string) {
  return pgPolicy(`${table}_billing`, {
    to: billingRole,
    using: inScope('anonymous'),
    withCheck: inScope('anonymous'),
  })
}

/** Admits every row to `app_pro_state`, to read only, in the two scopes pro_state answers in. */
function proStatePolicy(table: string) {
  return pgPolicy(`${table}_pro_state`, {
    for: 'select',
    to: proStateRole,
    using: sql`(${inScope('user')} or ${inScope('channel')})`,
  })
}

/**
 * A user's Subscription to Pro, at most one per user (stillstats#20, ADR 0024): its Stripe
 * customer and subscription, its plan, Stripe's status of it, its quantity, the number of Blocks
 * it pays for, and the end of its paid period. Each live paid block gives the user 4 channel
 * slots, which `proPicks` fills. Stripe's webhook, signed in by no one, writes it only through the
 * record_user_subscription function (migration 0041), which runs as `app_billing` in the anonymous
 * scope; the anonymous scope reads and writes no row of it itself, and the user reads their own.
 * The Stripe customer stays after the subscription ends, so a return buys as the same customer.
 * The plan and the period end stay null until the event that carries them lands, since Stripe
 * orders none of its events. It holds no email, name, card or amount.
 */
export const userSubscriptions = pgTable(
  'user_subscriptions',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
    plan: text('plan', { enum: subscriptionPlans }),
    /** Stripe's own status of the subscription, such as `active` or `past_due`. */
    status: text('status').notNull(),
    /** The number of Blocks, each 4 channel slots, the subscription pays for. */
    quantity: integer('quantity').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    /**
     * When Stripe created the newest event the row holds, which orders the events it delivers
     * unordered: an older one of the same subscription only fills a null plan or period end.
     */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    planCheck('user_subscriptions_plan', t.plan),
    check('user_subscriptions_quantity', sql`${t.quantity} >= 1`),
    webPolicy('user_subscriptions', 'select', isScopeUser(t.userId)),
    billingPolicy('user_subscriptions'),
    proStatePolicy('user_subscriptions'),
  ],
)

/**
 * A channel its owner picked to take one of their Pro slots, at most one pick per channel. A
 * channel is Pro while its pick counts, its user still holding the channel's owner membership,
 * and ranks inside its user's capacity, 4 slots for each live paid block, by `pickedAt` and then
 * the order the channels were connected (pro_state, migration 0041). A disconnect ends the
 * membership at once, so the slot frees before the deletion cascades the pick away. Only the
 * webhook's fill, through record_user_subscription, writes it in this release; the channel's
 * members and the picking user read it, and the channel scope reads its own channel's.
 */
export const proPicks = pgTable(
  'pro_picks',
  {
    channelId: channelIdColumn(),
    /** The owner who picked it, whose slots it takes. */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pickedAt: timestamp('picked_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ name: 'pro_picks_pkey', columns: [t.channelId] }),
    index('pro_picks_user_id_idx').on(t.userId),
    webPolicy(
      'pro_picks',
      'select',
      sql`(${t.channelId} in ${userChannelIds} or ${isScopeUser(t.userId)})`,
    ),
    workerScopePolicy('pro_picks', 'channel', 'select', isScopeChannel(t.channelId)),
    billingPolicy('pro_picks'),
    proStatePolicy('pro_picks'),
  ],
)

/**
 * The fact of a paid invoice of a user's Subscription, one row per Stripe invoice, so a repeated
 * delivery of `invoice.paid` sends OpenPanel no second `revenue`. Stripe's webhook writes it only
 * through the record_user_subscription_payment function (migration 0041), as `app_billing` in the
 * anonymous scope; no scope writes a row of it itself, and the user reads their own. It cascades
 * from its user, as the subscription does. It holds no amount, currency, customer or subscription.
 */
export const userSubscriptionPayments = pgTable(
  'user_subscription_payments',
  {
    stripeInvoiceId: text('stripe_invoice_id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('user_subscription_payments_user_id_idx').on(t.userId),
    webPolicy('user_subscription_payments', 'select', isScopeUser(t.userId)),
    billingPolicy('user_subscription_payments'),
  ],
)

/**
 * A channel's Subscription to Pro, as the release before blocks kept it (stillstats#20). This
 * release reads and writes none of it: the previous release's images still read it during and
 * after a deploy (docs/deploy.md, "The release step"), migration 0041 copied its rows onto their
 * owners' `userSubscriptions`, and the remove release drops it.
 */
export const subscriptions = channelOwned(
  'subscriptions',
  {
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
    plan: text('plan', { enum: subscriptionPlans }),
    /** Stripe's own status of the subscription, such as `active` or `past_due`. */
    status: text('status').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    /**
     * A copy of the channel's purge date for the previous images, which still read it here
     * during and after a deploy (docs/deploy.md, "The release step"). No code of this release
     * reads or writes it, and the remove release drops it. The channel's purge date is
     * `proEnds.purgeAfter`.
     */
    purgeAfter: timestamp('purge_after', { withTimezone: true }),
    /**
     * When Stripe created the newest event the row holds (#787). Migration 0041 copied it as
     * the time the channel was picked.
     */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  {
    onePerChannel: true,
    extraConfig: (t) => [planCheck('subscriptions_plan', t.plan), billingPolicy('subscriptions')],
  },
)

/**
 * When a channel stopped being Pro and when its stored history is deleted, at most one row per
 * channel (#787, stillstats#19). The channel owns it, not its subscription, so each channel a
 * subscription covers can end Pro at its own time. Stripe's webhook writes it only through the
 * record_user_subscription function (migration 0041), as `app_billing` in the anonymous scope: an
 * end event sets the purge date 30 days after the end on every pick inside the user's capacity,
 * and a turn to paid deletes the row of every pick inside it, so a return before the date keeps
 * the history. The history purge's channel scope clears the purge date once it has deleted the
 * channel's history (#789), and keeps the end.
 */
export const proEnds = channelOwned(
  'pro_ends',
  {
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    /** When the channel's stored history is deleted; null once the purge has deleted it. */
    purgeAfter: timestamp('purge_after', { withTimezone: true }),
  },
  {
    onePerChannel: true,
    extraConfig: () => [billingPolicy('pro_ends')],
  },
)

/**
 * The paid invoices of a channel's Subscription, as the release before blocks kept them
 * (stillstats#20). This release writes none: the previous images read it, migration 0041 copied
 * its rows onto their owners' `userSubscriptionPayments`, and the remove release drops it. The
 * channel's members and its channel scope only read it, the channel scope so a deletion counts
 * its rows. It cascades from its channel (ADR 0006).
 */
export const subscriptionPayments = pgTable(
  'subscription_payments',
  {
    stripeInvoiceId: text('stripe_invoice_id').primaryKey(),
    channelId: channelIdColumn(),
  },
  (t) => [
    index('subscription_payments_channel_id_idx').on(t.channelId),
    webPolicy('subscription_payments', 'select', sql`${t.channelId} in ${userChannelIds}`),
    workerScopePolicy('subscription_payments', 'channel', 'select', isScopeChannel(t.channelId)),
    billingPolicy('subscription_payments'),
  ],
)
