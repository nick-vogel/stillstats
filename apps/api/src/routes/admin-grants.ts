import {
  type AdminGrant,
  type AdminGrantsAnswer,
  adminGrantMaxBlocks,
  type ErrorAnswer,
  isDayText,
  utcDayOf,
} from '@creator-analytics/api-types'
import { isInternalId, type Scoped } from '@creator-analytics/database'
import {
  createProGrant,
  type ProGrantRow,
  proGrantsOf,
  removeProGrant,
} from '@creator-analytics/entitlements'
import type { Context, Hono } from 'hono'
import type { ApiDependencies } from '../app.ts'
import { type Admin, asAdmin, notFound } from './admin.ts'

/** A grant as the admin screen reads it, its times as ISO strings. */
function adminGrantOf(row: ProGrantRow): AdminGrant {
  return {
    id: row.id,
    email: row.email,
    blocks: row.blocks,
    endsAt: row.endsAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    paidBlocks: row.paidBlocks,
    grantedBlocks: row.grantedBlocks,
  }
}

async function grantsAnswerOf(scope: Scoped<'admin'>): Promise<AdminGrantsAnswer> {
  return { grants: (await proGrantsOf(scope)).map(adminGrantOf) }
}

interface GrantRequest {
  email: string
  blocks: number
  endsOn: string | null
}

/** A plausible email: something, an @, and a domain with a dot, with no space anywhere. */
const plausibleEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The grant a POST body asks for, or undefined for one that breaks a rule: a plausible email, a
 * whole number of blocks from 1 to `adminGrantMaxBlocks`, and an end day that is null or a
 * `YYYY-MM-DD` day. Whether the day is after today is checked against the scope's clock.
 */
async function requestedGrant(request: Request): Promise<GrantRequest | undefined> {
  const body: unknown = await request.json().catch(() => null)
  if (typeof body !== 'object' || body === null) return undefined
  const { email, blocks, endsOn } = body as Record<string, unknown>
  if (typeof email !== 'string' || !plausibleEmail.test(email.trim())) return undefined
  if (typeof blocks !== 'number' || !Number.isInteger(blocks)) return undefined
  if (blocks < 1 || blocks > adminGrantMaxBlocks) return undefined
  if (endsOn !== null && (typeof endsOn !== 'string' || !isDayText(endsOn))) return undefined
  return { email: email.trim(), blocks, endsOn }
}

/**
 * The Pro grant routes, on the admin router (`adminRoute`), behind its allowlist (stillstats#24).
 * Each runs in the admin scope, which reads and writes grants only through the grant functions.
 * None calls Stripe or the event relay: a grant is no purchase and sends OpenPanel no revenue.
 * GET /api/admin/grants: every grant, newest first, with its user's email and their paid and
 * granted blocks.
 * POST /api/admin/grants `{ email, blocks, endsOn }`: gives the user whose email it is the blocks,
 * ending at 00:00 UTC of `endsOn`, a day after today in UTC, or never for null; 201 with the GET's
 * answer. 400 `invalid_grant` for a body that breaks a rule, and 404 `unknown_email` for an email
 * no user holds.
 * DELETE /api/admin/grants/:id: removes the grant at once, and the GET's answer after it. 404
 * `not_found` for a malformed or unknown ID.
 */
export function adminGrantsRoutes(
  admin: Hono<Admin>,
  { database }: Pick<ApiDependencies, 'database'>,
): void {
  admin.get('/grants', async (c) => {
    const answer = await asAdmin(database, c, grantsAnswerOf)
    return c.json(answer satisfies AdminGrantsAnswer)
  })

  admin.post('/grants', async (c) => {
    const request = await requestedGrant(c.req.raw)
    if (!request) return invalidGrant(c)
    const answer = await asAdmin(database, c, async (scope) => {
      const { email, blocks, endsOn } = request
      if (endsOn !== null && endsOn <= utcDayOf(scope.now)) return 'invalid_grant' as const
      const endsAt = endsOn === null ? null : new Date(`${endsOn}T00:00:00.000Z`)
      const granted = await createProGrant(scope, { email, blocks, endsAt })
      if (!granted.ok) return 'unknown_email' as const
      return grantsAnswerOf(scope)
    })
    if (answer === 'invalid_grant') return invalidGrant(c)
    if (answer === 'unknown_email') {
      return c.json({ error: 'unknown_email' } satisfies ErrorAnswer, 404)
    }
    return c.json(answer satisfies AdminGrantsAnswer, 201)
  })

  admin.delete('/grants/:id', async (c) => {
    // A malformed ID names no grant, and Postgres would reject it as a uuid.
    const id = c.req.param('id')
    if (!id || !isInternalId(id)) return notFound(c)
    const answer = await asAdmin(database, c, async (scope) =>
      (await removeProGrant(scope, id)) ? grantsAnswerOf(scope) : undefined,
    )
    return answer ? c.json(answer satisfies AdminGrantsAnswer) : notFound(c)
  })
}

function invalidGrant(c: Context): Response {
  return c.json({ error: 'invalid_grant' } satisfies ErrorAnswer, 400)
}
