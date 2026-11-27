import type { RelayedExtensionEvent } from '@creator-analytics/api-types'
import type { Reporter } from '@creator-analytics/reporter'

/** The self-hosted OpenPanel project the web app sends to, with a server-side client secret. */
export interface OpenPanelOptions {
  apiUrl: string
  clientId: string
  clientSecret: string
}

/** The browser an event came from, which OpenPanel derives its device from. */
export interface EventClient {
  userAgent: string | undefined
  ip: string | undefined
}

/**
 * The API's own events, which no client may post, so they stay out of `packages/api-types` and out
 * of `POST /api/events`' fixed list. `revenue` is OpenPanel's revenue shape, the one its SDK's
 * `op.revenue` sends: OpenPanel counts revenue only from an event named `revenue` with an integer
 * `__revenue`. `__revenue` is a tip's Checkout Session's `amount_total`, or a Pro invoice's
 * `total_excluding_tax`, its amount before the tax Stripe adds as merchant of record, in the
 * currency's smallest unit (cents for USD); `currency` is Stripe's lowercase code, as Stripe sends
 * it.
 */
export type ServerEvent =
  | { name: 'revenue'; __revenue: number; currency: string }
  /**
   * The worker's daily count of active users for the counted day. The three counts are integers.
   * `__timestamp` is noon UTC on the counted day as an ISO string, which keeps the point on that day
   * in any project time zone from UTC-12 to UTC+11; OpenPanel accepts a past `__timestamp` and
   * opens no session for it (the epic's OpenPanel facts, read 2026-11-11).
   */
  | { name: 'active_users_counted'; dau: number; wau: number; mau: number; __timestamp: string }

/** The three OpenPanel settings from the environment, all three or none. */
export function openPanelOptionsFrom(
  env: Readonly<Record<string, string | undefined>>,
): OpenPanelOptions | undefined {
  const apiUrl = env.OPENPANEL_API_URL
  const clientId = env.OPENPANEL_CLIENT_ID
  const clientSecret = env.OPENPANEL_CLIENT_SECRET
  if (!apiUrl || !clientId || !clientSecret) return undefined
  return { apiUrl, clientId, clientSecret }
}

export interface EventRelay {
  /** Never rejects: a failure is reported, and the caller answers as if it had been sent. */
  send(event: RelayedExtensionEvent, client: EventClient): Promise<void>
  /**
   * Sends one of the API's own events. It takes no client, so no caller can forward the user agent
   * or IP of the request that caused it, and it sends no profile id (ADR 0007). Never rejects, as
   * `send` does not.
   */
  sendServerEvent(event: ServerEvent): Promise<void>
  /**
   * Sends one of the API's own events as `sendServerEvent` does, but rejects when OpenPanel refuses
   * the event or never answers, and reports nothing: its caller reports the failure, once.
   */
  deliverServerEvent(event: ServerEvent): Promise<void>
}

// Long enough for a healthy OpenPanel on the same host, short enough that an outage does not hold
// the extension's request open.
const defaultSendTimeoutMs = 3_000

/**
 * With no options, as when OpenPanel is not configured, the relay sends nothing. OpenPanel ties an
 * event to a device by its user agent, IP and project, which is how the web app's events are tied,
 * so `send` forwards the browser's. `sendServerEvent` forwards neither, and OpenPanel files the
 * event as a server event with no session. Neither sends a profile id (ADR 0007).
 */
export function createEventRelay(
  options: OpenPanelOptions | undefined,
  {
    reporter,
    sendTimeout = () => AbortSignal.timeout(defaultSendTimeoutMs),
  }: {
    reporter: Reporter
    /** Called once per send, for the signal that ends it unanswered. */
    sendTimeout?: () => AbortSignal
  },
): EventRelay {
  if (!options) {
    return {
      send: async () => {},
      sendServerEvent: async () => {},
      deliverServerEvent: async () => {},
    }
  }
  const { apiUrl, clientId, clientSecret } = options
  /** Rejects with the status when OpenPanel refuses, and with the fetch's own error when unanswered. */
  async function postOrThrow(
    name: string,
    properties: Record<string, unknown>,
    { userAgent, ip }: EventClient,
  ): Promise<void> {
    const headers = new Headers({
      'content-type': 'application/json',
      'openpanel-client-id': clientId,
      'openpanel-client-secret': clientSecret,
    })
    if (userAgent) headers.set('user-agent', userAgent)
    // OpenPanel reads openpanel-client-ip first in its default IP_HEADER_ORDER, so a
    // cf-connecting-ip that a proxy in front of OpenPanel sets to this server's address cannot win.
    // An OpenPanel older than 2025-11-17 ignores openpanel-client-ip and reads x-client-ip first.
    if (ip) {
      headers.set('openpanel-client-ip', ip)
      headers.set('x-client-ip', ip)
    }
    const response = await fetch(new URL('track', `${apiUrl.replace(/\/$/, '')}/`), {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'track', payload: { name, properties } }),
      signal: sendTimeout(),
    })
    await response.body?.cancel()
    if (!response.ok) throw new RefusedEventError(response.status)
  }
  async function post(
    name: string,
    properties: Record<string, unknown>,
    client: EventClient,
  ): Promise<void> {
    try {
      await postOrThrow(name, properties, client)
    } catch (error) {
      if (error instanceof RefusedEventError) {
        reporter.report({
          message: 'OpenPanel refused a relayed event',
          context: { status: String(error.status) },
        })
      } else {
        reporter.report({ message: 'The event relay could not reach OpenPanel', error })
      }
    }
  }
  const noClient: EventClient = { userAgent: undefined, ip: undefined }
  return {
    send: ({ name, ...properties }, client) => post(name, properties, client),
    sendServerEvent: ({ name, ...properties }) => post(name, properties, noClient),
    deliverServerEvent: ({ name, ...properties }) => postOrThrow(name, properties, noClient),
  }
}

class RefusedEventError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`OpenPanel refused a server event with status ${status}`)
    this.status = status
  }
}
