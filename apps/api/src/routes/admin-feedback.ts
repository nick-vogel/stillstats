import type {
  AdminFeedbackAnswer,
  AdminFeedbackDoneAnswer,
  AdminFeedbackMessage,
  ErrorAnswer,
} from '@creator-analytics/api-types'
import { isInternalId, type Scoped } from '@creator-analytics/database'
import type { Context, Hono } from 'hono'
import {
  clearFeedbackDone,
  type FeedbackListRequest,
  listFeedback,
  setFeedbackDone,
} from '../admin-feedback.ts'
import type { ApiDependencies } from '../app.ts'
import { type Admin, asAdmin as inAdminScope, notFound } from './admin.ts'

/** The list's page and filter, or undefined for a malformed one: a page a whole number from 1. */
function listRequestOf(page: string | undefined, open: string | undefined) {
  const number = page === undefined ? 1 : Number(page)
  const pageValid = page === undefined || (/^\d+$/.test(page) && Number.isSafeInteger(number))
  if (!pageValid || number < 1 || (open !== undefined && open !== 'true')) return undefined
  return { page: number, open: open === 'true' } satisfies FeedbackListRequest
}

/**
 * The admin routes of the feedback messages, on the admin router (`adminRoute`), behind its
 * allowlist. Each runs in the admin scope, which reads every feedback message and changes only its
 * "Done" time.
 */
export function adminFeedbackRoutes(
  admin: Hono<Admin>,
  { database }: Pick<ApiDependencies, 'database'>,
): void {
  const asAdmin = <T>(c: Context<Admin>, work: (scope: Scoped<'admin'>) => Promise<T>) =>
    inAdminScope(database, c, work)

  admin.get('/feedback', async (c) => {
    const request = listRequestOf(c.req.query('page'), c.req.query('open'))
    if (!request) return c.json({ error: 'invalid_query' } satisfies ErrorAnswer, 400)
    const answer = await asAdmin(c, (scope) => listFeedback(scope, request))
    return c.json(answer satisfies AdminFeedbackAnswer)
  })

  const doneRoute = (
    change: (scope: Scoped<'admin'>, id: string) => Promise<AdminFeedbackMessage | undefined>,
  ) =>
    async function done(c: Context<Admin>) {
      // A malformed ID names no message, and Postgres would reject it as a uuid.
      const id = c.req.param('id')
      if (!id || !isInternalId(id)) return notFound(c)
      const message = await asAdmin(c, (scope) => change(scope, id))
      return message ? c.json(message satisfies AdminFeedbackDoneAnswer) : notFound(c)
    }
  admin.put('/feedback/:id/done', doneRoute(setFeedbackDone))
  admin.delete('/feedback/:id/done', doneRoute(clearFeedbackDone))
}
