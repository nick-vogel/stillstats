import { pacificDayOf } from '@creator-analytics/api-types'
import { quotaUsage, readCache, reportingJobs, type Scoped } from '@creator-analytics/database'
import type { Logger } from '@creator-analytics/reporter'
import {
  type AuthorityRefusal,
  authorityRefusal,
  type ConnectionAuthority,
  type GoogleAuthority,
  googleCallTimeoutMs,
  type IdentifiedGrant,
  type ScopeName,
  TokenEndpointUnansweredError,
  type UnclaimedGrant,
} from '@creator-analytics/token-vault'
import { youtube } from '@googleapis/youtube'
import { youtubeAnalytics } from '@googleapis/youtubeanalytics'
import { youtubereporting } from '@googleapis/youtubereporting'
import { and, eq, gt, sql } from 'drizzle-orm'
import { OAuth2Client } from 'google-auth-library'
import { catalogue, type Reads } from './catalogue.ts'
import { type ReachRow, reachRowsOf } from './reach-report.ts'
import type { GoogleCalls } from './read-definition.ts'
import {
  mediaResourceOf,
  type ReachReport,
  reachJobAtGoogle,
  reachReportsAtGoogle,
} from './reporting-job.ts'

/** The Google roots this product calls YouTube at in production. */
export const youtubeRootUrls = {
  data: 'https://youtube.googleapis.com/',
  analytics: 'https://youtubeanalytics.googleapis.com/',
  reporting: 'https://youtubereporting.googleapis.com/',
}

export type YouTubeApi = keyof typeof youtubeRootUrls

// No Reporting API limit: Google's Reporting API introduction says its quota is not a concern, and
// gives no per-call cost or daily limit (read 2026-11-17), so its calls are recorded, never refused.
const dailyLimits: Partial<Record<YouTubeApi, number>> = {
  // The Data API default, from Google's quota page, checked 2026-10-03.
  data: 10_000,
  // "Queries per day" on the Analytics API's Cloud Console quotas page, read 2026-10-04.
  analytics: 100_000,
}

// The last 10% of each API's daily quota is reserved, so the product keeps the margin it needs to
// delete data and serve urgent reads.
const reservedShare = 0.1

/**
 * Where one read's time went, in milliseconds: `googleMs` inside its YouTube API calls, and
 * `databaseMs` the rest of the read, its connection check, cache, quota and token reads. A cache hit
 * spent nothing at Google. A read that ended before Google's answer reached the cache, refused or
 * thrown, is a `miss`.
 */
export interface ReadTiming {
  name: keyof Reads
  cache: 'hit' | 'miss'
  googleMs: number
  databaseMs: number
}

export interface YouTubeGatewayOptions {
  /** The API's token vault, or the worker's connection authority. */
  vault: ConnectionAuthority
  /** `youtubeRootUrls` in production, the fake Google server's in tests. */
  rootUrls: Record<YouTubeApi, string>
  logger: Logger
  /** Unset, `googleCallTimeoutMs`. */
  callTimeoutMs?: number | undefined
  /** Told each `read`'s timing when it ends, whatever its outcome. Unset, nothing is told. */
  onRead?: ((timing: ReadTiming) => void) | undefined
}

/** The time a read has spent inside its YouTube API calls so far. */
interface GoogleTime {
  ms: number
}

/**
 * Google answered the call with an error, and the call still spent its quota units. Or Google never
 * answered a call.
 */
export type GoogleFailure = 'google_failed'

export type IdentifyRefusal = 'no_channel' | AuthorityRefusal | GoogleFailure

/**
 * Google refused a revenue read for a channel outside the YouTube Partner Program, with a 403 (Nick's
 * live check of 2026-10-08). Cached like an answer, so a channel that joins shows revenue once the
 * cache runs out, with no new consent.
 */
export type NotMonetized = 'not_monetized'

export type ReadRefusal = AuthorityRefusal | 'quota_reserved' | GoogleFailure | NotMonetized

