import type { ErrorAnswer, ErrorCode } from '@creator-analytics/api-types'
import type { Hono } from 'hono'
import type { ApiDependencies } from '../app.ts'
import { feedbackOf, isOverFeedbackLimit, saveFeedback } from '../feedback.ts'
import type { SavedFeedback } from '../feedback-notice.ts'
import type { SignedIn } from '../signed-in.ts'

/**
 * POST /api/feedback: the signed-in creator's feedback message. The daily limit is checked first,
 * so a refused message is never checked or saved, and the count and the save share one
 * transaction, whose lock on the user keeps two sends at once from both passing the limit. Once
 * the save commits, Nick is emailed; the answer is 201 whether that send succeeds or fails.
 */
export function feedbackRoute(
  signedIn: Hono<SignedIn>,
  { database, feedbackNotifier }: Pick<ApiDependencies, 'database' | 'feedbackNotifier'>,
): void {
  signedIn.post('/feedback', async (c) => {
    // Read before the transaction opens, so a slow upload holds no connection and no lock.
    const body: unknown = await c.req.json().catch(() => undefined)
    const outcome = await database.asUser(
      c.get('user').id,
      async (tx): Promise<{ refusal: ErrorCode } | { saved: SavedFeedback }> => {
        if (await isOverFeedbackLimit(tx)) return { refusal: 'rate_limited' }
        const checked = feedbackOf(body)
        if ('error' in checked) return { refusal: checked.error }
        return { saved: await saveFeedback(tx, checked.message) }
      },
    )
    if ('refusal' in outcome) {
      const { refusal } = outcome
      return c.json(
        { error: refusal } satisfies ErrorAnswer,
        refusal === 'rate_limited' ? 429 : 400,
      )
    }
    // After the commit, so a rolled-back save never emails, and the send holds no connection and
    // no lock. The notifier never rejects.
    await feedbackNotifier.notify(outcome.saved)
    return c.body(null, 201)
  })
}
