import type { SupportAnswer } from '@creator-analytics/api-types'
import type { Hono } from 'hono'
import type { ApiDependencies } from '../app.ts'
import { readPreferences } from '../preferences.ts'
import type { SignedIn } from '../signed-in.ts'
import { fitsClientReferenceId, supportLinkOf } from '../support.ts'
import { hasTip } from '../tips.ts'

const noSupport: SupportAnswer = { link: null, prompt: false }

/**
 * GET /api/me/support: the signed-in creator's Payment Link, and whether the prompt shows. The
 * prompt shows while the creator has neither tipped nor dismissed it. A tip lives outside the
 * preferences, so "Reset preferences" never brings the prompt back to a creator who tipped. The
 * link stays either way, since the Settings screen's support section shows either way.
 */
export function supportRoute(
  signedIn: Hono<SignedIn>,
  { support, reporter, database }: Pick<ApiDependencies, 'support' | 'reporter' | 'database'>,
): void {
  signedIn.get('/me/support', async (c) => {
    if (!support) return c.json(noSupport)
    const userId = c.get('user').id
    // No link rather than a tip the app could never tie to its creator. The ID stays out of the
    // report.
    if (!fitsClientReferenceId(userId)) {
      reporter.report({ message: "A user ID breaks Stripe's client_reference_id rule" })
      return c.json(noSupport)
    }
    const { tipped, dismissed } = await database.asUser(userId, async (tx) => ({
      tipped: await hasTip(tx),
      dismissed: (await readPreferences(tx)).supportPromptDismissed === true,
    }))
    return c.json({
      link: supportLinkOf(support, userId),
      prompt: !tipped && !dismissed,
    } satisfies SupportAnswer)
  })
}