/**
 * Whether the channel's reporting job is stored, and whether this call created it at Google, or
 * why there is none.
 */
export type ReportingJobResult =
  | { ok: true; created: boolean }
  | { ok: false; refusal: AuthorityRefusal | GoogleFailure }

/**
 * Google answered a report list or download with a 429, "Too many requests have been sent within a
 * given time span" (`rateLimitExceeded` on the YouTube APIs' global errors page,
 * developers.google.com/youtube/v3/docs/core_errors, read 2026-11-23). The Reporting API's own
 * pages document no such limit and no Retry-After (its introduction and its reports guide, read
 * 2026-11-23); staging met the 429 after 30 to 40 downloads in a row on 2026-11-23 (#1043).
 */
export type RateLimited = 'rate_limited'

/** Google's Retry-After on a 429, in seconds, when its answer had one in that form. */
export interface RateLimit {
  retryAfterSeconds: number | undefined
}

/**
 * The channel's reach reports at Google, or why there are none: `no_reporting_job` for a channel
 * whose reporting job is not stored yet, and `rate_limited` for a 429.
 */
export type ReachReportsResult =
  | { ok: true; reports: ReachReport[] }
  | { ok: false; refusal: AuthorityRefusal | GoogleFailure | 'no_reporting_job' }
  | ({ ok: false; refusal: RateLimited } & RateLimit)

/**
 * A reach report's rows, reduced by `reachRowsOf`, or why the download failed:
 * `unreadable_report` for a file Google answered that `reachRowsOf` refuses, and `rate_limited`
 * for a 429, with Google's Retry-After in seconds when its answer had one.
 */
export type ReachDownloadResult =
  | { ok: true; rows: ReachRow[] }
  | { ok: false; refusal: AuthorityRefusal | GoogleFailure | 'unreadable_report' }
  | ({ ok: false; refusal: RateLimited } & RateLimit)

/**
 * Which of the asked videos Google still holds, or why the check has no answer. A refused or failed
 * call ends the whole check, so a caller never acts on a partial answer.
 */
export type ExistingVideosResult =
  | { ok: true; videoIds: Set<string> }
  | { ok: false; refusal: AuthorityRefusal | 'quota_reserved' | GoogleFailure }

// A videos.list call by id documents no maximum, so 50 ids a call is the assumption the uploads read
// makes too (`maxItemsPerCall` in reads/uploads.ts).
const videoIdsPerCall = 50

/**
 * A read's answer, or its refusal. A not_monetized refusal is Google's answer, cached like a value,
 * so it carries when it was fetched and whether it came from the cache.
 */
export type ReadResult<V> =
  | { ok: true; value: V; fetchedAt: Date; fromCache: boolean }
  | { ok: false; refusal: Exclude<ReadRefusal, NotMonetized> }
  | { ok: false; refusal: NotMonetized; fetchedAt: Date; fromCache: boolean }

