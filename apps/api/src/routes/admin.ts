import type { ErrorAnswer } from '@creator-analytics/api-types'
import type { Scoped } from '@creator-analytics/database'
import { type Context, Hono } from 'hono'
import type { ApiDependencies } from '../app.ts'
import { adminFeedbackRoutes } from './admin-feedback.ts'
import { adminGrantsRoutes } from './admin-grants.ts'

export type Admin = { Variables: { adminId: string } }

/** The answer of an unknown route, so an admin route tells no one else it exists. */
export function notFound(c: Context): Response {
  return c.json({ error: 'not_found' } satisfies ErrorAnswer, 404)
}

/** Runs `work` in the admin scope of the admin the allowlist check let through. */
export function asAdmin<T>(
  database: ApiDependencies['database'],
  c: Context<Admin>,
  work: (scope: Scoped<'admin'>) => Promise<T>,
): Promise<T> {
  return database.asAdmin(c.get('adminId'), work)
}

/**
 * The admin routes under /api/admin, for a signed-in user on the allowlist only: anyone else, a
 * signed-out visitor included, gets the 404 of an unknown route from every path under the prefix,
 * and so does the admin from a path no route has. Registered on the app itself, before the
 * signed-in routes, whose check would answer a signed-out visitor 401. Each route runs in the
 * admin scope: the feedback messages (creator-analytics#583) and the Pro grants (stillstats#24).
 */
export function adminRoute(
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

  adminFeedbackRoutes(admin, { database })
  adminGrantsRoutes(admin, { database })

  admin.all('*', notFound)
  app.route('/api/admin', admin)
}
