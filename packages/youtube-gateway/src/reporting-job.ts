import { pacificDayOf } from '@creator-analytics/api-types'
import type { youtubereporting_v1 } from '@googleapis/youtubereporting'
import type { GoogleCalls } from './read-definition.ts'

/**
 * The daily reach report: impressions and click-through rate by video, available to channels since
 * 2026-01-15 (the Reporting API's revision history, read 2026-11-17).
 */
export const reachReportTypeId = 'channel_reach_combined_a1'

const jobName = 'Stillstats daily reach'

export interface ReportingJob {
  jobId: string
  /** The job's creation time at Google: YouTube produces the 30 days before it and each day after. */
  createdAt: Date
}

function reportingJobOf(job: youtubereporting_v1.Schema$Job): ReportingJob | undefined {
  if (!job.id || !job.createTime) return undefined
  return { jobId: job.id, createdAt: new Date(job.createTime) }
}

/**
 * The channel's reach job at Google, listed first: `jobs.create` answers 409 to a second job of a
 * report type, so a job Google holds but the product never stored would block a create forever.
 * Undefined when Google answers a job without its id or creation time.
 */
export async function reachJobAtGoogle(
  google: GoogleCalls,
): Promise<{ job: ReportingJob | undefined; created: boolean }> {
  let pageToken: string | undefined
  do {
    const { data } = await google.reporting((api) =>
      api.jobs.list(pageToken === undefined ? {} : { pageToken }),
    )
    const held = data.jobs?.find((job) => job.reportTypeId === reachReportTypeId)
    if (held) return { job: reportingJobOf(held), created: false }
    pageToken = data.nextPageToken ?? undefined
  } while (pageToken)
  const { data } = await google.reporting((api) =>
    api.jobs.create({ requestBody: { reportTypeId: reachReportTypeId, name: jobName } }),
  )
  return { job: reportingJobOf(data), created: true }
}

/** One daily reach report a job holds at Google. */
export interface ReachReport {
  id: string
  /** YYYY-MM-DD, the Pacific day the report covers: the day of its start time. */
  day: string
  /** When Google generated it. A correction of a day is a later report for the same day. */
  createdAt: Date
  downloadUrl: string
}

function reachReportOf(report: youtubereporting_v1.Schema$Report): ReachReport | undefined {
  const { id, startTime, createTime, downloadUrl } = report
  if (!id || !startTime || !createTime || !downloadUrl) return undefined
  return { id, day: pacificDayOf(startTime), createdAt: new Date(createTime), downloadUrl }
}

/**
 * Every report of the job created after `createdAfter`, or every one Google still holds, oldest
 * creation first, from every page. Undefined when Google answers a report without its id, start
 * time, creation time or download URL.
 */
export async function reachReportsAtGoogle(
  google: GoogleCalls,
  jobId: string,
  createdAfter: Date | null,
): Promise<ReachReport[] | undefined> {
  const reports: ReachReport[] = []
  let pageToken: string | undefined
  do {
    const { data } = await google.reporting((api) =>
      api.jobs.reports.list({
        jobId,
        ...(createdAfter === null ? {} : { createdAfter: createdAfter.toISOString() }),
        ...(pageToken === undefined ? {} : { pageToken }),
      }),
    )
    for (const listed of data.reports ?? []) {
      const report = reachReportOf(listed)
      if (!report) return undefined
      reports.push(report)
    }
    pageToken = data.nextPageToken ?? undefined
  } while (pageToken)
  return reports.toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

/**
 * The media resource a report's download URL names, when the URL is on the Reporting API's own
 * root: the download carries the channel's bearer token, so it goes to no host Google's answer
 * names elsewhere. Undefined for any other URL.
 */
export function mediaResourceOf(downloadUrl: string, reportingRoot: string): string | undefined {
  let url: URL
  try {
    url = new URL(downloadUrl)
  } catch {
    return undefined
  }
  const media = new URL('v1/media/', reportingRoot)
  if (url.origin !== media.origin || !url.pathname.startsWith(media.pathname)) return undefined
  const resourceName = decodeURIComponent(url.pathname.slice(media.pathname.length))
  return resourceName === '' ? undefined : resourceName
}
