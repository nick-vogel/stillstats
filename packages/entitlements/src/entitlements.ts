import { randomUUID } from 'node:crypto'
import {
  accountCancellations,
  memberships,
  proEnds,
  proPicks,
  type Scoped,
  type subscriptionPlans,
  userSubscriptions,
} from '@creator-analytics/database'
import { and, asc, eq, notInArray, sql } from 'drizzle-orm'

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
// holds it `past_due` while it retries. record_user_subscription and pro_state hold the same two
// (migration 0041).
const paidStatuses = new Set(['active', 'past_due'])

// Stripe's two statuses of a subscription that will never charge again. Any other, `past_due`,
// `unpaid` or `incomplete` included, can still take a payment, so it is live: a second Checkout
// would bill twice, and an account deletion cancels it.
const endedStatuses = ['canceled', 'incomplete_expired']

/** The slots of Pro each block gives, the one place the number is written in code (ADR 0024). */
export const slotsPerBlock = 4

/** The channel's own purge date, from its pro_ends row; null with no row or a cleared date. */
async function storedPurgeDateOf(
  tx: Scoped<'user' | 'channel'>,
  channelId: string,
  { lock = false } = {},
): Promise<Date | null> {
  const query = tx.sql
    .select({ purgeAfter: proEnds.purgeAfter })
    .from(proEnds)
    .where(eq(proEnds.channelId, channelId))
  const [ended] = await (lock ? query.for('update') : query)
  return ended?.purgeAfter ?? null
}

/**
 * Whether the channel is Pro, as pro_state answers it (migration 0041): its owner picked it, the
 * pick ranks inside the owner's capacity, 4 slots for each live paid block, and the owner still
 * owns it. It answers false for a channel the scope does not admit.
 */
async function isPro(tx: Scoped<'user' | 'channel'>, channelId: string): Promise<boolean> {
  const result = await tx.sql.execute<{ pro: boolean }>(
    sql`select pro_state(${channelId}::uuid) as pro`,
  )
  return result.rows[0]?.pro === true
}

/**
 * The channel's Entitlement: paid while the channel is Pro, picked inside its owner's capacity
 * of a live paid subscription, and free otherwise. A free channel carries its own purge date, on
 * its pro_ends row, while the scope's clock is before it, the ended state. Only a channel the user
 * holds, or the channel scope's own, can read as paid; any other reads as free.
 */
export async function entitlementOf(
  tx: Scoped<'user' | 'channel'>,
  channelId: string,
): Promise<Entitlement> {
  if (await isPro(tx, channelId)) return { tier: 'paid', purgeDate: null }
  const purgeAfter = await storedPurgeDateOf(tx, channelId)
  return { tier: 'free', purgeDate: purgeAfter && purgeAfter > tx.now ? purgeAfter : null }
}

/** Whether the channel's stored history may be read: paid, or ended with its purge date ahead. */
export function historyReadable({ tier, purgeDate }: Entitlement): boolean {
  return tier === 'paid' || purgeDate !== null
}

const purgeWindowDays = 30

/**
 * The purge date of a channel that stopped being Pro at `endedAt`: 30 days later (ADR 0006,
 * ADR 0022), the one place the window is written in code.
 */
export function purgeDateOf(endedAt: Date): Date {
  return new Date(endedAt.getTime() + purgeWindowDays * 24 * 60 * 60 * 1000)
}

/**
 * Whether the channel's stored history is due for the purge: its purge date has come, at the same
 * instant `entitlementOf` stops answering it, and the channel is not Pro. Read in the purge's
 * channel scope, with the channel's pro_ends row locked first for the rest of the transaction.
 * record_user_subscription takes the user's subscription row, then the picks, then their pro_ends
 * rows, and never a lock the purge holds first, so a return it records at the same moment either
 * deletes the row first and nothing is purged, or waits for the purge to end.
 */
export async function purgeDueOf(tx: Scoped<'channel'>, channelId: string): Promise<boolean> {
  const purgeAfter = await storedPurgeDateOf(tx, channelId, { lock: true })
  if (!purgeAfter || purgeAfter > tx.now) return false
  return !(await isPro(tx, channelId))
}

/**
 * Clears the channel's purge date once its history is purged (#789). Its pro_ends row keeps when
 * the channel stopped being Pro, and its owner's subscription keeps its Stripe customer, so a later
 * subscription buys as the same customer.
 */
