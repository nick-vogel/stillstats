import { addDays, utcDayOf } from '@creator-analytics/api-types'
import { activityDays, type Scoped } from '@creator-analytics/database'
import type { EventRelay } from '@creator-analytics/event-relay'
import type { Reporter } from '@creator-analytics/reporter'
import { and, countDistinct, eq, gte, lt, lte, type SQL, sql } from 'drizzle-orm'

export interface ActiveUserCountOptions {
  /** Unset when OpenPanel is not configured: the count still prunes, and reports that it sent nothing. */
  relay: Pick<EventRelay, 'deliverServerEvent'> | undefined
  reporter: Reporter
}

/** The distinct users of the activity days the filter keeps, as a JS integer. */
function distinctUsersWhere(filter: SQL) {
  // pg answers a count, a bigint, as text.
  return sql<number>`count(distinct ${activityDays.userId}) filter (where ${filter})`.mapWith(
    Number,
  )
}

/**
 * The daily active user count, for the UTC day that just ended, the counted day D: the distinct
 * users with an activity day on D (`dau`), on the 7 days ending on D (`wau`) and on the 30 days
 * ending on D (`mau`). It then deletes every activity day older than D-28, since the next day's 30
 * days start at D-28, and sends the counts to OpenPanel. A failed send rolls back only that delete
 * of the D-29 rows, since `pruneActivityDaysNoRetryNeeds` has already removed the older ones.
 */
export function countActiveUsers({ relay, reporter }: ActiveUserCountOptions) {
  return async (tx: Scoped<'system'>): Promise<void> => {
    const countedDay = addDays(utcDayOf(tx.now), -1)
    // An aggregate with no GROUP BY answers one row, of zeros when no activity day matches.
    const [counts = { dau: 0, wau: 0, mau: 0 }] = await tx.sql
      .select({
        dau: distinctUsersWhere(eq(activityDays.day, countedDay)),
        wau: distinctUsersWhere(gte(activityDays.day, addDays(countedDay, -6))),
        mau: countDistinct(activityDays.userId),
      })
      .from(activityDays)
      .where(
        and(gte(activityDays.day, addDays(countedDay, -29)), lte(activityDays.day, countedDay)),
      )
    await tx.sql.delete(activityDays).where(lt(activityDays.day, addDays(countedDay, -28)))
    if (!relay) {
      reporter.report({
        message: 'The active user count was not sent: OpenPanel is not configured',
        context: { countedDay },
      })
      return
    }
    // Last, and inside the count's transaction: a failed send rolls back the delete of the D-29
    // rows, so a retry counts the same rows, the D-29 this count's `mau` included.
    await relay.deliverServerEvent({
      name: 'active_users_counted',
      ...counts,
      __timestamp: `${countedDay}T12:00:00.000Z`,
    })
  }
}

/**
 * Deletes every activity day older than D-29, which no count of D, its retries included, reads. It
 * runs in its own scope before the count, so it commits whether or not the send lands, and while
 * OpenPanel refuses no row lives past 31 days.
 */
export async function pruneActivityDaysNoRetryNeeds(tx: Scoped<'system'>): Promise<void> {
  const countedDay = addDays(utcDayOf(tx.now), -1)
  await tx.sql.delete(activityDays).where(lt(activityDays.day, addDays(countedDay, -29)))
}
