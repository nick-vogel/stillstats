import {
  memberships,
  type Scoped,
  type subscriptionPlans,
  subscriptions,
} from '@creator-analytics/database'
import { and, eq, notInArray, sql } from 'drizzle-orm'

export type Tier = 'free' | 'paid'

/**
 * What a channel may use under its current plan, and, for an ended channel, when its stored
 * history is deleted: a free channel whose purge date is ahead still reads its history and
 * downloads none (CONTEXT.md, Purge date).
 */
export interface Entitlement {
  tier: Tier
  /** The purge date of an ended channel, while it is ahead; null for any other channel. */
  purgeDate: Date | null
}

export type Plan = (typeof subscriptionPlans)[number]

// A failed payment changes nothing until Stripe's retries end the subscription (ADR 0022): Stripe
// holds it `past_due` while it retries. record_subscription holds the same two (migration 0039),
// and reports a turn to paid by them.
const paidStatuses = new Set(['active', 'past_due'])

type StoredStatus = (typeof subscriptions.$inferSelect)['status']

/** Whether a subscription with Stripe's status gives its channel the paid Entitlement. */
function isPaidStatus(status: StoredStatus): boolean {
  return paidStatuses.has(status)
}

/**
 * The channel's Entitlement: paid while its subscription is active or past due, free with any
 * other status or with none. A free channel carries its purge date while the scope's clock is
 * before it, the ended state. The scope's policies admit only a channel the user holds, or the
 * channel scope's own, so a channel outside them reads as free.
 */
export async function entitlementOf(
  tx: Scoped<'user' | 'channel'>,
  channelId: string,
): Promise<Entitlement> {
  const [subscription] = await tx.sql
    .select({ status: subscriptions.status, purgeAfter: subscriptions.purgeAfter })
    .from(subscriptions)
    .where(eq(subscriptions.channelId, channelId))
  if (subscription && isPaidStatus(subscription.status)) return { tier: 'paid', purgeDate: null }
  const purgeAfter = subscription?.purgeAfter ?? null
  return { tier: 'free', purgeDate: purgeAfter && purgeAfter > tx.now ? purgeAfter : null }
}

/** Whether the channel's stored history may be read: paid, or ended with its purge date ahead. */
export function historyReadable({ tier, purgeDate }: Entitlement): boolean {
  return tier === 'paid' || purgeDate !== null
}

const purgeWindowDays = 30

/**
 * The purge date of a subscription that ended at `endedAt`: 30 days later (ADR 0006, ADR 0022),
 * the one place the window is written in code.
 */
export function purgeDateOf(endedAt: Date): Date {
  return new Date(endedAt.getTime() + purgeWindowDays * 24 * 60 * 60 * 1000)
}

/**
 * The Stripe customer whose Customer Portal the channel's owner may open: the stored one while the
 * channel is paid, else null, so an ended channel subscribes again through Checkout.
 */
export async function portalCustomerOf(
  tx: Scoped<'user'>,
  channelId: string,
): Promise<string | null> {
  if ((await entitlementOf(tx, channelId)).tier !== 'paid') return null
  return stripeCustomerOf(tx, channelId)
}

/**
 * Whether the channel's stored history is due for the purge: its purge date has come, at the same
 * instant `entitlementOf` stops answering it, and its subscription is not paid. Read in the purge's
 * channel scope, with the subscription row locked for the rest of the transaction, so a return
 * that record_subscription records at the same moment, which locks the same row, either clears the
 * date first and nothing is purged, or waits for the purge to end.
 */
export async function purgeDueOf(tx: Scoped<'channel'>, channelId: string): Promise<boolean> {
  const [subscription] = await tx.sql
    .select({ status: subscriptions.status, purgeAfter: subscriptions.purgeAfter })
    .from(subscriptions)
    .where(eq(subscriptions.channelId, channelId))
    .for('update')
  if (!subscription?.purgeAfter || isPaidStatus(subscription.status)) return false
  return subscription.purgeAfter <= tx.now
}

/**
 * Clears the channel's purge date once its history is purged (#789). The row keeps its status and
 * its Stripe customer, so a later subscription buys as the same customer.
 */
export async function clearPurgeDate(tx: Scoped<'channel'>, channelId: string): Promise<void> {
  await tx.sql
    .update(subscriptions)
    .set({ purgeAfter: null })
    .where(eq(subscriptions.channelId, channelId))
}

// Stripe's two statuses of a subscription that will never charge again. Any other, `past_due`,
// `unpaid` or `incomplete` included, can still take a payment, so a channel deletion cancels it.
const endedStatuses = ['canceled', 'incomplete_expired']

/**
 * The channel's subscription that a channel deletion has to cancel: its Stripe subscription, when
 * its status is any but an ended one, else null. Read in the deletion's channel scope.
 */