export async function clearPurgeDate(tx: Scoped<'channel'>, channelId: string): Promise<void> {
  await tx.sql.update(proEnds).set({ purgeAfter: null }).where(eq(proEnds.channelId, channelId))
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

/** The scope user's own subscription row, which the user scope's policy admits alone. */
async function ownSubscriptionOf(tx: Scoped<'user'>) {
  const [subscription] = await tx.sql
    .select({
      customer: userSubscriptions.stripeCustomerId,
      subscription: userSubscriptions.stripeSubscriptionId,
      status: userSubscriptions.status,
      quantity: userSubscriptions.quantity,
    })
    .from(userSubscriptions)
  return subscription
}

/**
 * The scope user's Stripe customer, kept after their subscription ends, so a return to Pro buys
 * as the same customer. Null for a user who never subscribed.
 */
export async function stripeCustomerOf(tx: Scoped<'user'>): Promise<string | null> {
  return (await ownSubscriptionOf(tx))?.customer ?? null
}

/**
 * The Stripe customer whose Customer Portal the scope user may open: theirs while their
 * subscription is live, any status but an ended one, so an unpaid one can change its card; else
 * null, and an ended user subscribes again through Checkout.
 */
export async function portalCustomerOf(tx: Scoped<'user'>): Promise<string | null> {
  const subscription = await ownSubscriptionOf(tx)
  if (!subscription || endedStatuses.includes(subscription.status)) return null
  return subscription.customer
}

/** What the scope user's Pro is: their blocks, the slots in use, and each owned channel's pick. */
export interface ProAccount {
  /** The blocks of the user's live paid subscription; 0 without one. */
  blocks: number
  /** The picks that count inside the capacity, at most 4 for each block. */
  slotsInUse: number
  /** Whether the user holds a live subscription, which a second Checkout would bill twice. */
  subscribed: boolean
  /** Each channel the user owns, the oldest connection first, and whether they picked it. */
  ownedChannels: { channelId: string; picked: boolean }[]
}

/**
 * The scope user's Pro account, as pro_state counts it: a pick counts while the user owns its
 * channel, and the picks rank by when they were picked, then by connection, inside 4 slots for
 * each block of a live paid subscription.
 */
export async function proAccountOf(tx: Scoped<'user'>): Promise<ProAccount> {
  const subscription = await ownSubscriptionOf(tx)
  const blocks = subscription && paidStatuses.has(subscription.status) ? subscription.quantity : 0
  // Both policies admit the scope user's own rows: their memberships, and their own picks.
  const owned = await tx.sql
    .select({ channelId: memberships.channelId, pickedAt: proPicks.pickedAt })
    .from(memberships)
    .leftJoin(
      proPicks,
      and(eq(proPicks.channelId, memberships.channelId), eq(proPicks.userId, memberships.userId)),
    )
    .where(eq(memberships.role, 'owner'))
    .orderBy(asc(memberships.createdAt), asc(memberships.channelId))
  const picks = owned.filter(({ pickedAt }) => pickedAt !== null).length
  return {
    blocks,
    slotsInUse: Math.min(picks, blocks * slotsPerBlock),
    subscribed: subscription !== undefined && !endedStatuses.includes(subscription.status),
    ownedChannels: owned.map(({ channelId, pickedAt }) => ({
      channelId,
      picked: pickedAt !== null,
    })),
  }
}

const hourMs = 60 * 60 * 1000

// Well inside a day, so a cancellation Stripe keeps refusing is reported while the user can still
// be told, and after the cancellation queue's last retry (packages/database/src/jobs.ts).
const accountCancellationAlarmMs = 12 * hourMs

/**
 * Pends the cancellation of the scope user's live subscription, any status but an ended one, for
 * their account deletion (ADR 0022, ADR 0024), in the caller's transaction, before the user row
 * goes and takes the subscription row with it. The worker's job cancels it now and refunds the
 * unused part, and its alarm at 12 hours reports one still pending. Job data holds the
 * cancellation's uuid only. Null for a user with no live subscription, which pends nothing.
 */
export async function requestAccountCancellation(
  tx: Scoped<'user'>,
): Promise<{ cancellationId: string } | null> {
  const [live] = await tx.sql
    .select({ subscription: userSubscriptions.stripeSubscriptionId })
    .from(userSubscriptions)
    .where(notInArray(userSubscriptions.status, endedStatuses))
  if (!live) return null
  // The id is written here, not returned by the insert: the user scope may pend a cancellation and
  // read none back.
  const cancellationId = randomUUID()
  await tx.sql
    .insert(accountCancellations)
    .values({ id: cancellationId, stripeSubscriptionId: live.subscription, createdAt: tx.now })
  await tx.enqueue('cancelAccountSubscription', { cancellationId }, { startAfter: tx.now })
  await tx.enqueue(
    'accountCancellationAlarm',
    { cancellationId },
    { startAfter: new Date(tx.now.getTime() + accountCancellationAlarmMs) },
  )
  return { cancellationId }
}

/** What one Stripe event says of a user's subscription; a null is what it does not carry. */
export interface SubscriptionFields {
  /** The user the metadata names; null for a subscription made before blocks. */
  userId: string | null
  /**
   * The channel a subscription made before blocks names, which records onto its owner; null for
   * one that names a user.
   */
  legacyChannelId: string | null
  customer: string
  subscription: string
  plan: Plan | null
  status: string | null
  periodEnd: Date | null
  /** The number of blocks, the first item's quantity; null for an event that carries none. */
  quantity: number | null
  /**
   * The purge date an end event sets on each picked channel's pro_ends row, 30 days after the
   * end; null for an event that ends nothing.
   */
  purgeAfter: Date | null
  /** When Stripe created the event, which orders it against the others it sends unordered. */
  eventCreated: Date
}

export type RecordedSubscription = 'recorded' | 'unchanged' | 'no_user' | 'other_subscription'

// The short throttle per channel of the shape agreed on #1034. It is not what stops a repeated or
// a late delivery from sending a second download: record_user_subscription reports the channels it
// turned Pro once, for the statement that changed the row. The slot caps at one the downloads of a
// channel that turns Pro more than once in it.
const subscribedSlotSeconds = 10 * 60

/**
 * Records what a Stripe event says of the user's subscription, through the
 * record_user_subscription function (migration 0041), the one write the anonymous scope makes to
 * a user's subscription, its picks and their pro_ends rows: `unchanged` for an event that adds
 * nothing, such as a repeated delivery, an event older than the newest the row holds, or a late
 * event of an ended or an old subscription, `no_user` for a user that does not exist or a legacy
 * channel with no owner, and `other_subscription` for a live subscription other than the stored
 * one of a paid user, which it never records.
 *
 * When the stored row turns paid, the function fills the user's free slots with their owned
 * channels in connection order and answers every channel that turned Pro; each one's
 * ensureReportingJob job is sent in the same transaction, so its history downloads now and not at
 * the next daily roster run (#1034). The row, not the event, decides: Stripe delivers its events in
 * no fixed order (docs.stripe.com/webhooks, "Event ordering", read 2026-11-22). Each job is
 * throttled to one per channel in each `subscribedSlotSeconds` slot, under its own purpose, so the
 * roster's daily slot for the channel neither blocks it nor is taken by it. The job resumes from
 * the newest stored report, as the roster's does, so a return before the purge date fills only
 * the gap.
 */
export async function recordSubscription(
  tx: Scoped<'anonymous'>,
  {
    userId,
    legacyChannelId,
    customer,
    subscription,
    plan,
    status,
    periodEnd,
    quantity,
    purgeAfter,
    eventCreated,
  }: SubscriptionFields,
): Promise<RecordedSubscription> {
  const result = await tx.sql.execute<{ outcome: RecordedSubscription; turned_pro: string[] }>(
    sql`select outcome, turned_pro from record_user_subscription(${userId}, ${legacyChannelId}::uuid, ${customer}, ${subscription}, ${plan}, ${status}, ${periodEnd?.toISOString() ?? null}::timestamptz, ${quantity}::integer, ${purgeAfter?.toISOString() ?? null}::timestamptz, ${eventCreated.toISOString()}::timestamptz)`,
  )
  const [answer] = result.rows
  if (!answer?.outcome) throw new Error('record_user_subscription answered no outcome')
  for (const channelId of answer.turned_pro ?? []) {
    await tx.enqueue(
      'ensureReportingJob',
      { channelId },
      { throttle: { key: channelId, seconds: subscribedSlotSeconds, purpose: 'subscribed' } },
    )
  }
  return answer.outcome
}
