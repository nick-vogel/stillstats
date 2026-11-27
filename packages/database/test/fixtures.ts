import { sql } from 'drizzle-orm'
import { pgPolicy, text, uuid } from 'drizzle-orm/pg-core'
import { setting, webRole } from '../src/access.ts'
import { channelOwned } from '../src/channel-owned.ts'
import { feedbackMessages } from '../src/feedback.ts'

// Exists only in the test database, so seam 3 can prove isolation on a table no feature owns.
export const fixtureNotes = channelOwned('fixture_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  body: text('body').notNull(),
})

// Exists only in the test database, so a test can read back the feedback messages no scope of the
// product reads. It admits the 'fixture' scope, which no scope of the product sets.
export const fixtureFeedbackRead = pgPolicy('feedback_messages_fixture_read', {
  for: 'select',
  to: webRole,
  using: sql`${setting('app.scope')} = 'fixture'`,
}).link(feedbackMessages)