export interface YouTubeGateway {
  /** Reads which channel a grant reads: the one the creator picked on Google's screen. */
  identifyGrant(
    tx: Scoped<'user'>,
    grant: UnclaimedGrant,
  ): Promise<{ ok: true; grant: IdentifiedGrant } | { ok: false; refusal: IdentifyRefusal }>
  read<K extends keyof Reads>(
    tx: Scoped<'user' | 'channel'>,
    channelId: string,
    name: K,
    request: Reads[K]['request'],
  ): Promise<ReadResult<Reads[K]['value']>>
  /**
   * The refusal the channel's connection gives the read before its cache or Google, the check
   * `read` makes first, or none. Spends no quota.
   */
  connectionRefusal(
    tx: Scoped<'user' | 'channel'>,
    channelId: string,
    name: keyof Reads,
  ): Promise<AuthorityRefusal | undefined>
  /**
   * Gives the channel a Reporting API job for its daily reach report, unless one is stored: it
   * stores a job Google already holds, or creates one. A Google outage or error ends it as
   * google_failed, never a throw, so the caller's transaction commits the units spent.
   */
  ensureReportingJob(tx: Scoped<'user' | 'channel'>, channelId: string): Promise<ReportingJobResult>
  /**
   * The reports of the channel's stored reporting job created after `createdAfter`, or every one
   * Google still holds, oldest creation first. Each page is one Reporting API call. An outage or
   * an error answer ends it as google_failed, and a 429 as rate_limited, never a throw.
   */
  listReachReports(
    tx: Scoped<'channel'>,
    channelId: string,
    createdAfter: Date | null,
  ): Promise<ReachReportsResult>
  /**
   * Downloads one report file and reduces it to the rows the product keeps. Refused as
   * google_failed, with no call, when its URL is not on the Reporting API's root; an outage or an
   * error answer ends it the same way, a 429 as rate_limited, and a file that cannot be read as
   * unreadable_report, never a throw.
   */
  downloadReachReport(
    tx: Scoped<'channel'>,
    channelId: string,
    report: ReachReport,
  ): Promise<ReachDownloadResult>
  /**
   * Which of the channel's videos still exist at Google: one Data API `videos.list` call with the
   * `id` part for each 50 ids, 1 unit each (the videos.list page, read 2026-11-17), uncached, since
   * a cached answer would keep a deleted video's history past the check. A private or an unlisted
   * video is answered, as the owner's call by id answers it. An empty list makes no call. A refusal,
   * an error answer or an outage of any call ends the check as that refusal, never a throw.
   */
  existingVideos(
    tx: Scoped<'channel'>,
    channelId: string,
    videoIds: string[],
  ): Promise<ExistingVideosResult>
}

interface Clients {
  authority: GoogleAuthority
  rootUrls: Record<YouTubeApi, string>
  callTimeoutMs: number
}

function auth(authority: GoogleAuthority) {
  const client = new OAuth2Client()
  client.setCredentials({ access_token: authority.bearer() })
  return client
}

// No automatic retry: each attempt spends quota, and the gateway records one call per attempt.
// `timeout` is gaxios' per-request bound in milliseconds, which a googleapis service client passes
// through (the gaxios and google-api-nodejs-client READMEs, read 2026-10-14). gaxios 7 aborts a call
// that passes it and rejects with no `response`, which `call` treats as a call Google did not answer.
function clientOptions({ authority, callTimeoutMs }: Clients) {
  return { auth: auth(authority), retry: false, timeout: callTimeoutMs }
}

function dataApi(clients: Clients) {
  return youtube({ version: 'v3', rootUrl: clients.rootUrls.data, ...clientOptions(clients) })
}

function analyticsApi(clients: Clients) {
  return youtubeAnalytics({
    version: 'v2',
    rootUrl: clients.rootUrls.analytics,
    ...clientOptions(clients),
  })
}

function reportingApi(clients: Clients) {
  return youtubereporting({
    version: 'v1',
    rootUrl: clients.rootUrls.reporting,
    ...clientOptions(clients),
  })
}

/** The quota day a time falls in. Google's quota day turns at midnight Pacific Time. */
export const quotaDayOf = pacificDayOf

/**
 * The reporting day a time falls in, as the Analytics API's dates name it: `pacificDayOf` from
 * api-types, which the fake Google server and the web app read too.
 */
export const reportingDayOf = pacificDayOf

/**
 * The hourly cache sweep: deletes every expired cache row, of every channel, and returns how many.
 * No WHERE clause, on purpose. The system scope's only policy on the cache admits the expired rows
 * to a DELETE, and a DELETE that read a column would need a SELECT policy the scope must not have.
 */
export async function sweepExpiredCache(tx: Scoped<'system'>): Promise<number> {
  const result = await tx.sql.delete(readCache)
  return result.rowCount ?? 0
}

function answeredByGoogle(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'response' in error && !!error.response
}

