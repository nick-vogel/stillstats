import * as Sentry from '@sentry/node'

const sampleRateSetting = 'GLITCHTIP_TRACES_SAMPLE_RATE'

/** A decimal from 0 to 1, as the setting is written: `0`, `0.1`, `1` or `1.0`. */
const sampleRatePattern = /^(?:0(?:\.\d+)?|1(?:\.0+)?|\.\d+)$/

/**
 * The share of API requests whose trace leaves the process, from `GLITCHTIP_TRACES_SAMPLE_RATE`
 * (ADR 0023). Unset or empty is 0: errors only, as before. Any value but a number from 0 to 1
 * throws, so the process refuses to start rather than guess a rate.
 */
export function tracesSampleRateOf(env: Readonly<Record<string, string | undefined>>): number {
  const value = env[sampleRateSetting]
  if (value === undefined || value === '') return 0
  if (!sampleRatePattern.test(value))
    throw new Error(`${sampleRateSetting} must be a number from 0 to 1`)
  return Number(value)
}

/** What a request's trace carries beside its name and status: no id and no value of a creator. */
export interface TraceAttributes {
  /** The query's window, only when it is one the API offers. */
  window?: string | undefined
  /** The names of the known query parameters the request sent, sorted, comma-joined: no value. */
  filters?: string | undefined
  /** `hit` when every read came from the cache, `miss` when none did, `mixed` otherwise. */
  cache?: 'hit' | 'miss' | 'mixed' | undefined
}

/** The handle `traceRequest` gives a request. With tracing off, each call does nothing. */
export interface RequestTrace {
  /** Names the trace `<METHOD> <route pattern>`, such as `GET /api/channels/:channelId/videos`. */
  name(routePattern: string): void
  set(attributes: TraceAttributes): void
  /**
   * The answer's status. A 5xx marks the trace failed; another 4xx does not. The SDK drops a 401 to
   * 404 answer, and a redirect other than 300 and 304, whole.
   */
  status(code: number): void
}

/** OpenTelemetry's error status code, which Sentry reads as a failed span. */
const spanStatusError = 2

/**
 * Runs one request inside its own root span, a transaction, in a new trace, so the rate alone
 * decides whether it is sampled and never a caller's `sentry-trace` header. It leaves the process
 * only with a rate above 0 and only through the trace scrubbing hook. With tracing off, the SDK's
 * span is non-recording, so a caller never checks the rate.
 */
export function traceRequest<T>(
  method: string,
  run: (trace: RequestTrace) => Promise<T>,
): Promise<T> {
  return Sentry.startNewTrace(() =>
    Sentry.startSpan(
      {
        name: method,
        op: 'http.server',
        forceTransaction: true,
        attributes: { 'http.request.method': method },
      },
      (span) =>
        run({
          name(routePattern) {
            Sentry.updateSpanName(span, `${method} ${routePattern}`)
            // A route's pattern, which is how GlitchTip groups a transaction by endpoint.
            span.setAttribute('sentry.segment.name.source', 'route')
          },
          set(attributes) {
            for (const [key, value] of Object.entries(attributes)) {
              if (value !== undefined) span.setAttribute(key, value)
            }
          },
          status(code) {
            span.setAttribute('http.response.status_code', code)
            if (code >= 500) span.setStatus({ code: spanStatusError, message: 'internal_error' })
          },
        }),
    ),
  )
}
