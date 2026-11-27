import { addDays, pacificDayOf } from '@creator-analytics/api-types'
import { type Answer, type FakeReachReport, googleError } from '../channel-data.ts'
import type { ReportingAsked } from './jobs.ts'

const dayMs = 24 * 60 * 60 * 1000

// The Reporting API deletes a report 60 days after it is generated (v1/reports, read 2026-11-17).
const reportLifetimeMs = 60 * dayMs

/** The instant Pacific Time's day begins, as Google gives a daily report's start and end times. */
function pacificMidnightOf(day: string): string {
  for (const offsetHours of [7, 8]) {
    const candidate = new Date(Date.parse(`${day}T00:00:00Z`) + offsetHours * 60 * 60 * 1000)
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(candidate)
    if (pacificDayOf(candidate) === day && Number(hour) === 0) return candidate.toISOString()
  }
  throw new Error(`No Pacific midnight found for ${day}`)
}

/** The path of `jobs.reports.list`, its job id captured. */
export const reportsListPath = /^\/v1\/jobs\/([^/]+)\/reports$/

/** The path a report's `downloadUrl` names on the fake's own origin, its report id captured. */
export const downloadPath = /^\/v1\/media\/reports\/([^/]+)$/

function downloadPathOf(reportId: string): string {
  return `/v1/media/reports/${reportId}`
}

function liveReports({ youtubeChannelId, data }: ReportingAsked, now: Date): FakeReachReport[] {
  return (data.reachReports.get(youtubeChannelId) ?? []).filter(
    (report) => now.getTime() - Date.parse(report.createTime) < reportLifetimeMs,
  )
}

/**
 * `jobs.reports.list`: the job's reports still within their 60 days, each with its Pacific day as
 * start and end time and a download URL on `origin`; with `createdAfter`, only those created after
 * it. 404 for a job the channel does not hold. Google leaves `reports` out when there are none.
 */
export function listReports(
  asked: ReportingAsked,
  jobId: string,
  query: URLSearchParams,
  { origin, now }: { origin: string; now: Date },
): Answer {
  const jobs = asked.data.reportingJobs.get(asked.youtubeChannelId) ?? []
  if (!jobs.some((job) => job.id === jobId)) {
    return googleError(404, 'Requested entity was not found')
  }
  const createdAfter = query.get('createdAfter')
  const reports = liveReports(asked, now)
    .filter(
      (report) => createdAfter === null || Date.parse(report.createTime) > Date.parse(createdAfter),
    )
    .map((report) => ({
      id: report.id,
      jobId,
      startTime: pacificMidnightOf(report.day),
      endTime: pacificMidnightOf(addDays(report.day, 1)),
      createTime: report.createTime,
      downloadUrl: `${origin}${downloadPathOf(report.id)}`,
    }))
  return { status: 200, body: reports.length > 0 ? { reports } : {} }
}

// The documented columns of channel_reach_combined_a1 in an order of the fake's own, so a reader
// that assumes the documented order fails: Google asks every reader to use the header row.
const columns = [
  'video_thumbnail_impressions_ctr',
  'device_type',
  'video_id',
  'traffic_source_detail',
  'date',
  'video_thumbnail_impressions',
  'operating_system',
  'channel_id',
  'traffic_source_type',
] as const

function csvField(value: string | number): string {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * A report file: the CSV Google serves at a report's download URL, its header row first. A day with
 * no data is the header row alone. 404 for a report the channel does not hold or that expired.
 */
export function reportFile(asked: ReportingAsked, reportId: string, now: Date): Answer | string {
  const report = liveReports(asked, now).find((candidate) => candidate.id === reportId)
  if (!report) return googleError(404, 'Requested entity was not found')
  const lines = report.rows.map((row) => {
    const fields: Record<(typeof columns)[number], string | number> = {
      date: report.day.replaceAll('-', ''),
      channel_id: asked.youtubeChannelId,
      video_id: row.videoId,
      traffic_source_type: row.trafficSourceType,
      traffic_source_detail: row.trafficSourceDetail ?? '',
      operating_system: row.operatingSystem ?? 'ANDROID',
      device_type: row.deviceType ?? 'MOBILE',
      video_thumbnail_impressions: row.impressions,
      video_thumbnail_impressions_ctr: row.ctr,
    }
    return columns.map((column) => csvField(fields[column])).join(',')
  })
  return [columns.join(','), ...lines].join('\n').concat('\n')
}
