import { asc, sql } from 'drizzle-orm'
import { feedbackMessages } from '../src/feedback.ts'
import type { DrizzleTransaction } from '../src/scopes.ts'

/**
 * Every feedback message, oldest first, read on the test's transaction through the policy only
 * the test database holds (fixtures.ts): no scope of the product reads one.
 */
export async function readFeedbackMessages(transaction: DrizzleTransaction) {
  await transaction.execute(sql`select
    set_config('role', 'app_web', true),
    set_config('app.scope', 'fixture', true),
    set_config('app.user_id', '', true),
    set_config('app.channel_id', '', true)`)
  return transaction.select().from(feedbackMessages).orderBy(asc(feedbackMessages.createdAt))
}
