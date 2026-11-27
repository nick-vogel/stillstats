import {
  addDays,
  newestAverageSize,
  type UpgradeAnswer,
  type UpgradeComparison,
  type UpgradeWindow,
  upgradeWindows,
  type VideoFormatFilter,
} from '@creator-analytics/api-types'
import { reportingJobs, type Scoped } from '@creator-analytics/database'
import {
  type ReadRefusal,
  reportingDayOf,
  type YouTubeGateway,
} from '@creator-analytics/youtube-gateway'
import { eq } from 'drizzle-orm'
import { rangeOf } from './calendar-range.ts'
import { publishDayOf, readEveryUpload, videoOf } from './uploads.ts'
import { formatOf } from './video-format.ts'
import { qualifiesForNewestAverage, type UploadReach, wholeWindowOf } from './video-history.ts'

// The day four days back is the newest one surely past Google's 72-hour delay, as
// `processedThroughOf` counts it, so a subscription's newest day is today less 4.
const delayDays = 4

// Google keeps a new job's reports of the 30 days before it for 30 days, and every other report
// for 60 (developers.google.com/youtube/reporting/v1/reports, read 2026-11-17).
const historicalReportsDays = 30
const reportLifetimeDays = 60

/** An upload as the upgrade count reads it: the video and its publish day. */
export type UpgradeUpload = Pick<UploadReach, 'video' | 'publishDay'>

/**
 * The oldest day YouTube would still hold at the channel's first download: the job's creation day
 * less 30 while the job is under 30 days old then, else the later of its creation day and 60 days
 * before the download. A channel with no reporting job yet counts one made on the download day.
 */
export function historyStartIfSubscribed(
  firstDownloadDay: string,
  jobCreatedDay: string | null,
): string {
  const jobDay = jobCreatedDay ?? firstDownloadDay
  if (firstDownloadDay < addDays(jobDay, historicalReportsDays)) {
    return addDays(jobDay, -historicalReportsDays)
  }
  const oldestKept = addDays(firstDownloadDay, -reportLifetimeDays)
  return jobDay > oldestKept ? jobDay : oldestKept
}

/** The newest day a subscription today would hold: today less 4, past the 72-hour delay. */
export function newestDayIfSubscribed(today: string): string {
  return addDays(today, -delayDays)
}

/** Every day from `startDate` to `endDate`, both included. */
function daysBetween(startDate: string, endDate: string): Set<string> {
  const days = new Set<string>()
  for (let day = startDate; day <= endDate; day = addDays(day, 1)) days.add(day)
  return days
}

/**
 * How many uploads the window's newest average would count today with the history from
 * `historyStart` to `newestDay`, at most `newestAverageSize`, by the average's own rule
 * (`qualifiesForNewestAverage`). With fewer than 2, the first day a second of today's uploads
 * qualifies, once its window's last day is 4 days back, or null when they cannot reach 2.
 */
export function comparisonOf(
  uploads: UpgradeUpload[],
  formatFilter: VideoFormatFilter,
  window: UpgradeWindow,
  historyStart: string,
  newestDay: string,
): UpgradeComparison {
  const held = daysBetween(historyStart, newestDay)
  const qualifying = uploads.filter((upload) =>
    qualifiesForNewestAverage(upload, formatFilter, window, held),
  ).length
  const count = Math.min(qualifying, newestAverageSize)
  if (count >= 2) return { window, count, availableOn: null }
  const qualifyingDays = uploads
    .flatMap((upload) => {
      if (!upload.publishDay) return []
      const { endDate } = wholeWindowOf(window, upload.publishDay)
      const heldThen = daysBetween(historyStart, endDate)
      return qualifiesForNewestAverage(upload, formatFilter, window, heldThen)
        ? [addDays(endDate, delayDays)]
        : []
    })
    .toSorted()
  return { window, count, availableOn: qualifyingDays[1] ?? null }
}

/**
 * The upgrade screen's answer for the channel: its reporting job's creation day, then the uploads
 * and their lifetime formats, read as the video list reads them, so both share the cached queries.
 * The first download is the daily run after today. A refused read refuses the answer.
 */
export async function readUpgrade(
  gateway: YouTubeGateway,
  tx: Scoped<'user'>,
  channelId: string,
  formatFilter: VideoFormatFilter,
): Promise<
  { ok: true; answer: Omit<UpgradeAnswer, 'prices'> } | { ok: false; refusal: ReadRefusal }
> {
  const channel = await gateway.read(tx, channelId, 'uploads', {})
  if (!channel.ok) return channel
  const { createdAt, uploads } = channel.value
  const today = reportingDayOf(tx.now)
  const newestDay = newestDayIfSubscribed(today)
  const contentTypes = await readEveryUpload(uploads, (videoIds) =>
    gateway.read(tx, channelId, 'videoContentTypes', {
      ...rangeOf('lifetime', today, createdAt, newestDay),
      videoIds,
    }),
  )
  if (!contentTypes.ok) return contentTypes
  const [job] = await tx.sql
    .select({ createdAt: reportingJobs.createdAt })
    .from(reportingJobs)
    .where(eq(reportingJobs.channelId, channelId))
  const historyStart = historyStartIfSubscribed(
    addDays(today, 1),
    job ? reportingDayOf(job.createdAt) : null,
  )
  const read = uploads.map(
    (upload): UpgradeUpload => ({
      video: {
        ...videoOf(upload),
        privacy: upload.privacy,
        format: formatOf(contentTypes.byVideo.get(upload.videoId)),
      },
      publishDay: publishDayOf(upload),
    }),
  )
  return {
    ok: true,
    answer: {
      historyStart,
      newestDay,
      comparisons: upgradeWindows.map((window) =>
        comparisonOf(read, formatFilter, window, historyStart, newestDay),
      ),
    },
  }
}
