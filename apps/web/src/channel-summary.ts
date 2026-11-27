import type {
  ChannelDay,
  ChannelRevenue,
  ChannelSummaryAnswer,
  ErrorAnswer,
  RefusalAnswer,
  RevenueAmounts,
  SummaryRequest,
  SummaryUpload,
  SummaryWindow,
  VideoWindow,
  Visibility,
} from '@creator-analytics/api-types'
import {
  type Card,
  ctrCardOf,
  engagedViewsCardOf,
  impressionsCardOf,
  type RpmOptions,
  revenueCardOf,
  revenueReportedIn,
  unheldHistoryCardsOf,
  watchHoursCardOf,
  withoutRevenue,
} from './cards.ts'
import { daysCarryHistory, historyNoteOf, historyPartialOf, purgeNoteOf } from './history.ts'
import type { ViewsTotal } from './numbers-table.ts'
import { isRangeRefusal, type RefusedRangeView, refusalMessageOf } from './refusals.ts'
import { noFormatNoteOf, revenueText } from './revenue.ts'
import { isWindowAfterPublish, type Route } from './route.ts'

/**
 * A window after publish runs from each video's own publish day, and a channel has none, so the
 * summary shows in lifetime and the calendar windows only. In a window after publish, the launch
 * chart, or under "Publish day" the top by publish day engaged views, takes its place, from the
 * video list's answer.
 */
export function summaryShownFor(window: VideoWindow): window is SummaryWindow {
  return !isWindowAfterPublish(window)
}

/**
 * The summary a route reads, with the visibility in force (`visibilityOf`), which its uploads
 * follow as the video list does, or none in a window after publish (`summaryShownFor`).
 */
export function summaryRequestOf(route: Route, visibility: Visibility): SummaryRequest | null {
  const { format } = route
  if (route.window === 'custom') {
    return { window: route.window, range: route.range, format, visibility }
  }
  return summaryShownFor(route.window) ? { window: route.window, format, visibility } : null
}

export type SummaryView =
  | {
      kind: 'figures'
      cards: Card[]
      /** The note under the cards on the revenue tied to no video or format, when there is any. */
      noFormatNote: string | null
      /**
       * The note under the cards on how YouTube converts revenue into the creator's currency, when
       * the summary shows revenue.
       */
      currencyNote: string | null
      /**
       * The note on a paid channel's stored history: its newest day, and its start when the range
       * starts before it. Null without the history.
       */
      historyNote: string | null
      /**
       * The note on an ended channel's history: its subscription has ended, and the day the
       * history is deleted on. Null for any other channel.
       */
      purgeNote: string | null
      daily: ChannelDay[]
      total: ViewsTotal
      lastProcessedDay: string
      /** The uploads of the window, newest first, which the upload markers show. */
      uploads: SummaryUpload[]
    }
  | { kind: 'refused'; message: string }
  | RefusedRangeView

/**
 * The summary's query: a custom range's start and end after the window. Every format leaves the
 * format out, which the API reads as `all`, and public uploads leave the visibility out, which the
 * API reads as `public`.
 */
export function summaryQueryOf({
  window,
  range,
  format,
  visibility,
}: SummaryRequest): URLSearchParams {
  const query = new URLSearchParams({ window, ...range })
  if (format !== 'all') query.set('format', format)
  if (visibility !== 'public') query.set('visibility', visibility)
  return query
}

/**
 * The revenue the numbers table's total row ends on, all of it but the no-format and every-format
 * amounts, and the currency it is in.
 */
function sourcesOf({
  noFormatRevenue: _,
  everyFormatRevenue: __,
  ...sources
}: ChannelRevenue): RevenueAmounts & Pick<ChannelRevenue, 'currency'> {
  return sources
}

/**
 * What the summary shows for the API's answer: YouTube's own totals for the channel as three cards,
 * engaged views with views under them and how many times engaged views the views are, watch hours,
 * and estimated revenue with its RPM, or why there is none; the note on the revenue tied to no
 * format and the note on the currency; the days the charts draw, the totals their numbers table
 * ends on, revenue and its currency included when it answered and YouTube reports some over the
 * span the revenue card reads, the last processed day the note under the charts names, and the
 * window's uploads, which the upload markers show. A paid channel with a stored history adds its
 * impressions and CTR cards, their partial label when the range starts before the history start,
 * the note on the history, and the history's totals for the numbers table; an ended channel's, the
 * note on its purge date too. Or a
 * refusal's text and no figure. Every amount of revenue shows in the answer's currency. The RPM
 * follows the RPM switch (`options`), off by default.
 */
export function summaryViewOf(
  body: ChannelSummaryAnswer | RefusalAnswer | ErrorAnswer,
  locale?: string,
  options: RpmOptions = {},
): SummaryView {
  if (isRangeRefusal(body)) return { kind: 'invalid-range' }
  if ('refusal' in body || 'error' in body) {
    return { kind: 'refused', message: refusalMessageOf(body, 'the channel summary') }
  }
  const { revenue } = body
  // A monetized channel's format can earn nothing, such as Live on a channel that never streams, so
  // one format's days cannot say whether YouTube reports revenue for the channel; its revenue in
  // every format over the window can.
  const revenueShown =
    !revenue.refusal &&
    (body.format === 'all' ? revenueReportedIn(body.daily) : revenue.everyFormatRevenue !== 0)
  const cards: Card[] = [
    engagedViewsCardOf(body, locale),
    watchHoursCardOf(body.estimatedMinutesWatched, locale),
    revenueCardOf(revenue, body.engagedViews, revenueShown, locale, options),
  ]
  const { history } = body
  if (history && !daysCarryHistory(body.daily)) {
    cards.push(...unheldHistoryCardsOf())
  } else if (history) {
    const partial = historyPartialOf(body.daily, history)
    cards.push(impressionsCardOf(history, partial, locale), ctrCardOf(history, partial, locale))
  }
  return {
    kind: 'figures',
    cards,
    noFormatNote: revenueShown
      ? noFormatNoteOf(revenue.noFormatRevenue, revenue.currency, locale)
      : null,
    currencyNote: revenueShown ? revenueText.currencyNote : null,
    historyNote: history ? historyNoteOf(body.daily, history, locale) : null,
    purgeNote: history ? purgeNoteOf(history, locale) : null,
    daily: revenueShown ? body.daily : body.daily.map(withoutRevenue),
    total: {
      engagedViews: body.engagedViews,
      views: body.views,
      estimatedMinutesWatched: body.estimatedMinutesWatched,
      ...(revenueShown ? sourcesOf(revenue) : {}),
      ...(history ? { impressions: history.impressions, ctr: history.ctr } : {}),
    },
    lastProcessedDay: body.lastProcessedDay,
    uploads: body.uploads,
  }
}