interface GoogleError {
  reason: string | undefined
  message: string | undefined
}

/**
 * Google's reason and message from an error body, `{ error: { message, errors: [{ reason }] } }`,
 * each when it is text. The reason is an identifier such as `forbidden` or `quotaExceeded`.
 */
function googleErrorOf(error: unknown): GoogleError {
  const none = { reason: undefined, message: undefined }
  const body = (error as { response: { data?: unknown } }).response.data
  if (typeof body !== 'object' || body === null || !('error' in body)) return none
  const detail: unknown = body.error
  if (typeof detail !== 'object' || detail === null) return none
  const message =
    'message' in detail && typeof detail.message === 'string' ? detail.message : undefined
  const first: unknown =
    'errors' in detail && Array.isArray(detail.errors) ? detail.errors[0] : undefined
  const reason =
    typeof first === 'object' &&
    first !== null &&
    'reason' in first &&
    typeof first.reason === 'string'
      ? first.reason
      : undefined
  return { reason, message }
}

/**
 * Google's reason and message as they read in a log line, `reason quotaExceeded: <message>`. The
 * text goes in the message, which the logger masks, because the context keeps only allowed keys.
 */
function reasonText({ reason, message }: GoogleError): string {
  return `reason ${reason ?? 'none'}: ${message ?? 'none'}`
}

/**
 * A Retry-After header's delay in seconds, from the headers gaxios 7 gives an error's response as a
 * fetch `Headers`. Only the delay-seconds form is read (RFC 9110, section 10.2.3): an HTTP date,
 * the header's other form, reads as none.
 */
function retryAfterSecondsOf(headers: unknown): number | undefined {
  if (typeof headers !== 'object' || headers === null || !('get' in headers)) return undefined
  if (typeof headers.get !== 'function') return undefined
  const value: unknown = headers.get('retry-after')
  if (typeof value !== 'string') return undefined
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : undefined
}

type GoogleAnswer<V> =
  | { answered: true; value: V }
  | ({ answered: false; status: number | undefined } & RateLimit & GoogleError)

/**
 * Ends a read whose Google call the quota refused, Google failed or rate limited, or Google refused
 * for a channel outside the YouTube Partner Program.
 */
class RefusedCall extends Error {
  readonly refusal: 'quota_reserved' | GoogleFailure | NotMonetized | RateLimited
  /** Google's Retry-After, for a rate_limited refusal. */
  readonly rateLimit: RateLimit | undefined

  constructor(refusal: 'quota_reserved' | GoogleFailure | NotMonetized)
  constructor(refusal: RateLimited, rateLimit: RateLimit)
  constructor(
    refusal: 'quota_reserved' | GoogleFailure | NotMonetized | RateLimited,
    rateLimit?: RateLimit,
  ) {
    super(refusal)
    this.refusal = refusal
    this.rateLimit = rateLimit
  }
}

const monetaryScope = 'yt-analytics-monetary.readonly'

type ReportingRefusal =
  | { ok: false; refusal: AuthorityRefusal | GoogleFailure }
  | ({ ok: false; refusal: RateLimited } & RateLimit)

// The Reporting API runs on the connection's own Analytics grant: no scope of its own.
const reportingNeeds: ScopeName[] = ['yt-analytics.readonly']

/** The cache row's payload: a read's value, or the refusal a channel outside the program gets. */
type CachedPayload<V> = { value: V } | { refusal: NotMonetized }

