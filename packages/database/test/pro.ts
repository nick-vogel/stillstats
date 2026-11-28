import { eq, sql } from 'drizzle-orm'
import { memberships, userSubscriptions } from '../src/schema.ts'
import type { Scoped, WebDatabase, WorkerDatabase } from '../src/scopes.ts'

const paidStatuses = new Set(['active', 'past_due'])

/** What one Stripe event says of a user's subscription, as record_user_subscription takes it. */
export interface RecordedEvent {
  userId: string | null
  legacyChannelId?: string | null
  customer: string
  subscription: string
  plan: 'monthly' | 'annual' | null
  status: string | null
  periodEnd: Date | null
  quantity?: number | null
  purgeAfter?: Date | null
  eventCreated: Date
}

/**
 * Records the event through record_user_subscription, the product's one write of a user's
 * subscription, in the scope given, and answers its outcome and the channels it turned Pro.
 */
export async function recordUserSubscription(
  scope: Scoped<'anonymous'>,
  event: RecordedEvent,
): Promise<{ outcome: string; turnedPro: string[] }> {
  const { rows } = await scope.sql.execute<{ outcome: string; turned_pro: string[] }>(
    sql`select outcome, turned_pro from record_user_subscription(${event.userId}, ${event.legacyChannelId ?? null}::uuid, ${event.customer}, ${event.subscription}, ${event.plan}, ${event.status}, ${event.periodEnd?.toISOString() ?? null}::timestamptz, ${event.quantity ?? null}::integer, ${event.purgeAfter?.toISOString() ?? null}::timestamptz, ${event.eventCreated.toISOString()}::timestamptz)`,
  )
  const [row] = rows
  if (!row?.outcome) throw new Error('record_user_subscription answered no outcome')
  return { outcome: row.outcome, turnedPro: row.turned_pro }
}

/** The user who owns the channel, read in the channel's own scope. */
export async function ownerOf(worker: WorkerDatabase, channelId: string): Promise<string> {
  const [owner] = await worker.forChannel(channelId, (scope) =>
    scope.sql
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.role, 'owner')),
  )
  if (!owner) throw new Error(`The channel ${channelId} has no owner`)
  return owner.userId
}

/**
 * Makes the channel's owner subscribe to Pro, through the product's own write of a subscription
 * in the anonymous scope, so the channel reads as Pro the way a purchase makes it. A live paid
 * subscription the owner already holds ends first, and a new one starts, so its fill picks the
 * channel when a slot is free. A status that is not paid ends the owner's paid subscription with
 * that status, or, for an owner with none, ends a new one, so the channel is picked; either gives
 * every picked channel the purge date when one is given, as an end event does. The first new
 * subscription is `sub_` and the channel's ID, a later one for the same channel adds `_again`.
 * Each event is created at the scope's clock, or just after the newest one the row holds.
 */
export async function subscribeOwner(
  web: WebDatabase,
  worker: WorkerDatabase,
  channelId: string,
  { status = 'active', purgeAfter = null }: { status?: string; purgeAfter?: Date | null } = {},
): Promise<void> {
  const userId = await ownerOf(worker, channelId)
  const [stored] = await web.asUser(userId, (scope) =>
    scope.sql
      .select({
        subscription: userSubscriptions.stripeSubscriptionId,
        status: userSubscriptions.status,
        updatedAt: userSubscriptions.updatedAt,
      })
      .from(userSubscriptions),
  )
  await web.asAnonymous(async (scope) => {
    const newest = stored?.updatedAt.getTime() ?? 0
    const event = {
      userId,
      customer: `cus_${userId}`,
      plan: 'monthly',
      periodEnd: null,
      eventCreated: new Date(Math.max(scope.now.getTime(), newest)),
    } as const
    const storedPaid = stored !== undefined && paidStatuses.has(stored.status)
    if (storedPaid && !paidStatuses.has(status)) {
      await recordUserSubscription(scope, {
        ...event,
        subscription: stored.subscription,
        status,
        purgeAfter,
      })
      return
    }
    if (storedPaid) {
      await recordUserSubscription(scope, {
        ...event,
        subscription: stored.subscription,
        status: 'canceled',
      })
    }
    let subscription = `sub_${channelId}`
    while (subscription === stored?.subscription) subscription = `${subscription}_again`
    await recordUserSubscription(scope, { ...event, subscription, status: 'active' })
    if (status !== 'active') {
      await recordUserSubscription(scope, { ...event, subscription, status, purgeAfter })
    }
  })
}
