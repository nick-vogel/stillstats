import { addDays } from './days.ts'
import type { Freshness } from './freshness.ts'
import type { PartialWindow, VideoRow } from './videos.ts'

/**
 * The figures a sponsor report can show, in the order it shows them, each named as Google's
 * Analytics API names the metric. None is a revenue figure.
 */
export const sponsorFigures = [
  'views',
  'engagedViews',
  'estimatedMinutesWatched',
  'averageViewDuration',
  'averageViewPercentage',
  'likes',
  'comments',
  'shares',
  'subscribersGained',
] as const

export type SponsorFigure = (typeof sponsorFigures)[number]

/**
 * The figures a sponsor report takes from the channel's stored history rather than from Google's
 * Analytics API: the video's impressions and their click-through rate. They show only for a
 * channel whose history is readable, and only in a window the history holds every day of.
 */
export const sponsorHistoryFigures = ['impressions', 'ctr'] as const

export type SponsorHistoryFigure = (typeof sponsorHistoryFigures)[number]

/** Every figure a sponsor report can show, in report order: the nine, then impressions and CTR. */
export const sponsorReportFigures = [...sponsorFigures, ...sponsorHistoryFigures] as const

export type SponsorReportFigure = (typeof sponsorReportFigures)[number]

/**
 * The revenue figures a sponsor report refuses: Google's monetary metrics for a video report, and
 * the product's own RPM and revenue. A sponsor report never carries a creator's earnings.
 */
export const sponsorRevenueFigures = [
  'estimatedRevenue',
  'estimatedAdRevenue',
  'grossRevenue',
  'estimatedRedPartnerRevenue',
  'monetizedPlaybacks',
  'playbackBasedCpm',
  'adImpressions',
  'cpm',
  'rpm',
  'revenue',
] as const

/** The sponsor report's windows: the video's first 7, 14 and 30 days, the publish day as day 1. */
export const sponsorWindowDays = [7, 14, 30] as const

export type SponsorWindowDays = (typeof sponsorWindowDays)[number]

/**
 * The last day of a sponsor report window of `days` days, YYYY-MM-DD: the earlier of day `days`,
 * the publish day as day 1, and the last processed day.
 */
export function sponsorWindowEndOf(
  days: number,
  publishDay: string,
  lastProcessedDay: string,
): string {
  const lastDay = addDays(publishDay, days - 1)
  return lastDay < lastProcessedDay ? lastDay : lastProcessedDay
}

/** Why the `figures` of a sponsor report's query, or of its stored choice, are refused. */
export type SponsorFiguresFault = 'revenue_figure' | 'invalid_figure'

const isReportFigure = (item: unknown): item is SponsorReportFigure =>
  (sponsorReportFigures as readonly unknown[]).includes(item)

const isRevenueFigure = (item: unknown): boolean =>
  (sponsorRevenueFigures as readonly unknown[]).includes(item)

/**
 * A list of figure names as report figures, in report order, each once. A revenue figure anywhere
 * refuses it as `revenue_figure`, before any other fault; any other name refuses it as
 * `invalid_figure`.
 */
const reportFiguresOf = (
  items: readonly unknown[],
): { figures: SponsorReportFigure[] } | { fault: SponsorFiguresFault } => {
  if (items.some(isRevenueFigure)) return { fault: 'revenue_figure' }
  if (!items.every(isReportFigure)) return { fault: 'invalid_figure' }
  return { figures: sponsorReportFigures.filter((figure) => items.includes(figure)) }
}

/**
 * The figures a sponsor report's `figures` query asks for, a comma list of figure names: all nine
 * when absent, else the listed ones in report order, each once. A revenue figure anywhere in the
 * list refuses it as `revenue_figure`, before any other fault; an empty item or any other name
 * refuses it as `invalid_figure`.
 */
export const sponsorFiguresOf = (
  text: string | undefined,
): { figures: SponsorReportFigure[] } | { fault: SponsorFiguresFault } =>
  text === undefined ? { figures: [...sponsorFigures] } : reportFiguresOf(text.split(','))

/**
 * The body of PUT /api/channels/:channelId/sponsor-figures, `{ figures: [...] }` and no other key:
 * at least one figure, answered in report order, each once. A revenue figure anywhere refuses it as
 * `revenue_figure`; any other shape, an empty list, or an unknown name, as `invalid_figure`.
 */
export const sponsorChoiceOf = (
  body: unknown,
): { figures: SponsorReportFigure[] } | { fault: SponsorFiguresFault } => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { fault: 'invalid_figure' }
  }
  const keys = Object.keys(body)
  const { figures } = body as { figures?: unknown }
  if (keys.length !== 1 || !Array.isArray(figures) || figures.length === 0) {
    return { fault: 'invalid_figure' }
  }
  return reportFiguresOf(figures)
}

/** PUT /api/channels/:channelId/sponsor-figures: the channel's stored choice, in report order. */
export interface SponsorChoiceAnswer {
  figures: SponsorReportFigure[]
}

/** One window of a sponsor report. */
export interface SponsorWindow {
  days: SponsorWindowDays
  /**
   * Google's own totals over the window's days, only the chosen figures. Average view duration is
   * in seconds, average view percentage from 0 to 100, as Google reports them.
   */
  numbers: Partial<Record<SponsorFigure, number>> & {
    /** From the stored history: the video's impressions over the window's days. */
    impressions?: number
    /**
     * From the stored history: the window's views from impressions over its impressions, from 0
     * to 1. Null when the window holds no impression.
     */
    ctr?: number | null
  }
  /** When Google has not processed the window to its end for the video: the days it holds. */
  partial?: PartialWindow
  /**
   * When impressions or CTR was chosen and the stored history does not hold every day of the
   * window's days: the days it holds of them. The window then carries no impressions and no CTR.
   */
  historyPartial?: PartialWindow
}

/**
 * GET /api/channels/:channelId/videos/:videoId/sponsor-report: one video's first 7, 14 and 30 days
 * from its publish day, each up to the last processed day. Free for every channel, and it carries
 * no revenue figure. Freshness is that of the oldest read.
 */
export interface SponsorReportAnswer extends Freshness {
  video: Pick<
    VideoRow,
    'id' | 'title' | 'thumbnailUrl' | 'thumbnails' | 'publishedAt' | 'scheduled'
  >
  /**
   * The figures the report shows, in report order: impressions and CTR only when `history` is
   * present.
   */
  figures: SponsorReportFigure[]
  /** One per `sponsorWindowDays`, in that order. */
  windows: SponsorWindow[]
  /**
   * YYYY-MM-DD: the newest day Google has processed for the channel. Each window's data runs
   * through the earlier of its own last day and this one (`sponsorWindowEndOf`).
   */
  lastProcessedDay: string
  /**
   * True when Google has processed no day since the video was published, a scheduled video
   * included. Every window then holds zeros and 0 days.
   */
  awaitingProcessing: boolean
  /**
   * Present exactly when the channel's history is readable (a paid channel, or an ended one before
   * its purge date) and holds a day: its first and newest day, YYYY-MM-DD. Impressions and CTR are
   * offered only then.
   */
  history?: { firstDay: string; newestDay: string }
}