export async function liveSubscriptionOf(
  tx: Scoped<'channel'>,
  channelId: string,
): Promise<{ subscriptionId: string } | null> {
  const [subscription] = await tx.sql
    .select({ subscriptionId: subscriptions.stripeSubscriptionId })
    .from(subscriptions)
    .where(
      and(eq(subscriptions.channelId, channelId), notInArray(subscriptions.status, endedStatuses)),
    )
  return subscription ?? null
}

/** A channel the scope's user holds, and whether they own it, which only its owner may buy for. */
export interface HeldChannel {
  channelId: string
  owner: boolean
}

/** Every channel the scope's user holds a membership to, the oldest membership first. */
export async function heldChannelsOf(tx: Scoped<'user'>): Promise<HeldChannel[]> {
  // The memberships policy admits only the scope user's own.
  const held = await tx.sql
    .select({ channelId: memberships.channelId, role: memberships.role })
    .from(memberships)
    .orderBy(memberships.createdAt)
  return held.map(({ channelId, role }) => ({ channelId, owner: role === 'owner' }))
}

/**
 * The channel's Stripe customer, kept after its subscription ends, so a return to Pro
 * buys as the same customer. Null for a channel that never subscribed.
 */
export async function stripeCustomerOf(
  tx: Scoped<'user'>,
  channelId: string,
): Promise<string | null> {
  const [subscription] = await tx.sql
    .select({ customer: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.channelId, channelId))
  return subscription?.customer ?? null
}

/** What one Stripe event says of a channel's subscription; a null is what it does not carry. */
export interface SubscriptionFields {
  channelId: string
  customer: string
  subscription: string
  plan: Plan | null
  status: string | null
  periodEnd: Date | null
  /** The purge date an end event sets; null for an event that ends nothing. */
  purgeAfter: Date | null
  /** When Stripe created the event, which orders it against the others it sends unordered. */
  eventCreated: Date
}

export type RecordedSubscription = 'recorded' | 'unchanged' | 'no_channel' | 'other_subscription'

// The short throttle per channel of the shape agreed on #1034. It is not what stops a repeated or
// a late delivery from sending a second download: record_subscription reports the turn to paid
// once, for the statement that changed the row. The slot caps at one the downloads of a channel
// whose row turns paid more than once in it.
const subscribedSlotSeconds = 10 * 60

/**
 * Records what a Stripe event says of the channel's subscription, through the record_subscription
 * function (migrations 0030, 0033 and 0039), the one write the anonymous scope makes to
 * subscriptions: `unchanged` for an event that adds nothing, such as a repeated delivery, an event
 * older than the newest the row holds, or a late event of an ended or an old subscription,
 * `no_channel` for a channel that does not exist, and `other_subscription` for a live subscription
 * other than the stored one of a paid channel, which it never records.
 *
 * When the stored row turns paid, from no row or a status that is not paid, as record_subscription
 * reports in the same statement, it also sends the channel's ensureReportingJob job in the same
 * transaction, so its history downloads now and not at the next daily roster run (#1034). The row,
 * not the event, decides: Stripe delivers its events in no fixed order (docs.stripe.com/webhooks,
 * "Event ordering", read 2026-11-22), so the event that made the subscription paid can land after
 * a newer one and change nothing, and an older event that only fills a plan or a period end
 * answers `recorded` with the status unchanged. The job is throttled to one per channel in each
 * `subscribedSlotSeconds` slot, under its own purpose, so the roster's daily slot for the channel
 * neither blocks it nor is taken by it. The job resumes from the newest stored report, as the
 * roster's does, so a return before the purge date fills only the gap.
 */
export async function recordSubscription(
  tx: Scoped<'anonymous'>,
  {
    channelId,
    customer,
    subscription,
    plan,
    status,
    periodEnd,
    purgeAfter,
    eventCreated,
  }: SubscriptionFields,
): Promise<RecordedSubscription> {
  const result = await tx.sql.execute<{ outcome: RecordedSubscription; turned_paid: boolean }>(
    sql`select outcome, turned_paid from record_subscription(${channelId}::uuid, ${customer}, ${subscription}, ${plan}, ${status}, ${periodEnd?.toISOString() ?? null}::timestamptz, ${purgeAfter?.toISOString() ?? null}::timestamptz, ${eventCreated.toISOString()}::timestamptz)`,
  )
  const [answer] = result.rows
  if (!answer?.outcome) throw new Error('record_subscription answered no outcome')
  if (answer.turned_paid) {
    await tx.enqueue(
      'ensureReportingJob',
      { channelId },
      { throttle: { key: channelId, seconds: subscribedSlotSeconds, purpose: 'subscribed' } },
    )
  }
  return answer.outcome
}
