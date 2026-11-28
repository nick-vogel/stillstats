import type { ErrorAnswer, Refusal, RefusalAnswer } from '@creator-analytics/api-types'
import { isInternalId } from '@creator-analytics/database'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { ApiDependencies } from './app.ts'

/** The routes under /api that answer a signed-in user only. */
export type SignedIn = {
  Variables: { user: { id: string; email: string; name: string; createdAt: Date } }
}

/** What a route that reads a channel from Google is built with. */
export type ChannelReading = Pick<ApiDependencies, 'database' | 'gateway'>

// The gateway and accounts own their refusals; indexing this record with one checks that the
// package names it.
const refusalStatus: Record<Refusal, ContentfulStatusCode> = {
  not_connected: 404,
  connection_revoked: 410,
  consent_missing: 403,
  quota_reserved: 503,
  google_failed: 502,
  video_not_found: 404,
  // No route refuses a whole answer with it: the channel summary, the video list and the video
  // detail carry it in place of revenue.
  not_monetized: 403,
  // A member who does not own the channel may not buy Pro for it or manage it; a paid channel
  // needs no second subscription, which would charge its owner twice, and a channel that is not paid
  // has no subscription to manage.
  not_owner: 403,
  already_subscribed: 409,
  not_subscribed: 409,
  // A pick of a channel needs a free slot of a live paid subscription: swapping one in takes
  // another out first.
  no_free_slot: 409,
  // An add of a block names the count the user previewed; a quantity Stripe already holds at
  // another count, from a second click or a stale tab, buys no block nobody saw the price of.
  blocks_changed: 409,
}

export function refuse(c: Context, refusal: Refusal): Response {
  return c.json({ refusal } satisfies RefusalAnswer, refusalStatus[refusal])
}

/**
 * The answer to a channel read that failed: its refusal, or 400 `invalid_range` for a custom range
 * the read found outside the channel's days.
 */
export function answerFailedRead(
  c: Context,
  failed: { refusal: Refusal } | { error: 'invalid_range' },
): Response {
  if ('error' in failed) return c.json({ error: failed.error } satisfies ErrorAnswer, 400)
  return refuse(c, failed.refusal)
}

/**
 * The route's channel id, or undefined for a malformed one. Postgres rejects a malformed uuid, and
 * a malformed id names no channel the user holds.
 */
export function channelIdOf(c: Context): string | undefined {
  const channelId = c.req.param('channelId')
  return channelId && isInternalId(channelId) ? channelId : undefined
}
