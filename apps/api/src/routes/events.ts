import {
  type ErrorAnswer,
  extensionSurfaces,
  type RelayedExtensionEvent,
  shownExtensionEventName,
  surfaceExtensionEventNames,
  valuelessExtensionEventNames,
} from '@creator-analytics/api-types'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context, Hono } from 'hono'
import type { ApiDependencies } from '../app.ts'
import { isOneOf } from '../one-of.ts'
import type { SignedIn } from '../signed-in.ts'

/**
 * The event, or undefined when its name is not on the fixed list, a value it needs is missing or
 * not one of the fixed values, or it holds any other key. The relay carries nothing else.
 *
 * The shown event takes `ms`, a non-negative whole number of milliseconds, and `fromCache`, a
 * boolean, both or neither: an extension from before the timing still sends the surface alone.
 */
function extensionEventOf(body: unknown): RelayedExtensionEvent | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined
  const { name, ...values } = body as Record<string, unknown>
  if (typeof name !== 'string') return undefined
  const keys = Object.keys(values)
  if (isOneOf(valuelessExtensionEventNames, name)) return keys.length === 0 ? { name } : undefined
  const { surface, ms, fromCache } = values
  if (typeof surface !== 'string' || !isOneOf(extensionSurfaces, surface)) return undefined
  if (isOneOf(surfaceExtensionEventNames, name)) {
    return keys.length === 1 ? { name, surface } : undefined
  }
  if (name !== shownExtensionEventName) return undefined
  if (keys.length === 1) return { name, surface }
  if (keys.length !== 3 || typeof fromCache !== 'boolean') return undefined
  if (typeof ms !== 'number' || !Number.isSafeInteger(ms) || ms < 0) return undefined
  return { name, surface, ms, fromCache }
}

/**
 * The creator's IP: the `cf-connecting-ip` Cloudflare sets in front of the API, else the socket's
 * address when the request came straight in. Not `x-forwarded-for`, whose first entry the client
 * chooses: Cloudflare appends to one the client sent.
 */
function clientIpOf(c: Context): string | undefined {
  const connecting = c.req.header('cf-connecting-ip')
  if (connecting) return connecting
  return c.env?.incoming ? getConnInfo(c).remote.address : undefined
}

/** POST /api/events, the Studio extension's usage events. */
export function eventRelayRoute(
  signedIn: Hono<SignedIn>,
  { eventRelay, eventLimit }: Pick<ApiDependencies, 'eventRelay' | 'eventLimit'>,
): void {
  // Before the body is read, so an invalid event counts too and a refused one is never relayed.
  signedIn.post('/events', async (c) => {
    if (!eventLimit.admit(c.get('user').id)) {
      return c.json({ error: 'rate_limited' } satisfies ErrorAnswer, 429)
    }
    const event = extensionEventOf(await c.req.json().catch(() => undefined))
    if (!event) return c.json({ error: 'invalid_event' } satisfies ErrorAnswer, 400)
    await eventRelay.send(event, { userAgent: c.req.header('user-agent'), ip: clientIpOf(c) })
    return c.body(null, 204)
  })
}
