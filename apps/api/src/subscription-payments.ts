import type { Scoped } from '@creator-analytics/database'
import { sql } from 'drizzle-orm'

/**
 * Records a paid invoice of a user's subscription, once per invoice, through the
 * record_user_subscription_payment function (migration 0041), the one write path to
 * user_subscription_payments. An invoice of a subscription made before blocks names a channel,
 * and records onto its owner. True for a newly recorded invoice; false for one already recorded,
 * or for a user or a channel's owner that no longer exists, which records nothing.
 */
export async function recordSubscriptionPayment(
  tx: Scoped<'anonymous'>,
  {
    invoiceId,
    userId,
    legacyChannelId,
  }: { invoiceId: string; userId: string | null; legacyChannelId: string | null },
): Promise<boolean> {
  const result = await tx.sql.execute<{ recorded: boolean }>(
    sql`select record_user_subscription_payment(${invoiceId}, ${userId}, ${legacyChannelId}::uuid) as recorded`,
  )
  const recorded = result.rows[0]?.recorded
  if (recorded === undefined) throw new Error('record_user_subscription_payment answered nothing')
  return recorded
}
