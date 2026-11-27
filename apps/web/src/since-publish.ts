import {
  isWindowFinished,
  pacificDayOf,
  type SincePublish,
  type SincePublishRow,
  type SincePublishStage,
  type VideoRow,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import { revenueReportedIn } from './cards.ts'
import { dayCountOf } from './processing.ts'
import { moneyTextOf } from './revenue.ts'
import { sortAnnouncementOf, type TableSort } from './tables.ts'
import { watchHoursTextOf } from './watch-hours.ts'

/** The columns the since publish table can show, after the stage. */
export type SincePublishColumn =
  | 'engagedViews'
  | 'views'
  | 'estimatedMinutesWatched'
  | 'estimatedRevenue'

// The text is approved word for word in creator-analytics#81. Change it only with Nick.
export const sincePublishText = {
  heading: 'Since publish',
  stages: {
    first1: 'Publish day',
    first7: 'First 7 days',
    first28: 'First 28 days',
    first90: 'First 90 days',
    first365: 'First 365 days',
    lifetime: 'Lifetime',
  } satisfies Record<SincePublishStage, string>,
  columns: {
    engagedViews: 'Engaged views',
    views: 'Views',
    estimatedMinutesWatched: 'Watch hours',
    estimatedRevenue: 'Estimated revenue',
  } satisfies Record<SincePublishColumn, string>,
}

// Approved word for word in creator-analytics#119 (W35). Change it only with Nick.
function ageTextOf(days: number): string {
  return `${dayCountOf(days)} since publish`
}

/** How the since publish table is sorted: by one column, highest first, or lowest first. */
export type SincePublishSort = TableSort<SincePublishColumn>

export const defaultSincePublishSort: SincePublishSort = {
  column: 'engagedViews',
  direction: 'descending',
}

/** The table's sort, named by its column's heading, as a screen reader announces it. */
export function sincePublishSortLabelOf({ column, direction }: SincePublishSort): string {
  return sortAnnouncementOf(sincePublishText.columns[column], direction === 'descending', false)
}

export interface SincePublishTableRow {
  /** The stage's name, which also keys the row. */
  stage: string
  /** The line under the stage's name: the video's age under Lifetime, else null. */
  note: string | null
  cells: Partial<Record<SincePublishColumn, string>>
}

export interface SincePublishTable {
  /**
   * In order, after the stage. Estimated revenue shows only when YouTube reports revenue for some
   * stage.
   */
  columns: { column: SincePublishColumn; heading: string }[]
  rows: SincePublishTableRow[]
}

const countColumns = ['engagedViews', 'views', 'estimatedMinutesWatched'] as const

/**
 * The since publish table: each stage the video has finished, and lifetime, in the sort's order,
 * stages that tie in the answer's order. A stage the video has not finished covers the same days as
 * lifetime, so it is left out. Counts as the locale writes them, watch time as watch hours, revenue
 * in the currency the rows carry it in, and the video's age under Lifetime.
 */
export function sincePublishTableOf(
  { rows, revenueCurrency, daysSincePublish }: SincePublish,
  sort: SincePublishSort,
  locale?: string,
): SincePublishTable {
  const currency = revenueCurrency && revenueReportedIn(rows) ? revenueCurrency : undefined
  const columns: SincePublishColumn[] = currency
    ? [...countColumns, 'estimatedRevenue']
    : [...countColumns]
  const sign = sort.direction === 'ascending' ? 1 : -1
  const sortValueOf = (row: SincePublishRow) => row[sort.column] ?? 0
  const shown = rows
    .filter((row) => !row.partial)
    .toSorted((a, b) => sign * (sortValueOf(a) - sortValueOf(b)))
  return {
    columns: columns.map((column) => ({ column, heading: sincePublishText.columns[column] })),
    rows: shown.map((row) => ({
      stage: sincePublishText.stages[row.stage],
      note:
        row.stage === 'lifetime' && daysSincePublish !== undefined
          ? ageTextOf(daysSincePublish)
          : null,
      cells: {
        engagedViews: row.engagedViews.toLocaleString(locale),
        views: row.views.toLocaleString(locale),
        estimatedMinutesWatched: watchHoursTextOf(row.estimatedMinutesWatched, locale),
        ...(currency
          ? { estimatedRevenue: moneyTextOf(row.estimatedRevenue ?? 0, currency, locale) }
          : {}),
      },
    })),
  }
}

/**
 * What the page knows of a video's age from an answer it holds: its publish date, and the day the
 * answer counts to.
 */
export interface SincePublishKnown {
  publishedAt: string | null
  /** The answer's last processed day, which the API counts a stage's days to. */
  lastProcessedDay: string
}

/**
 * The since publish placeholder's rows, its heading row included, as the table will show them: each
 * stage the video has finished and lifetime. The publish day and the finished rule are the API's
 * own, read from api-types: `pacificDayOf` gives the publish day the API counts the stages from, and
 * `isWindowFinished` is the rule its `partialOf` applies. A video the page knows nothing of holds
 * every stage.
 */
export function sincePublishPlaceholderRowsOf(known: SincePublishKnown | undefined): number {
  if (known === undefined) return windowsAfterPublish.length + 2
  const publishDay = known.publishedAt === null ? null : pacificDayOf(known.publishedAt)
  return (
    windowsAfterPublish.filter((stage) =>
      isWindowFinished(stage, publishDay, known.lastProcessedDay),
    ).length + 2
  )
}

// The videos the page has had an answer for, by id: the list unmounts when a video's screen opens,
// and the screen has only the id from the address. YouTube ids are unique across channels.
const knownVideos = new Map<string, SincePublishKnown>()

/** Remembers each video's publish date from an answer, replacing what an earlier answer said. */
export function rememberSincePublishOf(
  videos: readonly Pick<VideoRow, 'id' | 'publishedAt'>[],
  lastProcessedDay: string,
): void {
  for (const { id, publishedAt } of videos) knownVideos.set(id, { publishedAt, lastProcessedDay })
}

/** What the page last had answered of a video's age, or nothing when it has had no answer for it. */
export function sincePublishKnownFor(videoId: string): SincePublishKnown | undefined {
  return knownVideos.get(videoId)
}

/** The since publish placeholder's rows for a video, from what the page last had answered for it. */
export function sincePublishPlaceholderRowsFor(videoId: string): number {
  return sincePublishPlaceholderRowsOf(sincePublishKnownFor(videoId))
}
