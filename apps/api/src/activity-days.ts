import { utcDayOf } from '@creator-analytics/api-types'
import { activityDays, type WebDatabase } from '@creator-analytics/database'
import { createMiddleware } from 'hono/factory'
import type { SignedIn } from './signed-in.ts'

/**
 * Records that the signed-in user read a channel's numbers on the scope clock's UTC day, then runs
 * the read. The row commits in its own transaction before the read's, so a read the route refuses
 * still counts. A second read on the same day writes nothing, and two reads at once cannot fail
 * each other.
 */
export function recordActivityDay(database: WebDatabase) {
  return createMiddleware<SignedIn>(async (c, next) => {
    const userId = c.get('user').id
    await database.asUser(userId, (scope) =>
      scope.sql
        .insert(activityDays)
        .values({ userId, day: utcDayOf(scope.now) })
        .onConflictDoNothing(),
    )
    await next()
  })
}
