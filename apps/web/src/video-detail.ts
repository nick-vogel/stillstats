import {
  type ErrorAnswer,
  pacificDayOf,
  type RefusalAnswer,
  type VideoDay,
  type VideoDetailAnswer,
  type VideoHistory,
  type VideoRevenue,
  type WindowChoice,
} from '@creator-analytics/api-types'
import {
  type Card,
  ctrCardOf,
  engagedViewsCardOf,
  impressionsCardOf,
  type RpmOptions,
  revenueCardOf,
  revenueReportedIn,
  watchHoursCardOf,
  withoutRevenue,
} from './cards.ts'
import type { Figure } from './Figures.tsx'
import type { ViewsTotal } from './numbers-table.ts'
import { partialLabelOf } from './processing.ts'
import { isRangeRefusal, type RefusedRangeView, refusalMessageOf } from './refusals.ts'
import { revenueText } from './revenue.ts'
import type { SincePublishKnown } from './since-publish.ts'
import { averageViewedColumn, subscribersGainedColumn } from './video-list.ts'

export type VideoDetailView =
  | { kind: 'detail'; answer: VideoDetailAnswer }
  | { kind: 'refused'; message: string }
  | RefusedRangeView

/** The query the detail is read with: the window, and a custom range's start and end after it. */
export function videoDetailQueryOf({ window, range }: WindowChoice) {
  return new URLSearchParams({ window, ...range })
}

/**
 * What the detail screen shows for the API's answer: the video, or a refusal's text, or for a
 * custom range refused for its bounds, the fall back to the last 28 days.
 */
export function videoDetailViewOf(
  body: VideoDetailAnswer | RefusalAnswer | ErrorAnswer,
): VideoDetailView {
  if ('video' in body) return { kind: 'detail', answer: body }
  if (isRangeRefusal(body)) return { kind: 'invalid-range' }
  return {
    kind: 'refused',
    // Approved word for word in creator-analytics#55. Change it only with Nick.
    message: refusalMessageOf(body, 'the video', {
      video_not_found: 'This video is not on this channel.',
    }),
  }
}

/**
 * The view the screen shows for `video`: none while the view held is another video's detail, as it
 * is on the first render after a step, before the read for the new video clears it. Otherwise the
 * previous video's head and sections would show, and take the title's focus, under the new address.
 */
export function viewOfVideo(view: VideoDetailView | null, video: string): VideoDetailView | null {
  return view?.kind === 'detail' && view.answer.video.id !== video ? null : view
}

export const watchOnYouTubeText = 'Watch on YouTube'

export function youtubeWatchUrlOf(videoId: string): string {
  return `https://www.youtube.com/watch?${new URLSearchParams({ v: videoId })}`
}

/**
 * The detail screen's headline numbers: two or three cards, and the impressions and CTR cards with a
 * paid channel's history, then two smaller figures.
 */
export interface Headline {
  cards: Card[]
  figures: Figure[]
}

const smallerColumns = [averageViewedColumn, subscribersGainedColumn]

/**
 * The video's engaged views card, with its views and how many times engaged views they are, and
 * its watch hours card, then, when the answer carries revenue, the channel summary's revenue card
 * for the video, with its RPM, or why there is no revenue; then, with a paid channel's history and
 * a traffic source to show it beside, the video's impressions and CTR cards, each with the partial
 * label on a range the history holds only some days of (creator-analytics#1048). Those two draw no
 * chart on this screen, so they never choose one. Then average viewed and subscribers gained as
 * smaller figures. The RPM follows the RPM switch (`options`), off by default.
 */
export function headlineOf(
  answer: VideoDetailAnswer,
  locale?: string,
  options: RpmOptions = {},
): Headline {
  const { totals, revenue, days } = answer
  const reach = historyShownOf(answer)
  const partial = reach ? partialLabelOf(reach) : null
  return {
    cards: [
      engagedViewsCardOf(totals, locale),
      watchHoursCardOf(totals.estimatedMinutesWatched, locale),
      ...(revenue
        ? [revenueCardOf(revenue, totals.engagedViews, revenueReportedIn(days), locale, options)]
        : []),
      ...(reach
        ? [impressionsCardOf(reach, partial, locale), ctrCardOf(reach, partial, locale)].map(
            ({ chart: _chart, ...card }) => card,
          )
        : []),
    ],
    figures: smallerColumns.map(({ label, textOf }) => ({ label, text: textOf(totals, locale) })),
  }
}

/**
 * How many cards the detail's placeholder holds places for, as far as the page knows the video:
 * the engaged views and watch hours cards, and the revenue card's place when the answer will carry
 * revenue. It mirrors the API's rule for leaving revenue out (apps/api/src/video-detail.ts, where
 * `revenue` is read): no revenue for a video with no publish day, in any window, nor for a window
 * with no day of the video's, which for a video Google has processed is only a custom range that
 * ends before its publish day. A revenue refusal still makes a card (`headlineOf`), so it keeps its
 * place. A video awaiting processing has its own placeholder, and a video the page knows nothing
 * of holds every card's place.
 */
export function detailCardCountOf(
  known: SincePublishKnown | undefined,
  { window, range }: WindowChoice,
): number {
  if (known === undefined) return 3
  if (known.publishedAt === null) return 2
  if (window === 'custom' && range.to < pacificDayOf(known.publishedAt)) return 2
  return 3
}

/**
 * The video's impressions and CTR history when the screen shows it: a paid channel's history, with
 * a traffic source to show it beside. The headline's two cards and the impressions table show
 * exactly then.
 */
export function historyShownOf({
  history,
  trafficSources,
}: Pick<VideoDetailAnswer, 'history' | 'trafficSources'>): VideoHistory | null {
  return history && trafficSources.length > 0 ? history : null
}

function revenueShownOf({ revenue, days }: VideoDetailAnswer): VideoRevenue | null {
  return revenue && !revenue.refusal && revenueReportedIn(days) ? revenue : null
}

/** The note under the cards on how YouTube converts revenue, when the video's revenue shows. */
export function detailCurrencyNoteOf(answer: VideoDetailAnswer): string | null {
  return revenueShownOf(answer) ? revenueText.currencyNote : null
}

/**
 * The total the numbers table under the charts ends on: YouTube's own totals for the video, with
 * its revenue and the currency it is in when the video's revenue shows.
 */
export function detailTotalOf(answer: VideoDetailAnswer): ViewsTotal {
  const revenue = revenueShownOf(answer)
  return revenue ? { ...answer.totals, ...revenue } : answer.totals
}

export function detailDaysOf(answer: VideoDetailAnswer): VideoDay[] {
  return revenueShownOf(answer) ? answer.days : answer.days.map(withoutRevenue)
}
