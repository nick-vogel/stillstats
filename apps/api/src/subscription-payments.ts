import type { Scoped } from '@creator-analytics/database'
import { sql } from 'drizzle-orm'

/**
 * Records a paid invoice of a channel's subscription, once per invoice, through the
 * record_subscription_payment function (migration 0034), the one write path to
 * subscription_payments. True for a newly recorded invoice; false for one already recorded, or for
 * a channel that no longer exists, which records nothing.
 */
export async function recordSubscriptionPayment(
  tx: Scoped<'anonymous'>,
  { invoiceId, channelId }: { invoiceId: string; channelId: string },
): Promise<boolean> {
  const result = await tx.sql.execute<{ recorded: boolean }>(
    sql`select record_subscription_payment(${invoiceId}, ${channelId}::uuid) as recorded`,
  )
  const recorded = result.rows[0]?.recorded
  if (recorded === undefined) throw new Error('record_subscription_payment answered nothing')
  return recorded
}
