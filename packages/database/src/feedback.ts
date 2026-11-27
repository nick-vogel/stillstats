import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  check,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import {
  adminPolicies,
  feedbackCountRole,
  inScope,
  isScopeUser,
  scopeNow,
  webPolicy,
  workerScopePolicy,
} from './access.ts'
import { users } from './auth.ts'
import type { Scoped } from './scopes.ts'

// The sets are written out here because this package does not depend on the API types. The API's
// test of every value those types allow keeps the two in step.
const feedbackTypes = ['something_wrong', 'idea', 'other'] as const
const feedbackScreens = [
  'video_list',
  'video_detail',
  'audience',
  'settings',
  'whats_new',
  'extension',
] as const

function oneOf(values: readonly string[]) {
  return sql.raw(values.map((value) => `'${value}'`).join(', '))
}

/**
 * The retention window of a handled message: one year after its "Done" time by the scope's clock,
 * the limit the privacy policy publishes. Subtracted in UTC, as the deletion log's 24 months are,
 * so the cut-off does not move across a daylight saving change. A null time, an open message,
 * fails it.
 */
function handledOverAYearAgo(doneAt: AnyPgColumn) {
  return sql`${doneAt} < ((${scopeNow()} at time zone 'UTC') - interval '1 year') at time zone 'UTC'`
}

/**
 * A feedback message a signed-in creator sent from the web app: its type, its text, the name of
 * the screen it was sent from (never a path, a channel or a video), the app version, the reply
 * address only when the creator chose to give one, and the time it was handled. The user scope
 * inserts its own and reads none, so the API supplies the ID rather than reading one back. The
 * admin scope reads every message and changes only its "Done" time. The system scope deletes a
 * message one year after it is handled, and reaches it no other way. It cascades from its user, so
 * "Delete me" removes it.
 */
export const feedbackMessages = pgTable(
  'feedback_messages',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', { enum: feedbackTypes }).notNull(),
    text: text('text').notNull(),
    screen: text('screen', { enum: feedbackScreens }).notNull(),
    appVersion: text('app_version'),
    replyTo: text('reply_to'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    doneAt: timestamp('done_at', { withTimezone: true }),
  },
  (t) => [
    check('feedback_messages_type', sql`${t.type} in (${oneOf(feedbackTypes)})`),
    check('feedback_messages_screen', sql`${t.screen} in (${oneOf(feedbackScreens)})`),
    index('feedback_messages_user_id_created_at_idx').on(t.userId, t.createdAt),
    webPolicy('feedback_messages', 'insert', isScopeUser(t.userId), 'feedback_messages_web_insert'),
    pgPolicy('feedback_messages_count', {
      for: 'select',
      to: feedbackCountRole,
      using: inScope('user', isScopeUser(t.userId)),
    }),
    // Nick's admin screen reads every message and sets its "Done" time. Migration 0027's column
    // grant holds every app_web scope to that one column.
    ...adminPolicies('feedback_messages'),
    workerScopePolicy('feedback_messages', 'system', 'delete', handledOverAYearAgo(t.doneAt)),
  ],
)

/**
 * How many messages the scope's user sent in the 24 hours before the scope's pinned time, through
 * the feedback_count_today function (migration 0025), which reads no column but the user and the
 * time. It holds a lock on the user until the scope ends, so two sends at once cannot both pass the
 * daily limit.
 */
export async function feedbackCountToday(scope: Scoped<'user'>): Promise<number> {
  const result = await scope.sql.execute<{ count: number }>(
    sql`select feedback_count_today() as count`,
  )
  return result.rows[0]?.count ?? 0
}
