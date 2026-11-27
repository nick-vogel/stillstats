import {
  type ChartCard,
  type ChartMode,
  type RevenueCurrency,
  rpmRevenueOf,
} from '@creator-analytics/api-types'
import type { RpmOptions } from './cards.ts'
import type { HoverCard } from './chart-slider.ts'
import { ctrTextOf, dayCtrOf, daysCarryHistory, historyText, impressionsOf } from './history.ts'
import type { ProductEvent } from './landing.ts'
import { axisMoneyTextOf, moneyTextOf, rpmOf } from './revenue.ts'
import {
  axisCountTextOf,
  axisLabelOf,
  type ChartDay,
  type ChartPoint,
  daysCarryRevenue,
  viewsChartOf,
} from './views-chart.ts'
import { axisWatchHoursTextOf, watchHoursTextOf } from './watch-hours.ts'

// The text is approved word for word in creator-analytics#82. Change it only with Nick.
export const metricChartsText = {
  headings: {
    engagedViews: 'Engaged views and views',
    watchTime: 'Watch hours',
    revenue: 'Estimated revenue',
    // Approved word for word on 2026-11-04, in creator-analytics#356.
    rpm: 'RPM',
    impressions: historyText.impressions,
    ctr: historyText.ctr,
  } satisfies Record<ChartCard, string>,
  modes: { daily: 'Daily', aggregate: 'Running total' } satisfies Record<ChartMode, string>,
  modesLabel: 'Show numbers as',
  runningTotalNote:
    'The running total adds the daily numbers, so its last point can differ from the totals above.',
  hoverLabels: { watchTime: 'Watch hours', revenue: 'Estimated revenue', rpm: 'RPM' },
}

/**
 * On a screen too small to stack the charts, the card whose chart shows, and a way for a card to
 * choose another.
 */
export interface ChartCardChoice {
  chosen: ChartCard
  choose(card: ChartCard): void
  /** The charts the days draw: only their cards choose. */
  charts: ChartCard[]
}

/** One number's line on its own scale: the number at its top edge. */
export interface MetricLine {
  top: number
  /** The number at the bottom edge, the lowest day, when a day is below zero. Absent: zero. */
  bottom?: number
}

/** The engaged views chart's two lines, on one scale: the number at its top edge. */
export interface EngagedViewsLines {
  top: number
}

/** The stacked charts' lines over the same drawn days, which share one x axis. */
export interface MetricLines {
  /** The drawn days, one array for every chart, so one point reads them all. */
  points: ChartPoint[]
  engagedViews: EngagedViewsLines
  /** The top is in minutes, as the days carry them, and shows as watch hours. */
  watchTime: MetricLine
  /**
   * Null when the days carry no revenue: without revenue consent, for a channel outside the YouTube
   * Partner Program, and for days the API sends no revenue on.
   */
  revenue: MetricLine | null
  /** The RPM line's scale, over the days that have an RPM. Null exactly when `revenue` is. */
  rpm: MetricLine | null
  /**
   * Null when the days carry no stored history: a free channel, or a paid one whose history holds
   * none of them. Its scale is over the days the history holds.
   */
  impressions: MetricLine | null
  /** The CTR line's scale, from 0 to 1, over the days with a CTR. Null exactly when `impressions` is. */
  ctr: MetricLine | null
}

/** A day's estimated revenue, or 0 for a day that carries none. */
export function revenueOf(day: ChartDay): number {
  return 'estimatedRevenue' in day ? (day.estimatedRevenue ?? 0) : 0
}

/**
 * A drawn day's RPM under #244's rule: the revenue `rpmRevenueOf` counts over its engaged views,
 * times 1,000, or null with no engaged views or no revenue on the day. That revenue is the
 * estimated revenue, or ads plus YouTube Premium with the RPM switch on (`adsAndPremiumOnly`), a
 * missing source amount as 0. A running total day carries the sums up to it, so there it is the RPM
 * to date, never a running sum of daily RPM.
 */
