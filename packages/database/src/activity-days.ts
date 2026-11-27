import { date, pgTable, primaryKey, text } from 'drizzle-orm/pg-core'
import { isScopeUser, webPolicy, workerScopePolicy } from './access.ts'
import { users } from './auth.ts'

/**
 * An activity day: the record that a user read a channel's numbers on a UTC day, one row per user
 * and day however many reads. It holds the user and the day and nothing else: no channel, no
 * route, no time of day. A signed-in read inserts the row in the user's own scope, which reads,
 * updates and deletes none. The worker reads and deletes rows in the system scope, to count the
 * active users and to prune the record, so no row outlives 30 days while the count's send lands,
 * and at most a day more while it fails. The row cascades from its user, so "Delete me" removes it.
 */
export const activityDays = pgTable(
  'activity_days',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.day] }),
    webPolicy('activity_days', 'insert', isScopeUser(t.userId), 'activity_days_web_insert'),
    workerScopePolicy('activity_days', 'system', 'select'),
    workerScopePolicy('activity_days', 'system', 'delete'),
  ],
)
