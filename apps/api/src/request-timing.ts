import { AsyncLocalStorage } from 'node:async_hooks'
import type { Logger } from '@creator-analytics/reporter'
import type { ReadTiming } from '@creator-analytics/youtube-gateway'
import type { MiddlewareHandler } from 'hono'
import { routePath } from 'hono/route'
import { channelIdOf } from './signed-in.ts'

/** The reads of the request in flight, in the order they finished. */
const requestReads = new AsyncLocalStorage<ReadTiming[]>()

/**
 * The gateway's `onRead`: keeps the read's timing on the request it ran in. A read outside an API
 * request, such as one a test makes on the gateway itself, is kept nowhere.
 */
export function recordRead(timing: ReadTiming): void {
  requestReads.getStore()?.push(timing)
}

const durationOf = (ms: number) => ms.toFixed(1)

/**
 * The `Server-Timing` value: the total, then a Google entry and a database entry for each read.
 * Each entry's name is unique, and its description names the read and its cache result, so it
 * reads alone in a browser's timing view. It names no channel, video or user, only reads.
 */
export function serverTimingOf(totalMs: number, reads: readonly ReadTiming[]): string {
  return [
    `total;dur=${durationOf(totalMs)}`,
    ...reads.flatMap(({ name, cache, googleMs, databaseMs }, i) => [
      `read${i + 1}-google;desc="${name} ${cache} Google";dur=${durationOf(googleMs)}`,
      `read${i + 1}-db;desc="${name} ${cache} database";dur=${durationOf(databaseMs)}`,
    ]),
  ].join(', ')
}

/**
 * Times each request under /api/: sets its `Server-Timing` header and writes its one request line,
 * whatever it answers, a refusal or an error included, since Hono's error handler has answered
 * by the time `next` returns. Every other path, /health, the web app and the site, is left alone.
 */
export function requestTiming(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    if (!c.req.path.startsWith('/api/')) return next()
    const started = performance.now()
    const reads: ReadTiming[] = []
    await requestReads.run(reads, next)
    const totalMs = performance.now() - started
    c.header('Server-Timing', serverTimingOf(totalMs, reads))
    logger.request({
      method: c.req.method,
      // The route's pattern, never its path, as the error report names it.
      route: routePath(c),
      status: c.res.status,
      totalMs,
      channelId: channelIdOf(c),
      reads,
    })
  }
}

/**
 * The reads the request in flight has made so far, for a middleware that runs inside
 * `requestTiming`, such as its trace. Outside a timed request, none.
 */
export function readsOfRequest(): readonly ReadTiming[] {
  return requestReads.getStore() ?? []
}
