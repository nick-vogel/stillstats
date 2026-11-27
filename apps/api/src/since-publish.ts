import {
  daysProcessedSince,
  type RevenueCurrency,
  type SincePublish,
  type SincePublishRow,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import type { DateRange, ReadRefusal } from '@creator-analytics/youtube-gateway'
import type { ReadChannel } from './freshness.ts'
import { isRevenueRefusal } from './revenue-part.ts'
import { partialOf, rangeAfterPublish } from './window-after-publish.ts'

/** A stage's numbers, or one day's: revenue only when the stages carry it. */
type StageNumbers = Omit<SincePublishRow, 'stage' | 'partial'>

/** One day of the video's since publish query. */
type SincePublishDay = StageNumbers & { day: string }

function zerosOf(withRevenue: boolean): StageNumbers {
  return {
    engagedViews: 0,
    views: 0,
    estimatedMinutesWatched: 0,
    ...(withRevenue ? { estimatedRevenue: 0 } : {}),
  }
}

/** The days added up, revenue included when `withRevenue`: ADR 0013's simple arithmetic. */
function sumOf(days: SincePublishDay[], withRevenue: boolean): StageNumbers {
  const sum = zerosOf(withRevenue)
  for (const day of days) {
    sum.engagedViews += day.engagedViews
    sum.views += day.views
    sum.estimatedMinutesWatched += day.estimatedMinutesWatched
    if (sum.estimatedRevenue !== undefined) sum.estimatedRevenue += day.estimatedRevenue ?? 0
  }
  return sum
}

/**
 * The video's rows since publish: each window after publish, in order, the sum of the video's own
 * days inside it, with its partial days; then lifetime, YouTube's own total, with none.
 */
function sincePublishRowsOf(
  days: SincePublishDay[],
  lifetime: StageNumbers,
  publishDay: string | null,
  processedThrough: string,
  today: string,
  withRevenue: boolean,
): SincePublishRow[] {
  const stages = windowsAfterPublish.map((stage): SincePublishRow => {
    const range = publishDay ? rangeAfterPublish(stage, publishDay, today) : null
    const inStage = range
      ? days.filter(({ day }) => day >= range.startDate && day <= range.endDate)
      : []
    return {
      stage,
      ...sumOf(inStage, withRevenue),
      ...partialOf(stage, publishDay, processedThrough),
    }
  })
  return [...stages, { stage: 'lifetime', ...lifetime }]
}

type Read<V> = { ok: true; value: V } | { ok: false; refusal: ReadRefusal }

/**
 * The video's days from its publish day to the last processed day, in one query: with each day's
 * revenue when a currency is given, and without it when the channel turns out to have no revenue
 * consent or to be outside the YouTube Partner Program.
 */
async function sincePublishDaysOf(
  readChannel: ReadChannel,
  request: DateRange & { videoId: string },
  currency: RevenueCurrency | null,
): Promise<Read<{ days: SincePublishDay[]; withRevenue: boolean }>> {
  if (currency) {
    const withRevenue = await readChannel('videoDailySeriesWithRevenue', { ...request, currency })
    if (withRevenue.ok) return { ok: true, value: { days: withRevenue.value, withRevenue: true } }
    if (!isRevenueRefusal(withRevenue.refusal)) return withRevenue
  }
  const days = await readChannel('videoDailySeries', request)
  if (!days.ok) return days
  return { ok: true, value: { days: days.value, withRevenue: false } }
}

/**
 * The video's stages since publish, which do not depend on the window. The stages read one query
 * by day, from the publish day to the last processed day; a video Google has processed no day of,
 * a scheduled one included, makes no query and has zeros, with no revenue on any row whatever the
 * currency. Lifetime reads YouTube's own totals over `lifetimeRange`, the range the lifetime window
 * reads, so the two share their cache entries.
 *
 * With a currency, the detail's revenue answered, and every row carries revenue in it. A revenue
 * read refused for want of consent or for a channel outside the YouTube Partner Program leaves
 * revenue off every row; any other refusal refuses the detail.
 */
export async function readSincePublish(
  readChannel: ReadChannel,
  videoId: string,
  publishDay: string | null,
  lifetimeRange: DateRange,
  processedThrough: string,
  today: string,
  currency: RevenueCurrency | null,
): Promise<Read<SincePublish>> {
  const rowsOf = (days: SincePublishDay[], lifetime: StageNumbers, withRevenue: boolean) =>
    sincePublishRowsOf(days, lifetime, publishDay, processedThrough, today, withRevenue)
  const processed = daysProcessedSince(publishDay, processedThrough)
  const daysSincePublish = processed > 0 ? processed : undefined
  const answer = (rows: SincePublishRow[], withRevenue: boolean): Read<SincePublish> => ({
    ok: true,
    value: {
      rows,
      ...(withRevenue && currency ? { revenueCurrency: currency } : {}),
      ...(daysSincePublish === undefined ? {} : { daysSincePublish }),
    },
  })

  // Google refuses a range that ends before it starts, and has no revenue to give for a video it has
  // processed no day of (#167).
  if (!publishDay || daysSincePublish === undefined) {
    return answer(rowsOf([], zerosOf(false), false), false)
  }

  const days = await sincePublishDaysOf(
    readChannel,
    { startDate: publishDay, endDate: processedThrough, videoId },
    currency,
  )
  if (!days.ok) return days
  const lifetimeRequest = { ...lifetimeRange, videoId }
  const summary = await readChannel('videoWindowSummary', lifetimeRequest)
  if (!summary.ok) return summary
  const lifetime: StageNumbers = {
    engagedViews: summary.value?.engagedViews ?? 0,
    views: summary.value?.views ?? 0,
    estimatedMinutesWatched: summary.value?.estimatedMinutesWatched ?? 0,
  }

  let withRevenue = days.value.withRevenue
  if (withRevenue && currency) {
    const revenue = await readChannel('videoWindowRevenue', { ...lifetimeRequest, currency })
    if (revenue.ok) lifetime.estimatedRevenue = revenue.value.estimatedRevenue
    else if (isRevenueRefusal(revenue.refusal)) withRevenue = false
    else return revenue
  }
  return answer(rowsOf(days.value.days, lifetime, withRevenue), withRevenue)
}
