import {
  type ErrorAnswer,
  pacificDayOf,
  type RefusalAnswer,
  type SponsorFigure,
  type SponsorReportAnswer,
  type SponsorReportFigure,
  type SponsorWindow,
  type SponsorWindowDays,
  sponsorFigures,
  sponsorHistoryFigures,
  sponsorReportFigures,
  sponsorWindowDays,
  sponsorWindowEndOf,
} from '@creator-analytics/api-types'
import { ctrTextOf, historyText } from './history.ts'
import type { ProductEvent } from './landing.ts'
import { failedSaveNotice } from './preferences.ts'
import { longDateOf, partialLabelOf } from './processing.ts'
import { refusalMessageOf } from './refusals.ts'
import { timeLabelOf } from './retention.ts'
import { watchHoursTextOf } from './watch-hours.ts'

export const sponsorReportText = 'Sponsor report'
export const savePdfText = 'Save as PDF'
export const backToVideoText = 'Back to video'
export const sponsorSourceLine = 'Figures from YouTube, through Stillstats.'
// Approved in creator-analytics#938.
export const sponsorChoiceLegend = 'Figures to include'
export const notStoredText = 'Not stored'
export const noCtrText = 'None'

/** The read of a video's sponsor report, every figure: it sends no `figures` parameter. */
export function sponsorReportPathOf(channelId: string, video: string): string {
  return `/api/channels/${channelId}/videos/${encodeURIComponent(video)}/sponsor-report`
}

/** The PUT of the channel's stored figure choice. */
export function sponsorChoicePathOf(channelId: string): string {
  return `/api/channels/${channelId}/sponsor-figures`
}

/** What the page shows for a refused save of the figure choice. */
export function sponsorChoiceFailureOf(body: RefusalAnswer | ErrorAnswer): string {
  return refusalMessageOf(body, 'the sponsor report', {
    invalid_figure: failedSaveNotice,
    revenue_figure: failedSaveNotice,
    internal: failedSaveNotice,
  })
}

export type SponsorReportView =
  | { kind: 'report'; answer: SponsorReportAnswer }
  | { kind: 'refused'; message: string }

/** What the page shows for the API's answer: the report, or a refusal's text. */
export function sponsorReportViewOf(
  body: SponsorReportAnswer | RefusalAnswer | ErrorAnswer,
): SponsorReportView {
  if ('windows' in body) return { kind: 'report', answer: body }
  return {
    kind: 'refused',
    message: refusalMessageOf(body, 'the sponsor report', {
      video_not_found: 'This video is not on this channel.',
    }),
  }
}

/** Each figure's row label, as the rest of the app names it where it does. */
const figureLabels: Record<SponsorReportFigure, string> = {
  views: 'Views',
  engagedViews: 'Engaged views',
  estimatedMinutesWatched: 'Watch hours',
  averageViewDuration: 'Average view duration',
  averageViewPercentage: 'Average view percentage',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  subscribersGained: 'Subscribers gained',
  impressions: historyText.impressions,
  ctr: historyText.ctr,
}

const isHistoryFigure = (figure: SponsorReportFigure): boolean =>
  (sponsorHistoryFigures as readonly string[]).includes(figure)

/**
 * A figure's value as the page writes it: watch time in hours with one decimal, as the watch hours
 * card writes it; average view duration as a time, "3:04"; average view percentage as a percent
 * with up to one decimal; every other figure as a whole count in the locale's digits.
 */
export function sponsorFigureTextOf(figure: SponsorFigure, value: number, locale?: string): string {
  if (figure === 'estimatedMinutesWatched') return watchHoursTextOf(value, locale)
  if (figure === 'averageViewDuration') return timeLabelOf(value, locale)
  if (figure === 'averageViewPercentage') {
    return (value / 100).toLocaleString(locale, { style: 'percent', maximumFractionDigits: 1 })
  }
  return value.toLocaleString(locale)
}

export function sponsorWindowHeadingOf(days: SponsorWindowDays): string {
  return `First ${days} days`
}

export interface SponsorTable {
  /** One per window: its heading, and for a window Google has not processed whole, its days. */
  headings: { heading: string; note: string | null }[]
  /** One per figure the report shows, in report order: its label, then its value in each window. */
  rows: { label: string; cells: string[] }[]
  /**
   * When impressions or CTR shows and the stored history does not hold every day of a window: why
   * that window reads "Not stored", and the history's days.
   */
  historyNote: string | null
}