export function dayRpmOf(day: ChartDay, adsAndPremiumOnly = false): number | null {
  if (!('estimatedRevenue' in day)) return null
  const amounts = {
    estimatedRevenue: revenueOf(day),
    estimatedAdRevenue: day.estimatedAdRevenue ?? 0,
    estimatedRedPartnerRevenue: day.estimatedRedPartnerRevenue ?? 0,
  }
  return rpmOf(rpmRevenueOf(amounts, adsAndPremiumOnly), day.engagedViews)
}

/**
 * One number over the drawn days, on its own scale from zero, or from the lowest day when one is
 * below zero, as revenue can be after a refund, up to the highest day, or zero when every day is
 * below it.
 */
function lineOf(values: number[]): MetricLine {
  const top = Math.max(0, ...values)
  const bottom = Math.min(0, ...values)
  return bottom < 0 ? { top, bottom } : { top }
}

/**
 * Engaged views and views, watch hours, estimated revenue and RPM, and impressions and CTR over
 * the window's days in one mode, each on its own scale and every one over the same days, or null
 * with no day. The API puts revenue on the days exactly when the revenue part answered, so the
 * revenue and RPM charts are there only then, and the history on the days a paid channel's history
 * holds, so the impressions and CTR charts are there only then. The RPM scale follows the RPM
 * switch (`adsAndPremiumOnly`), off by default.
 */
export function metricChartsOf(
  days: ChartDay[],
  mode: ChartMode,
  { adsAndPremiumOnly = false }: RpmOptions = {},
): MetricLines | null {
  const views = viewsChartOf(days, mode)
  if (!views) return null
  const drawn = views.points.map(({ day }) => day)
  const earning = daysCarryRevenue(drawn)
  const held = daysCarryHistory(drawn)
  const present = (values: (number | null)[]) =>
    values.filter((value): value is number => value !== null)
  return {
    points: views.points,
    engagedViews: { top: views.top },
    watchTime: lineOf(drawn.map(({ estimatedMinutesWatched }) => estimatedMinutesWatched)),
    revenue: earning ? lineOf(drawn.map(revenueOf)) : null,
    rpm: earning
      ? lineOf(
          drawn
            .map((day) => dayRpmOf(day, adsAndPremiumOnly))
            .filter((rpm): rpm is number => rpm !== null),
        )
      : null,
    impressions: held ? lineOf(present(drawn.map(impressionsOf))) : null,
    ctr: held ? lineOf(present(drawn.map(dayCtrOf))) : null,
  }
}

/** A chart's y axis labels: the number at its top edge and the one at its bottom edge. */
export interface ScaleLabels {
  top: string
  bottom: string
}

/**
 * The stacked charts' y axis labels, in compact notation as the locale writes it, the revenue and
 * RPM in the answer's currency: zero at the bottom, in the locale's own digits, or the chart's
 * lowest day when one is below zero.
 * The revenue and RPM charts' are null when they do not show. The hover cards and the tables keep
 * the full numbers.
 */
export function scaleLabelsOf(
  charts: MetricLines,
  currency: RevenueCurrency | undefined,
  locale?: string,
): {
  engagedViews: ScaleLabels
  watchTime: ScaleLabels
  revenue: ScaleLabels | null
  rpm: ScaleLabels | null
  impressions: ScaleLabels | null
  ctr: ScaleLabels | null
} {
  const { engagedViews, watchTime, revenue, rpm, impressions, ctr } = charts
  const zero = axisCountTextOf(0, locale)
  const moneyLabelsOf = (line: MetricLine | null): ScaleLabels | null =>
    line && currency
      ? {
          top: axisMoneyTextOf(line.top, currency, locale),
          bottom: line.bottom === undefined ? zero : axisMoneyTextOf(line.bottom, currency, locale),
        }
      : null
  return {
    engagedViews: { top: axisCountTextOf(engagedViews.top, locale), bottom: zero },
    watchTime: { top: axisWatchHoursTextOf(watchTime.top, locale), bottom: zero },
    revenue: moneyLabelsOf(revenue),
    rpm: moneyLabelsOf(rpm),
    impressions: impressions && { top: axisCountTextOf(impressions.top, locale), bottom: zero },
    ctr: ctr && { top: ctrTextOf(ctr.top, locale), bottom: ctrTextOf(0, locale) },
  }
}

