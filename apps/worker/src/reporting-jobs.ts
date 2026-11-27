import {
  connectionRoster,
  connections,
  type JobData,
  jobDataOf,
  type Scoped,
} from '@creator-analytics/database'
import type { Reporter } from '@creator-analytics/reporter'
import type { YouTubeGateway } from '@creator-analytics/youtube-gateway'
import { eq, sql } from 'drizzle-orm'
import { downloadReachHistory } from './reach-history.ts'

export interface ReportingJobOptions {
  gateway: Pick<YouTubeGateway, 'ensureReportingJob' | 'listReachReports' | 'downloadReachReport'>
  reporter: Reporter
}

const daySeconds = 24 * 60 * 60

/** The job's channel, and the rate-limited download it continues, if a run queued it again. */
export function ensureReportingJobData(data: JobData): {
  channelId: string
  rateLimitedDownload?: string
} {
  const { channelId } = jobDataOf('ensureReportingJob', data, 'channelId')
  const { rateLimitedDownload } = data
  return rateLimitedDownload === undefined ? { channelId } : { channelId, rateLimitedDownload }
}

/**
 * The daily reportingJobRoster job: enqueues an ensureReportingJob job for each active connection,
 * which also reaches every channel connected before reporting jobs existed. Each channel's job is
 * throttled to one per UTC day, so a roster job that runs again that day sends none twice. A
 * subscription that turns a channel paid sends one too, under its own throttle
 * (`recordSubscription`).
 */
export async function enqueueReportingJobs(tx: Scoped<'system'>): Promise<void> {
  for (const { channelId } of await connectionRoster(tx)) {
    await tx.enqueue(
      'ensureReportingJob',
      { channelId },
      { throttle: { key: channelId, seconds: daySeconds } },
    )
  }
}

/**
 * The ensureReportingJob job. A channel with its reporting job then downloads its reach history,
 * which only a paid channel does (`downloadReachHistory`). A channel that still has no reporting
 * job a day after it connected is reported, every day until it has one; a revoked connection is
 * being deleted, so it is not.
 *
 * The roster, a connect, a subscription and a rate-limited download (`downloadReachHistory`) can
 * each send a channel's job, so two can run at once.
 * Each takes the channel's advisory lock first, held until its transaction ends, so the second
 * waits for the first to commit, then reads what it stored and resumes from its newest report. A
 * second that skipped instead could miss a channel the first read as free before its subscription
 * committed.
 */
export function ensureReportingJob({ gateway, reporter }: ReportingJobOptions) {
  const downloadHistory = downloadReachHistory({ gateway, reporter })
  return async (
    tx: Scoped<'channel'>,
    { channelId, rateLimitedDownload }: ReturnType<typeof ensureReportingJobData>,
  ): Promise<void> => {
    await tx.sql.execute(
      sql`select pg_advisory_xact_lock(hashtext('reach_history'), hashtext(${channelId}))`,
    )
    const ensured = await gateway.ensureReportingJob(tx, channelId)
    if (ensured.ok) return downloadHistory(tx, channelId, rateLimitedDownload)
    if (ensured.refusal === 'connection_revoked') return
    const [connection] = await tx.sql
      .select({ connectedAt: connections.connectedAt })
      .from(connections)
      .where(eq(connections.channelId, channelId))
    if (!connection) return
    if (tx.now.getTime() - connection.connectedAt.getTime() < daySeconds * 1000) return
    reporter.report({
      message: 'A connected channel still has no reporting job a day after it connected',
      context: { channelId },
    })
  }
}
