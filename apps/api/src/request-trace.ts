import {
  type AudienceQuery,
  type ChannelSummaryQuery,
  type VideoListQuery,
  videoWindows,
} from '@creator-analytics/api-types'
import { type TraceAttributes, traceRequest } from '@creator-analytics/reporter'
import type { ReadTiming } from '@creator-analytics/youtube-gateway'
import type { MiddlewareHandler } from 'hono'
import { routePath } from 'hono/route'
import { readsOfRequest } from './request-timing.ts'

type FilterName = Exclude<
  keyof VideoListQuery | keyof ChannelSummaryQuery | keyof AudienceQuery,
  'window'
>

/**
 * The query parameters a trace may name: the read screens' own, which the API defines, so no name
 * holds an id. A client can send any other name, and the trace drops it. The record makes the
 * compiler hold this list to the queries' keys.
 */
const filterNames: ReadonlySet<string> = new Set(
  Object.keys({
    from: true,
    to: true,
    page: true,
    pageSize: true,
    includeScheduled: true,
    sort: true,
    format: true,
    visibility: true,
    ids: true,
    trafficSource: true,
    minImpressions: true,
    withRetentionCurve: true,
  } satisfies Record<FilterName, true>),
)

/** The query's window, only when it is one the API offers. */
function windowOf(query: URLSearchParams): string | undefined {
  const window = query.get('window')
  return videoWindows.find((offered) => offered === window)
}

/** The names of the known parameters the query sent, sorted and comma-joined, never a value. */
function filtersOf(query: URLSearchParams): string | undefined {
  const names = [...new Set(query.keys())].filter((name) => filterNames.has(name)).sort()
  return names.length > 0 ? names.join(',') : undefined
}

/** `hit` when every read came from the cache, `miss` when none did, `mixed` otherwise. */
export function cacheOf(reads: readonly Pick<ReadTiming, 'cache'>[]): TraceAttributes['cache'] {
  if (reads.length === 0) return undefined
  if (reads.every(({ cache }) => cache === 'hit')) return 'hit'
  if (reads.every(({ cache }) => cache === 'miss')) return 'miss'
  return 'mixed'
}

/**
 * Traces each request under /api/ (ADR 0023): one root span, named by the method and the matched
 * route's pattern, never the path, with the window, the filter names and the cache result. Every
 * other path, /health, the web app and the site, is left alone. Inside `requestTiming`, whose
 * record of the request's reads gives the cache result. With the rate unset, the span records
 * nothing and nothing leaves.
 */
export function requestTrace(): MiddlewareHandler {
  return async (c, next) => {
    if (!c.req.path.startsWith('/api/')) return next()
    await traceRequest(c.req.method, async (trace) => {
      await next()
      const query = new URL(c.req.url).searchParams
      trace.name(routePath(c))
      trace.set({
        window: windowOf(query),
        filters: filtersOf(query),
        cache: cacheOf(readsOfRequest()),
      })
      trace.status(c.res.status)
    })
  }
}
