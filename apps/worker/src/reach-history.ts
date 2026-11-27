import { randomUUID } from 'node:crypto'
import {
  reachHistory,
  reachHistoryDays,
  reportingJobs,
  type Scoped,
} from '@creator-analytics/database'
import { entitlementOf } from '@creator-analytics/entitlements'
import type { Reporter } from '@creator-analytics/reporter'
import type {
  RateLimit,
  ReachDownloadResult,
  ReachReport,
  ReachReportsResult,
  ReachRow,
  YouTubeGateway,
} from '@creator-analytics/youtube-gateway'
import { and, eq, max } from 'drizzle-orm'

export interface ReachHistoryOptions {
  gateway: Pick<YouTubeGateway, 'listReachReports' | 'downloadReachReport'>
  reporter: Reporter
}

const failingAlarmMs = 3 * 24 * 60 * 60 * 1000

// The wait before a rate-limited download's job runs again: a minute, or Google's Retry-After when
// that is longer. The Reporting API documents no rate limit and no Retry-After (its introduction
// and its reports guide on developers.google.com, read 2026-11-23). Google Cloud's per-minute
// quotas reset "one minute after your first request in a rolling window"
// (docs.cloud.google.com/docs/quotas/overview, read 2026-11-23), so a 429 met inside such a window
// has outlived it a minute later. On staging on 2026-11-23, a run 2 minutes after the second 429
// stored the rest of the history (#1043).
const rateLimitWaitSeconds = 60

// How many times one download queues its job again after a 429. A first download met Google's
// limit after 30 to 40 reports on staging (2026-11-23), and Google holds a report for 60 days, so
// two or three re-queues store a whole history, and ten span ten minutes at the least. A 429 that
// outlasts them is no short limit: RESOURCE_EXHAUSTED "may be a signal that quota is exhausted",
// and retries "may not be expected to work for several hours" (AIP-194, google.aip.dev/194, read
// 2026-11-23). The daily roster's run then takes the download up. The cap test asserts the count.
const requeueCap = 10

// Postgres takes at most 65,535 parameters in one statement, and a row is 6 of them.
const rowsPerInsert = 5000

/**
 * Stores one report as the whole of its day: the day's rows and its record go, then the report's
 * take their place, so a correction of a delivered day replaces it, and a correction holding no
 * row leaves the day held and empty. A row naming another day than the report's is not stored.
 */
async function storeReport(
  tx: Scoped<'channel'>,
  channelId: string,
  report: ReachReport,
  rows: ReachRow[],
): Promise<void> {
  const { day } = report
  await tx.sql
    .delete(reachHistory)
    .where(and(eq(reachHistory.channelId, channelId), eq(reachHistory.day, day)))
  await tx.sql
    .delete(reachHistoryDays)
    .where(and(eq(reachHistoryDays.channelId, channelId), eq(reachHistoryDays.day, day)))
  const dayRows = rows.filter((row) => row.day === day).map((row) => ({ channelId, ...row }))
  for (let start = 0; start < dayRows.length; start += rowsPerInsert) {
    await tx.sql.insert(reachHistory).values(dayRows.slice(start, start + rowsPerInsert))
  }
  await tx.sql
    .insert(reachHistoryDays)
    .values({ channelId, day, reportCreatedAt: report.createdAt })
}

/**
 * Queues the channel's job again, to start Google's wait after the 429 that just ended the run: the
 * wait runs from the scope's clock read now, since `tx.now` is the run's start and a run can spend
 * a minute downloading first. The job is the next run of `rateLimitedDownload`, or of a new
 * rate-limited download, unless that one has already queued its job `requeueCap` times; then it
 * reports the cap and queues nothing. Returns whether it queued the job.
 *
 * The job takes no throttle slot, so it can never hold the slot the roster's daily job or a
 * subscription's job of the same channel needs (`enqueueReportingJobs`, `recordSubscription`).
 * Two such jobs, or a re-queue and either, still never download at once: each takes the channel's
 * advisory lock first (`ensureReportingJob`), and resumes from the newest report the other stored.
 */
async function queueAgainAfterRateLimit(
  tx: Scoped<'channel'>,
  reporter: Reporter,
  channelId: string,
  rateLimitedDownload: string | undefined,
  { retryAfterSeconds }: RateLimit,
): Promise<boolean> {
  const data = { channelId, rateLimitedDownload: rateLimitedDownload ?? randomUUID() }
  const capped =
    rateLimitedDownload !== undefined &&
    (await tx.countJobs('ensureReportingJob', data)) >= requeueCap
  if (capped) {
    reporter.report({
      message:
        "A paid channel's history download was still rate limited when its re-queues ran out",
      context: { channelId, requeues: String(requeueCap) },
    })
    return false
  }
  const waitMs = Math.max(retryAfterSeconds ?? 0, rateLimitWaitSeconds) * 1000
  await tx.enqueue('ensureReportingJob', data, {
    startAfter: new Date(tx.clock().getTime() + waitMs),
  })
  return true
}

