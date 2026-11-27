import { sql } from 'drizzle-orm'
import { check, index, pgPolicy, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import {
  billingRole,
  inScope,
  isScopeChannel,
  userChannelIds,
  webPolicy,
  workerScopePolicy,
} from './access.ts'
import { channelOwned } from './channel-owned.ts'
import { channelIdColumn } from './channels.ts'

export const subscriptionPlans = ['monthly', 'annual'] as const

/**
 * A channel's Subscription to Pro, at most one per channel: its Stripe customer and
 * subscription, its plan, Stripe's status of it, the end of its paid period and its purge date.
 * Stripe's webhook, signed in by no one, writes it only through the record_subscription function
 * (migration 0030), which runs as `app_billing` in the anonymous scope; the anonymous scope reads
 * and writes no row of it itself. The history purge's channel scope clears its purge date once it
 * has deleted the channel's history (#789). The plan and the period end stay null until the event that
 * carries them lands, since Stripe orders none of its events. It holds no email, name, card or
 * amount.
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
    /** When the channel's stored history is deleted after the subscription ends (#787). */
    purgeAfter: timestamp('purge_after', { withTimezone: true }),
    /**
     * When Stripe created the newest event the row holds (#787), which orders the events it
     * delivers unordered: an older one of the same subscription only fills a null plan or period
     * end in record_subscription.
     */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  {
    onePerChannel: true,
    extraConfig: (t) => [
      check(
        'subscriptions_plan',
        sql`${t.plan} in (${sql.raw(subscriptionPlans.map((plan) => `'${plan}'`).join(', '))})`,
      ),
      pgPolicy('subscriptions_billing', {
        to: billingRole,
        using: inScope('anonymous'),
        withCheck: inScope('anonymous'),
      }),
    ],
  },
)

/**
 * The fact of a paid invoice of a channel's Subscription, one row per Stripe invoice, so a repeated
 * delivery of `invoice.paid` sends OpenPanel no second `revenue`. Stripe's webhook writes it only
 * through the record_subscription_payment function (migration 0034), which runs as `app_billing`
 * in the anonymous scope; no scope writes a row of it itself. The channel's members and its
 * channel scope only read it, the channel scope so a deletion counts its rows. It cascades from
 * its channel, as the subscription does, so a channel's deletion leaves no Stripe ID of its
 * payments (ADR 0006). It holds no amount, currency, customer or subscription.
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
    pgPolicy('subscription_payments_billing', {
      to: billingRole,
      using: inScope('anonymous'),
      withCheck: inScope('anonymous'),
    }),
  ],
)
