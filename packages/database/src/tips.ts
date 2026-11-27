import { index, pgPolicy, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { inScope, ownRowsPolicies, webRole } from './access.ts'
import { users } from './auth.ts'

/**
 * The fact of a tip: one row per paid Stripe Checkout Session, keyed by the session's ID, so a
 * repeated delivery of the same session writes nothing. Stripe's webhook, signed in by no one,
 * writes it in the anonymous scope, which may only insert. The tipper reads it in their own user
 * scope, and it cascades from its user, so "Delete me" removes it. A session whose
 * `client_reference_id` names no user, an account gone before Stripe's delivery, still records a
 * row, with no user: it keeps a repeated delivery from counting the tip twice, and no user scope
 * reads it. It holds no amount, currency, email or name.
 */
export const tips = pgTable(
  'tips',
  {
    checkoutSessionId: text('checkout_session_id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('tips_user_id_idx').on(t.userId),
    pgPolicy('tips_anonymous_insert', {
      for: 'insert',
      to: webRole,
      withCheck: inScope('anonymous'),
    }),
    ...ownRowsPolicies('tips', t.userId),
  ],
)