/** The watch hours chart's hover card at a day as the chart draws it. */
export function watchHoursHoverOf(day: ChartDay, locale?: string): HoverCard {
  return {
    title: axisLabelOf(day, locale),
    values: [
      {
        label: metricChartsText.hoverLabels.watchTime,
        value: watchHoursTextOf(day.estimatedMinutesWatched, locale),
      },
    ],
  }
}

/** The revenue chart's hover card at a day as the chart draws it, in the answer's currency. */
export function revenueHoverOf(
  day: ChartDay,
  currency: RevenueCurrency,
  locale?: string,
): HoverCard {
  return {
    title: axisLabelOf(day, locale),
    values: [
      {
        label: metricChartsText.hoverLabels.revenue,
        value: moneyTextOf(revenueOf(day), currency, locale),
      },
    ],
  }
}

/**
 * The RPM chart's hover card at a day as the chart draws it, in the answer's currency: the label
 * with no value on a day with no RPM, as the numbers table's empty cell. It follows the RPM switch
 * (`adsAndPremiumOnly`), off by default.
 */
export function rpmHoverOf(
  day: ChartDay,
  currency: RevenueCurrency,
  locale?: string,
  { adsAndPremiumOnly = false }: RpmOptions = {},
): HoverCard {
  const rpm = dayRpmOf(day, adsAndPremiumOnly)
  return {
    title: axisLabelOf(day, locale),
    values: [
      {
        label: metricChartsText.hoverLabels.rpm,
        value: rpm === null ? '' : moneyTextOf(rpm, currency, locale),
      },
    ],
  }
}

/** The impressions chart's hover card at a day: the label with no value on a day not held. */
export function impressionsHoverOf(day: ChartDay, locale?: string): HoverCard {
  const impressions = impressionsOf(day)
  return {
    title: axisLabelOf(day, locale),
    values: [
      {
        label: historyText.impressions,
        value: impressions === null ? '' : impressions.toLocaleString(locale),
      },
    ],
  }
}

/** The CTR chart's hover card at a day: the label with no value on a day with no CTR. */
export function ctrHoverOf(day: ChartDay, locale?: string): HoverCard {
  return {
    title: axisLabelOf(day, locale),
    values: [{ label: historyText.ctrColumn, value: ctrTextOf(dayCtrOf(day), locale) }],
  }
}

/**
 * The charts the days draw, which are the cards a screen too small to stack them lets choose: none
 * with no day, the revenue and RPM charts only when the days carry revenue, and the impressions and
 * CTR charts only when they carry the stored history.
 */
export function chartsDrawnOf(days: ChartDay[]): ChartCard[] {
  if (days.length === 0) return []
  const charts: ChartCard[] = ['engagedViews', 'watchTime']
  if (daysCarryRevenue(days)) charts.push('revenue', 'rpm')
  if (daysCarryHistory(days)) charts.push('impressions', 'ctr')
  return charts
}

/**
 * The chart a screen too small to stack them shows: the chosen card's, except revenue or RPM with
 * no revenue chart, or impressions or CTR with no history chart, which shows engaged views and
 * leaves the choice saved for when the chart returns.
 */
export function chartShownOf(
  card: ChartCard,
  revenueShown: boolean,
  historyShown = false,
): ChartCard {
  if ((card === 'revenue' || card === 'rpm') && !revenueShown) return 'engagedViews'
  if ((card === 'impressions' || card === 'ctr') && !historyShown) return 'engagedViews'
  return card
}

/** The event a card choosing a chart sends: the metric, and nothing else. */
export function chartMetricChangedEvent(metric: ChartCard): ProductEvent {
  return { name: 'chart_metric_changed', metric }
}
