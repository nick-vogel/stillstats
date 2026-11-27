import type {
  AdminFeedbackAnswer,
  AdminFeedbackDoneAnswer,
  AdminFeedbackMessage,
  ErrorAnswer,
} from '@creator-analytics/api-types'
import { isInternalId, type Scoped } from '@creator-analytics/database'
import { type Context, Hono } from 'hono'
import {
  clearFeedbackDone,
  type FeedbackListRequest,
  listFeedback,
  setFeedbackDone,
} from '../admin-feedback.ts'
import type { ApiDependencies } from '../app.ts'

type Admin = { Variables: { adminId: string } }

/** The answer of an unknown route, so an admin route tells no one else it exists. */
function notFound(c: Context): Response {
  return c.json({ error: 'not_found' } satisfies ErrorAnswer, 404)
}

/** The list's page and filter, or undefined for a malformed one: a page a whole number from 1. */
function listRequestOf(page: string | undefined, open: string | undefined) {
  const number = page === undefined ? 1 : Number(page)
  const pageValid = page === undefined || (/^\d+$/.test(page) && Number.isSafeInteger(number))
  if (!pageValid || number < 1 || (open !== undefined && open !== 'true')) return undefined
  return { page: number, open: open === 'true' } satisfies FeedbackListRequest
}

/**
 * The admin routes under /api/admin, for a signed-in user on the allowlist only: anyone else, a
 * signed-out visitor included, gets the 404 of an unknown route from every path under the prefix,
 * and so does the admin from a path no route has. Registered on the app itself, before the
 * signed-in routes, whose check would answer a signed-out visitor 401. Each route runs in the
 * admin scope, which reads every feedback message and changes only its "Done" time.
 */
export function adminFeedbackRoute(
  app: Hono,
  { auth, database, adminUserIds }: Pick<ApiDependencies, 'auth' | 'database' | 'adminUserIds'>,
): void {
  const admin = new Hono<Admin>()
  admin.use(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session || !adminUserIds.has(session.user.id)) return notFound(c)
    c.set('adminId', session.user.id)
    await next()
  })

  const asAdmin = <T>(c: Context<Admin>, work: (scope: Scoped<'admin'>) => Promise<T>) =>
    database.asAdmin(c.get('adminId'), work)

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

  admin.all('*', notFound)
  app.route('/api/admin', admin)
}
