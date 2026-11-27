import { type Scoped, tips, users } from '@creator-analytics/database'
import { eq } from 'drizzle-orm'

export interface RecordedTip {
  outcome: 'recorded' | 'repeated'
  /** Whether the session's reference names a user; a tip that names none records with no user. */
  namesUser: boolean
}

/**
 * Records a paid Checkout Session as a tip, once per session: the user's tip when the reference
 * names one, a tip with no user when it does not. The anonymous scope may only insert a tip, so
 * the insert carries no conflict target and no RETURNING, both of which would need it to read the
 * table: the session ID is the table's one unique key, and the row count tells a first delivery
 * from a repeated one.
 */
export async function recordTip(
  tx: Scoped<'anonymous'>,
  { userId, checkoutSessionId }: { userId: string; checkoutSessionId: string },
): Promise<RecordedTip> {
  const [user] = await tx.sql
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const inserted = await tx.sql
    .insert(tips)
    .values({ checkoutSessionId, userId: user ? userId : null, recordedAt: tx.now })
    .onConflictDoNothing()
  return {
    outcome: inserted.rowCount === 1 ? 'recorded' : 'repeated',
    namesUser: user !== undefined,
  }
}

/** Whether the scope's user has tipped. The policy admits only the user's own tips. */
export async function hasTip(tx: Scoped<'user'>): Promise<boolean> {
  const [tip] = await tx.sql
    .select({ checkoutSessionId: tips.checkoutSessionId })
    .from(tips)
    .limit(1)
  return tip !== undefined
}