export function createYouTubeGateway({
  vault,
  rootUrls,
  logger,
  callTimeoutMs = googleCallTimeoutMs,
  onRead,
}: YouTubeGatewayOptions): YouTubeGateway {
  const clientsOf = (authority: GoogleAuthority): Clients => ({
    authority,
    rootUrls,
    callTimeoutMs,
  })

  /**
   * Makes one Google call and records its units, including when Google answers with an error. The
   * error comes back as a value, so the caller's transaction still commits the units. A call Google
   * never answered, such as a network failure, is an outage: it throws and records nothing.
   */
  async function spend<V>(
    tx: Scoped<'user' | 'channel'>,
    api: YouTubeApi,
    cost: number,
    call: () => Promise<V>,
    /** An error status Google answers in normal use, which is no error of the product's. */
    expectedStatus?: number,
  ): Promise<GoogleAnswer<V>> {
    let answer: GoogleAnswer<V>
    try {
      answer = { answered: true, value: await call() }
    } catch (error) {
      if (!answeredByGoogle(error)) throw error
      const { status, headers } = (error as { response: { status?: number; headers?: unknown } })
        .response
      answer = {
        answered: false,
        status,
        retryAfterSeconds: retryAfterSecondsOf(headers),
        ...googleErrorOf(error),
      }
    }
    await tx.sql
      .insert(quotaUsage)
      .values({ api, quotaDay: quotaDayOf(tx.now), units: cost })
      .onConflictDoUpdate({
        target: [quotaUsage.api, quotaUsage.quotaDay],
        set: { units: sql`${quotaUsage.units} + excluded.units` },
      })
    if (!answer.answered && answer.status !== expectedStatus) {
      // Google's reason tells a quota or rate limit 403 from a permission one. The logger masks
      // the tokens, YouTube ids and numbers the message may carry, as with a revenue read's 403.
      logger.error(`The YouTube ${api} API answered a call with an error, ${reasonText(answer)}`, {
        status: answer.status,
      })
    }
    return answer
  }

  /**
   * Checked before each Google call, with a plain read. The units another request has recorded but
   * not yet committed are invisible here, so concurrent requests can overshoot by their uncommitted
   * spend, which stays inside the 10% kept back while requests are few.
   */
  async function quotaAllows(tx: Scoped<'user' | 'channel'>, api: YouTubeApi, cost: number) {
    const dailyLimit = dailyLimits[api]
    if (dailyLimit === undefined) return true
    const quotaDay = quotaDayOf(tx.now)
    const [used] = await tx.sql
      .select({ units: quotaUsage.units })
      .from(quotaUsage)
      .where(and(eq(quotaUsage.api, api), eq(quotaUsage.quotaDay, quotaDay)))
    const units = used?.units ?? 0
    const limit = dailyLimit * (1 - reservedShare)
    if (units + cost <= limit) return true
    logger.warn(`Refused a YouTube ${api} API call to keep its reserved quota`, {
      quotaDay,
      unitsSpent: units,
      unitsUsable: limit,
    })
    return false
  }

  /**
   * `monetaryChannel`: the read needs the monetary scope, so a 403 is Google's answer for a channel
   * outside the YouTube Partner Program, every 6 hours of such a channel's reads. The 403 is logged
   * at warn with Google's reason and message, which the logger masks, and the channel's internal
   * id: no real 403 for such a channel has been seen yet (#119, W21), so the mapping may be too wide.
   * Every other error Google answers is logged at error by `spend`, with the same reason text.
   */
  function googleCalls(
    tx: Scoped<'user' | 'channel'>,
    clients: Clients,
    monetaryChannel: string | undefined,
    /** Adds the time inside each YouTube API call, a read's. Unset, the time is kept nowhere. */
    googleTime: GoogleTime = { ms: 0 },
  ): GoogleCalls {
    const monetary = monetaryChannel !== undefined
    async function call<T>(api: YouTubeApi, cost: number, run: () => Promise<T>): Promise<T> {
      if (!(await quotaAllows(tx, api, cost))) throw new RefusedCall('quota_reserved')
      let unanswered = false
      const answer = await spend(
        tx,
        api,
        cost,
        async () => {
          const started = performance.now()
          try {
            return await run()
          } catch (error) {
            unanswered = !answeredByGoogle(error)
            throw error
          } finally {
            googleTime.ms += performance.now() - started
          }
        },
        monetary ? 403 : undefined,
      ).catch((error: unknown) => {
        // An outage ends the read as a refusal, so the request's transaction commits the units of
        // every call answered before it, in this read and in the request's earlier reads.
        if (!unanswered) throw error
        // No status, as Google gave none, and no error: its message may carry the call's video ids.
        logger.error(`The YouTube ${api} API did not answer a call`)
        throw new RefusedCall('google_failed')
      })
      if (!answer.answered) {
        if (monetary && answer.status === 403) {
          logger.warn(
            `The YouTube ${api} API answered a revenue read with a 403, ${reasonText(answer)}`,
            { channelId: monetaryChannel, status: answer.status },
          )
        }
        if (answer.status === 429) {
          throw new RefusedCall('rate_limited', { retryAfterSeconds: answer.retryAfterSeconds })
        }
        // The vault's check before the call refuses a read whose scope the connection lacks, so a
        // 403 to a revenue read is Google's answer for a channel outside the YouTube Partner Program.
        throw new RefusedCall(monetary && answer.status === 403 ? 'not_monetized' : 'google_failed')
      }
      return answer.value
    }
    return {
      data: (cost, run) => call('data', cost, () => run(dataApi(clients))),
      analytics: (run) => call('analytics', 1, () => run(analyticsApi(clients))),
      reporting: (run) => call('reporting', 1, () => run(reportingApi(clients))),
    }
  }

  const connectionRefusal: YouTubeGateway['connectionRefusal'] = async (tx, channelId, name) =>
    authorityRefusal(await vault.status(tx, channelId), catalogue[name].needs)

  /**
   * Ends a call that met an outage or a refusal as that refusal; any other error throws. A 429 is
   * google_failed here: only the Reporting API's lists and downloads answer it as rate_limited
   * (`onReportingApi`), since only a history download's job queues itself again after one.
   */
  function refusalOf(error: unknown): Exclude<RefusedCall['refusal'], RateLimited> {
    // A refresh of the connection's access token Google never answered is an outage too.
    if (error instanceof TokenEndpointUnansweredError) {
      logger.error("Google's token endpoint did not answer a call")
      return 'google_failed'
    }
    if (!(error instanceof RefusedCall)) throw error
    return error.refusal === 'rate_limited' ? 'google_failed' : error.refusal
  }

  /**
   * Runs Reporting API calls on the channel's Analytics grant. With no monetary scope and no daily
   * limit, a refused Reporting API call is a failure: it ends as google_failed, or as rate_limited
   * for Google's 429.
   */
  async function onReportingApi<T>(
    tx: Scoped<'user' | 'channel'>,
    channelId: string,
    run: (google: GoogleCalls) => Promise<T>,
  ): Promise<{ ok: true; value: T } | ReportingRefusal> {
    return vault
      .withAuthority(tx, channelId, reportingNeeds, (authority) =>
        run(googleCalls(tx, clientsOf(authority), undefined)),
      )
      .catch((error: unknown) => {
        refusalOf(error)
        if (error instanceof RefusedCall && error.refusal === 'rate_limited') {
          const retryAfterSeconds = error.rateLimit?.retryAfterSeconds
          return { ok: false as const, refusal: error.refusal, retryAfterSeconds }
        }
        return { ok: false as const, refusal: 'google_failed' as const }
      })
  }

  /**
   * A 429 to creating a reporting job ends as google_failed. A job queued again a minute later
   * would find nothing to download: Google's first report of a new job comes "within 48 hours of
   * the time that the job is created" (the Reporting API's reports guide, read 2026-11-23), and the
   * daily roster's run is no later than that.
   */
  function rateLimitFailed(refused: ReportingRefusal): {
    ok: false
    refusal: AuthorityRefusal | GoogleFailure
  } {
    return refused.refusal === 'rate_limited' ? { ok: false, refusal: 'google_failed' } : refused
  }

  /** A read itself: the connection check, then the cache, then Google. */
  async function readThrough<K extends keyof Reads>(
    tx: Scoped<'user' | 'channel'>,
    channelId: string,
    name: K,
    request: Reads[K]['request'],
    googleTime: GoogleTime,
  ): Promise<ReadResult<Reads[K]['value']>> {
    const definition = catalogue[name]
    // The connection first, so a revoked channel serves nothing, not even a cached value.
    const refusal = await connectionRefusal(tx, channelId, name)
    if (refusal) return { ok: false, refusal }

    const key = definition.cacheKey(request)
    const [cached] = await tx.sql
      .select({ payload: readCache.payload, fetchedAt: readCache.fetchedAt })
      .from(readCache)
      .where(
        and(
          eq(readCache.channelId, channelId),
          eq(readCache.key, key),
          gt(readCache.expiresAt, tx.now),
        ),
      )
    if (cached) {
      const payload = cached.payload as CachedPayload<Reads[typeof name]['value']>
      if ('refusal' in payload) {
        return {
          ok: false,
          refusal: payload.refusal,
          fetchedAt: cached.fetchedAt,
          fromCache: true,
        }
      }
      return { ok: true, value: payload.value, fetchedAt: cached.fetchedAt, fromCache: true }
    }

    const monetary = definition.needs.includes(monetaryScope)
    // The units of every call made before a refused one stay recorded: the transaction commits.
    const called = await vault
      .withAuthority(tx, channelId, definition.needs, (authority) =>
        definition.fetch(
          googleCalls(tx, clientsOf(authority), monetary ? channelId : undefined, googleTime),
          request,
        ),
      )
      .catch((error: unknown) => ({ ok: false as const, refusal: refusalOf(error) }))
    if (!called.ok && called.refusal !== 'not_monetized') {
      return { ok: false, refusal: called.refusal }
    }

    // A channel outside the program keeps its refusal for the read's window, like an answer, and
    // the vault keeps its scope.
    const payload: CachedPayload<Reads[typeof name]['value']> = called.ok
      ? { value: called.value }
      : { refusal: 'not_monetized' }
    const entry = {
      payload,
      fetchedAt: tx.now,
      expiresAt: new Date(tx.now.getTime() + definition.cacheWindowMs),
    }
    await tx.sql
      .insert(readCache)
      .values({ channelId, key, ...entry })
      .onConflictDoUpdate({ target: [readCache.channelId, readCache.key], set: entry })
    if (!called.ok) {
      return { ok: false, refusal: 'not_monetized', fetchedAt: tx.now, fromCache: false }
    }
    return { ok: true, value: called.value, fetchedAt: tx.now, fromCache: false }
  }

  return {
    async identifyGrant(tx, grant) {
      let unanswered = false
      const identified = await vault
        .withAuthority(tx, grant, ['youtube.readonly'], (authority) =>
          // channels.list costs one unit, from Google's quota calculator, checked 2026-10-04.
          spend(tx, 'data', 1, async () => {
            const response = await dataApi(clientsOf(authority))
              .channels.list({ part: ['id'], mine: true })
              .catch((error: unknown) => {
                unanswered = !answeredByGoogle(error)
                throw error
              })
            return response.data.items?.[0]?.id
          }),
        )
        .catch((error: unknown) => {
          // An outage ends the connect on the google_failed landing, not the API's error handler.
          if (!unanswered) throw error
          // No status, as Google gave none, and no error: its message may carry identifiers.
          logger.error('The YouTube data API did not answer a call')
          return undefined
        })
      if (!identified) return { ok: false, refusal: 'google_failed' }
      if (!identified.ok) return identified
      const answer = identified.value
      if (!answer.answered) return { ok: false, refusal: 'google_failed' }
      const youtubeChannelId = answer.value
      if (!youtubeChannelId) return { ok: false, refusal: 'no_channel' }
      return { ok: true, grant: { grant, youtubeChannelId } }
    },

    connectionRefusal,

    async read(tx, channelId, name, request) {
      const started = performance.now()
      const googleTime: GoogleTime = { ms: 0 }
      let fromCache = false
      try {
        const result = await readThrough(tx, channelId, name, request, googleTime)
        fromCache = 'fromCache' in result && result.fromCache
        return result
      } finally {
        const googleMs = googleTime.ms
        onRead?.({
          name,
          cache: fromCache ? 'hit' : 'miss',
          googleMs,
          databaseMs: Math.max(0, performance.now() - started - googleMs),
        })
      }
    },

    async ensureReportingJob(tx, channelId) {
      const [stored] = await tx.sql
        .select({ jobId: reportingJobs.jobId })
        .from(reportingJobs)
        .where(eq(reportingJobs.channelId, channelId))
      if (stored) return { ok: true, created: false }

      const called = await onReportingApi(tx, channelId, reachJobAtGoogle)
      if (!called.ok) return rateLimitFailed(called)
      const { job, created } = called.value
      if (!job) {
        logger.error('The YouTube reporting API answered a job without its id or creation time')
        return { ok: false, refusal: 'google_failed' }
      }
      await tx.sql.insert(reportingJobs).values({ channelId, ...job })
      return { ok: true, created }
    },

    async listReachReports(tx, channelId, createdAfter) {
      const [stored] = await tx.sql
        .select({ jobId: reportingJobs.jobId })
        .from(reportingJobs)
        .where(eq(reportingJobs.channelId, channelId))
      if (!stored) return { ok: false, refusal: 'no_reporting_job' }
      const called = await onReportingApi(tx, channelId, (google) =>
        reachReportsAtGoogle(google, stored.jobId, createdAfter),
      )
      if (!called.ok) return called
      if (!called.value) {
        logger.error('The YouTube reporting API answered a report without its id, times or URL')
        return { ok: false, refusal: 'google_failed' }
      }
      return { ok: true, reports: called.value }
    },

    async downloadReachReport(tx, channelId, report) {
      const resourceName = mediaResourceOf(report.downloadUrl, rootUrls.reporting)
      if (resourceName === undefined) {
        logger.error('The YouTube reporting API answered a download URL off its own root')
        return { ok: false, refusal: 'google_failed' }
      }
      const called = await onReportingApi(tx, channelId, (google) =>
        google.reporting((api) =>
          api.media.download({ resourceName, alt: 'media' }, { responseType: 'text' }),
        ),
      )
      if (!called.ok) return called
      try {
        return { ok: true, rows: reachRowsOf(String(called.value.data)) }
      } catch (error) {
        // Logged as written: each refusal of `reachRowsOf` names its rule and column, no row value.
        logger.error(`A reach report file could not be read: ${(error as Error).message}`)
        return { ok: false, refusal: 'unreadable_report' }
      }
    },

    async existingVideos(tx, channelId, videoIds) {
      if (videoIds.length === 0) return { ok: true, videoIds: new Set() }
      const called = await vault
        .withAuthority(tx, channelId, ['youtube.readonly'], async (authority) => {
          const google = googleCalls(tx, clientsOf(authority), undefined)
          const existing = new Set<string>()
          for (let start = 0; start < videoIds.length; start += videoIdsPerCall) {
            const items = await google.data(1, async (api) => {
              const response = await api.videos.list({
                part: ['id'],
                id: videoIds.slice(start, start + videoIdsPerCall),
              })
              return response.data.items ?? []
            })
            for (const { id } of items) if (id) existing.add(id)
          }
          return existing
        })
        .catch((error: unknown) => {
          const refusal = refusalOf(error)
          // A Data API call never asks the monetary scope, so no answer is not_monetized.
          return {
            ok: false as const,
            refusal: refusal === 'not_monetized' ? ('google_failed' as const) : refusal,
          }
        })
      if (!called.ok) return called
      return { ok: true, videoIds: called.value }
    },
  }
}