/**
 * A figure's cell in a window: impressions as a whole count, CTR as a percent with one decimal or
 * "None" with no impressions, both "Not stored" in a window the history does not hold whole; the
 * other figures as `sponsorFigureTextOf` writes them.
 */
function sponsorCellOf(
  figure: SponsorReportFigure,
  window: SponsorWindow,
  locale?: string,
): string {
  if (figure === 'impressions' || figure === 'ctr') {
    if (window.historyPartial) return notStoredText
    if (figure === 'impressions') return (window.numbers.impressions ?? 0).toLocaleString(locale)
    const ctr = window.numbers.ctr ?? null
    return ctr === null ? noCtrText : ctrTextOf(ctr, locale)
  }
  return sponsorFigureTextOf(figure, window.numbers[figure] ?? 0, locale)
}

function historyNoteOf(answer: SponsorReportAnswer, locale?: string): string | null {
  const { history } = answer
  if (!history || !answer.figures.some(isHistoryFigure)) return null
  if (!answer.windows.some((window) => window.historyPartial)) return null
  return `Impressions and click-through rate show only in a window the stored history holds every day of. The history runs from ${longDateOf(history.firstDay, locale)} to ${longDateOf(history.newestDay, locale)}.`
}

export function sponsorTableOf(answer: SponsorReportAnswer, locale?: string): SponsorTable {
  return {
    headings: answer.windows.map((window) => ({
      heading: sponsorWindowHeadingOf(window.days),
      note: partialLabelOf(window),
    })),
    rows: answer.figures.map((figure) => ({
      label: figureLabels[figure],
      cells: answer.windows.map((window) => sponsorCellOf(figure, window, locale)),
    })),
    historyNote: historyNoteOf(answer, locale),
  }
}

/** One box of the figure checklist. */
export interface SponsorChecklistItem {
  figure: SponsorReportFigure
  label: string
  checked: boolean
  /** The only ticked box, so the choice is never empty. */
  disabled: boolean
}

/**
 * The checklist over the report's table: the nine, then impressions and CTR when the channel's
 * history is readable, each ticked when `chosen` holds it, the report's own figures unless given.
 */
export function sponsorChecklistOf(
  answer: Pick<SponsorReportAnswer, 'figures' | 'history'>,
  chosen: readonly SponsorReportFigure[] = answer.figures,
): SponsorChecklistItem[] {
  const offered = answer.history ? sponsorReportFigures : sponsorFigures
  const ticked = offered.filter((figure) => chosen.includes(figure))
  return offered.map((figure) => ({
    figure,
    label: figureLabels[figure],
    checked: ticked.includes(figure),
    disabled: ticked.length === 1 && ticked[0] === figure,
  }))
}

/** The choice after a box is ticked or unticked, in report order. */
export function nextChoiceOf(
  chosen: readonly SponsorReportFigure[],
  figure: SponsorReportFigure,
  on: boolean,
): SponsorReportFigure[] {
  return sponsorReportFigures.filter((each) => (each === figure ? on : chosen.includes(each)))
}

/**
 * The line naming the day the data runs through: the last day of the longest window, counted from
 * the publish day the API counts it from (`pacificDayOf`), so an older video's ends on its 30th
 * day. A video with no publish date runs through the last day Google has processed.
 */
export function sponsorDataThroughOf(
  { video, lastProcessedDay }: Pick<SponsorReportAnswer, 'video' | 'lastProcessedDay'>,
  locale?: string,
): string {
  const day =
    video.publishedAt === null
      ? lastProcessedDay
      : sponsorWindowEndOf(
          Math.max(...sponsorWindowDays),
          pacificDayOf(video.publishedAt),
          lastProcessedDay,
        )
  return `Data through ${longDateOf(day, locale)}`
}

/**
 * The video's publish date, or the date it is scheduled for: the Pacific day the windows count from
 * (`pacificDayOf`), in the reader's long date format.
 */
export function sponsorPublishedOf(
  { publishedAt, scheduled }: Pick<SponsorReportAnswer['video'], 'publishedAt' | 'scheduled'>,
  locale?: string,
): string | null {
  if (!publishedAt) return null
  const date = longDateOf(pacificDayOf(publishedAt), locale)
  return scheduled ? `Scheduled for ${date}` : `Published ${date}`
}

/** The event "Save as PDF" sends: the count of figures the report shows. */
export function sponsorExportEventOf(answer: Pick<SponsorReportAnswer, 'figures'>): ProductEvent {
  return { name: 'sponsor_export_downloaded', figures: answer.figures.length }
}