/**
 * A paid channel's daily download: every report of its reporting job created since the newest one
 * stored and not yet stored, or, with none stored, every one Google still holds, each stored in
 * creation order. A free channel, or one with no stored job, downloads nothing. A failed list or
 * download ends the run there, so the newest stored report stays where the next run resumes. A
 * report whose file the gateway cannot read is skipped, and the run goes on to the next one.
 *
 * A list or a download Google answers with a 429 also ends the run, and queues the channel's job
 * again (`queueAgainAfterRateLimit`), which resumes there: `rateLimitedDownload` is the id of the
 * rate-limited download a job continues, none for any other job. A run whose one failure is a 429
 * it queued its job again for leaves the channel's failing period as it was and raises nothing,
 * since the run it queued decides; a 429 whose download ran out of re-queues is a failed download.
 *
 * A channel whose downloads have failed for 3 days is reported, every run until one succeeds; a
 * revoked connection is being deleted, so it is not.
 */
export function downloadReachHistory({ gateway, reporter }: ReachHistoryOptions) {
  return async (
    tx: Scoped<'channel'>,
    channelId: string,
    rateLimitedDownload: string | undefined,
  ): Promise<void> => {
    if ((await entitlementOf(tx, channelId)).tier !== 'paid') return
    const [job] = await tx.sql
      .select({ failingSince: reportingJobs.downloadsFailingSince })
      .from(reportingJobs)
      .where(eq(reportingJobs.channelId, channelId))
    if (!job) return
    const [newest] = await tx.sql
      .select({ createdAt: max(reachHistoryDays.reportCreatedAt) })
      .from(reachHistoryDays)
      .where(eq(reachHistoryDays.channelId, channelId))
    const cursor = newest?.createdAt ?? null
    // Listed from just before the newest stored report, since Google lists only reports created
    // after the time it is given: a report created at that same time and not yet stored (one of a
    // batch Google stamps alike, or one whose download failed) is listed again, and a day already
    // stored from a report of that time is not downloaded twice.
    const storedAtCursor = new Set(
      cursor === null
        ? []
        : (
            await tx.sql
              .select({ day: reachHistoryDays.day })
              .from(reachHistoryDays)
              .where(
                and(
                  eq(reachHistoryDays.channelId, channelId),
                  eq(reachHistoryDays.reportCreatedAt, cursor),
                ),
              )
          ).map(({ day }) => day),
    )
    const storedAlready = (report: ReachReport) =>
      report.createdAt.getTime() === cursor?.getTime() && storedAtCursor.has(report.day)

    const listed = await gateway.listReachReports(
      tx,
      channelId,
      cursor === null ? null : new Date(cursor.getTime() - 1),
    )
    type Refusal = Extract<ReachReportsResult | ReachDownloadResult, { ok: false }>['refusal']
    let failure: Refusal | undefined
    let rateLimited: RateLimit | undefined
    if (!listed.ok && listed.refusal === 'rate_limited') rateLimited = listed
    else if (!listed.ok) failure = listed.refusal
    for (const report of listed.ok ? listed.reports.filter((r) => !storedAlready(r)) : []) {
      const downloaded = await gateway.downloadReachReport(tx, channelId, report)
      if (downloaded.ok) {
        await storeReport(tx, channelId, report, downloaded.rows)
        continue
      }
      if (downloaded.refusal === 'rate_limited') {
        rateLimited = downloaded
        break
      }
      failure = downloaded.refusal
      // A file the parser refuses is refused on every download, so ending the run there would stop
      // the history at it for good (#1040). The cursor is the newest stored report, so a later report
      // stored moves past it; until one is, each run downloads it again. It still counts as a failed
      // download, so a parser that refuses every file is reported instead of losing days unseen.
      if (downloaded.refusal !== 'unreadable_report') break
    }
    if (rateLimited) {
      const queued = await queueAgainAfterRateLimit(
        tx,
        reporter,
        channelId,
        rateLimitedDownload,
        rateLimited,
      )
      if (!queued) failure = 'rate_limited'
      else if (failure === undefined) return
    }

    const failingSince = failure === undefined ? null : (job.failingSince ?? tx.now)
    if (failingSince?.getTime() !== job.failingSince?.getTime()) {
      await tx.sql
        .update(reportingJobs)
        .set({ downloadsFailingSince: failingSince })
        .where(eq(reportingJobs.channelId, channelId))
    }
    if (failingSince === null || failure === 'connection_revoked') return
    if (tx.now.getTime() - failingSince.getTime() < failingAlarmMs) return
    reporter.report({
      message: 'A paid channel has failed to download its reach reports for 3 days',
      context: { channelId },
    })
  }
}
