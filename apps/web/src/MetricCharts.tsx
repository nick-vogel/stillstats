import type { ChartCard, RevenueCurrency, SummaryUpload } from '@creator-analytics/api-types'
import { Fragment, type ReactNode, useMemo, useSyncExternalStore } from 'react'
import { track } from './analytics.ts'
import { ChartModes, useChartMode } from './ChartModes.tsx'
import { type ChartCursorGroup, CursorPlot, useChartCursor } from './CursorPlot.tsx'
import type { HoverCard } from './chart-slider.ts'
import { historyStartIndexOf, historyText } from './history.ts'
import {
  type ChartCardChoice,
  chartMetricChangedEvent,
  chartShownOf,
  chartsDrawnOf,
  ctrHoverOf,
  impressionsHoverOf,
  type MetricLines,
  metricChartsOf,
  metricChartsText,
  revenueHoverOf,
  rpmHoverOf,
  scaleLabelsOf,
  watchHoursHoverOf,
} from './metric-charts.ts'
import {
  type MetricSeries,
  metricPlotDefinitionOf,
  rpmSeriesOf,
  stackedSeries,
  yDomainOf,
} from './metric-plot.ts'
import { NumbersTable } from './NumbersTable.tsx'
import type { ViewsTotal } from './numbers-table.ts'
import { chartCardOf, rpmAdsAndPremiumOnlyOf, usePreferences } from './preferences.ts'
import { revenueText } from './revenue.ts'
import { type Navigate, type Route, routeWithChartCard } from './route.ts'
import { stackedChartsQuery } from './stacked-charts.ts'
import {
  HistoryStartLine,
  UploadDayLines,
  UploadMarkers,
  useUploadDayPlaces,
} from './UploadMarkers.tsx'
import { placeOf } from './upload-markers.ts'
import {
  axisLabelOf,
  type ChartDay,
  type ChartPoint,
  dayAfterPublishOf,
  daysCarryRevenue,
  seriesNames,
  viewsCardOf,
} from './views-chart.ts'

const text = {
  ...metricChartsText,
  dateColumn: 'Date',
  dayColumn: 'Day',
  // The numbers table's total row is approved word for word in creator-analytics#67, its caption
  // by Nick on 2026-10-10 for the creator-analytics#64 PR.
  tableCaption: 'Numbers by day',
  totalRow: 'Total',
  // Approved word for word in creator-analytics#76. Change it only with Nick.
  watchHoursColumn: 'Watch hours',
  // Approved word for word in creator-analytics#78. Change them only with Nick.
  revenueColumns: {
    estimatedRevenue: 'Estimated revenue',
    estimatedAdRevenue: 'Ads',
    estimatedRedPartnerRevenue: 'YouTube Premium',
    otherSources: 'Other sources',
  },
  // The glossary term, approved as the column's heading in creator-analytics#244. Change it only
  // with Nick.
  rpmColumn: 'RPM',
  impressionsColumn: historyText.impressions,
  ctrColumn: historyText.ctrColumn,
}

function subscribeToViewport(onChange: () => void): () => void {
  const query = window.matchMedia(stackedChartsQuery)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Whether the screen is wide and tall enough for every chart, stacked. */
function useStackedCharts(): boolean {
  return useSyncExternalStore(
    subscribeToViewport,
    () => window.matchMedia(stackedChartsQuery).matches,
    // Only the tests' server renderer reads this, as no server renders the app: every chart.
    () => true,
  )
}

/**
 * On a screen too small to stack the charts, the card whose chart shows: the address's, then the
 * saved preference, then engaged views, and engaged views in place of a revenue or RPM chart that
 * does not show. Only the cards of the charts the days draw choose. A card choosing another chart saves the
 * preference, writes the address and sends `chart_metric_changed`, together.
 */
function useChartCardChoice(route: Route, navigate: Navigate, days: ChartDay[]): ChartCardChoice {
  const { saved, save } = usePreferences()
  const charts = chartsDrawnOf(days)
  const chosen = chartShownOf(
    chartCardOf(route, saved),
    charts.includes('revenue'),
    charts.includes('impressions'),
  )

  function choose(card: ChartCard) {
    if (card === chosen) return
    save({ chartCard: card })
    navigate(routeWithChartCard(route, card))
    track(chartMetricChangedEvent(card))
  }

  return { chosen, choose, charts }
}

/**
 * What a screen passes its cards and its charts over the days: on a screen too small to stack the
 * charts, the cards' choice and the one chart it shows; on a larger one, no choice, and every chart.
 */
export function useChartChoice(
  route: Route,
  navigate: Navigate,
  days: ChartDay[],
): { choice: ChartCardChoice | undefined; shown: ChartCard | null } {
  const stacked = useStackedCharts()
  const choice = useChartCardChoice(route, navigate, days)
  return stacked ? { choice: undefined, shown: null } : { choice, shown: choice.chosen }
}

/** One stacked chart: its heading, what it draws, and its hover card. */
interface Plot {
  card: ChartCard
  topText: string
  /** The number at the bottom edge: zero, or the lowest day when one is below zero. */
  bottomText: string
  series: MetricSeries[]
  /** The y domain, from the numbers at the bottom and top edges the scale labels read. */
  domain: [number, number]
  cardOf: (day: ChartDay) => HoverCard
}

/**
 * The plots of the charts' lines. The revenue chart is in the currency its amounts are in, and the
 * RPM chart, which shows exactly when it does, after it in the same currency, its line and hover
 * card following the RPM switch (`adsAndPremiumOnly`). The impressions and CTR charts come last,
 * exactly when the days carry the stored history.
 */
function plotsOf(
  charts: MetricLines,
  currency: RevenueCurrency | undefined,
  adsAndPremiumOnly: boolean,
): Plot[] {
  const { engagedViews, watchTime, revenue, rpm, impressions, ctr } = charts
  const labels = scaleLabelsOf(charts, currency)
  const plots: Plot[] = [
    {
      card: 'engagedViews',
      topText: labels.engagedViews.top,
      bottomText: labels.engagedViews.bottom,
      series: stackedSeries.engagedViews,
      domain: yDomainOf(engagedViews.top),
      cardOf: viewsCardOf,
    },
    {
      card: 'watchTime',
      topText: labels.watchTime.top,
      bottomText: labels.watchTime.bottom,
      series: stackedSeries.watchTime,
      domain: yDomainOf(watchTime.top, watchTime.bottom),
      cardOf: watchHoursHoverOf,
    },
  ]
  if (revenue && currency && labels.revenue) {
    plots.push({
      card: 'revenue',
      topText: labels.revenue.top,
      bottomText: labels.revenue.bottom,
      series: stackedSeries.revenue,
      domain: yDomainOf(revenue.top, revenue.bottom),
      cardOf: (day) => revenueHoverOf(day, currency),
    })
    if (rpm && labels.rpm) {
      plots.push({
        card: 'rpm',
        topText: labels.rpm.top,
        bottomText: labels.rpm.bottom,
        series: rpmSeriesOf(adsAndPremiumOnly),
        domain: yDomainOf(rpm.top, rpm.bottom),
        cardOf: (day) => rpmHoverOf(day, currency, undefined, { adsAndPremiumOnly }),
      })
    }
  }
  if (impressions && ctr && labels.impressions && labels.ctr) {
    plots.push(
      {
        card: 'impressions',
        topText: labels.impressions.top,
        bottomText: labels.impressions.bottom,
        series: stackedSeries.impressions,
        domain: yDomainOf(impressions.top),
        cardOf: (day) => impressionsHoverOf(day),
      },
      {
        card: 'ctr',
        topText: labels.ctr.top,
        bottomText: labels.ctr.bottom,
        series: stackedSeries.ctr,
        domain: yDomainOf(ctr.top),
        cardOf: (day) => ctrHoverOf(day),
      },
    )
  }
  return plots
}

const historyCharts: ChartCard[] = ['impressions', 'ctr']

function MetricPlot({
  plot,
  points,
  group,
  overlay,
}: {
  plot: Plot
  points: ChartPoint[]
  group: ChartCursorGroup
  /** Drawn in the plot's box under its chart: the upload days' lines, or nothing. */
  overlay?: ReactNode
}) {
  const heading = text.headings[plot.card]
  const { series } = plot
  const [bottom, top] = plot.domain
  const { cursor } = group
  // The definition's identity is the library's update boundary, so it changes only with its lines.
  const definition = useMemo(
    () => metricPlotDefinitionOf({ points, series, domain: [bottom, top], cursor }),
    [points, series, bottom, top, cursor],
  )
  return (
    <div className="metric-chart">
      <h2>{heading}</h2>
      {plot.card === 'engagedViews' && (
        <ul className="views-chart-legend">
          <li>
            <span className="views-chart-key views-chart-key-engaged" />
            {seriesNames.engagedViews}
          </li>
          <li>
            <span className="views-chart-key views-chart-key-views" />
            {seriesNames.views}
          </li>
        </ul>
      )}
      <div className="chart">
        <span className="chart-label" style={{ top: '0%' }}>
          {plot.topText}
        </span>
        <span className="chart-label" style={{ top: '100%' }}>
          {plot.bottomText}
        </span>
        <CursorPlot
          heading={heading}
          points={points}
          cardOf={({ day }) => plot.cardOf(day)}
          definition={definition}
          group={group}
          overlay={overlay}
        />
      </div>
    </div>
  )
}

/**
 * Engaged views and views, watch hours, estimated revenue and RPM over the window's days, daily or
 * as a running total under one toggle, with the note under the charts and their numbers table under
 * them, and the line on other sources under the table when the days carry revenue. The toggle
 * changes the charts only: the numbers table under them stays daily in both modes. With `shown`
 * null, every chart the days have shows, stacked on one x axis, and one cursor shows a card
 * on each; with a card, only that chart shows. The revenue chart shows only when the days carry
 * revenue and the total names its currency, which its amounts show in, and the RPM chart after it
 * exactly then. The mode is the address's, then the saved preference, then daily (`chartModeOf`).
 * A change saves the preference and writes the address together. The total is YouTube's own over the window, for the table's total row.
 * With `uploads`, the channel summary's, the upload marker row sits right under the axis, whatever
 * the mode and the chart shown, every plot draws a faint line at each upload day, and with the
 * charts stacked a second, pointer-only row sits under the first plot, so a wide screen shows the
 * uploads at the top too; a screen that passes none, such as the video detail, draws no row and no
 * line.
 * With no day, it shows the note alone.
 */
export function MetricCharts({
  days,
  total,
  route,
  navigate,
  note,
  shown,
  uploads,
}: {
  days: ChartDay[]
  total: ViewsTotal
  route: Route
  navigate: Navigate
  note?: string | null
  /** The one chart a screen too small to stack them shows, or null for all of them. */
  shown: ChartCard | null
  /** The window's uploads, which the upload markers show under the axis and the plots' lines mark. */
  uploads?: SummaryUpload[]
}) {
  const { mode, changeMode } = useChartMode(route, navigate)
  const adsAndPremiumOnly = rpmAdsAndPremiumOnlyOf(usePreferences().saved)
  // Kept across renders, so each plot's definition changes only with the days, the mode or the RPM
  // switch.
  const charts = useMemo(
    () => metricChartsOf(days, mode, { adsAndPremiumOnly }),
    [days, mode, adsAndPremiumOnly],
  )
  // Each day's x is its index, kept with the charts.
  const xs = useMemo(() => charts?.points.map((_, index) => index) ?? [], [charts])
  // One cursor for every chart, created here so a pointer, tap or key on any plot moves them all.
  const group = useChartCursor(xs)
  const dayPlaces = useUploadDayPlaces(uploads, days)
  const historyStart = historyStartIndexOf(days)
  const first = days[0]
  const last = days.at(-1)
  const noteLine = note && <p className="note">{note}</p>
  if (!charts || !first || !last) return noteLine || null

  const plots = plotsOf(charts, total.currency, adsAndPremiumOnly).filter(
    ({ card }) => shown === null || card === shown,
  )

  return (
    <section className="video-detail-section metric-charts">
      <ChartModes mode={mode} onChange={changeMode} />
      {plots.map((plot, index) => (
        <Fragment key={plot.card}>
          <MetricPlot
            plot={plot}
            points={charts.points}
            group={group}
            overlay={
              <>
                {dayPlaces && <UploadDayLines places={dayPlaces} />}
                {historyStart !== null && historyCharts.includes(plot.card) && (
                  <HistoryStartLine
                    place={placeOf(historyStart, days.length)}
                    label={historyText.startMarker}
                  />
                )}
              </>
            }
          />
          {uploads && index === 0 && plots.length > 1 && (
            <UploadMarkers uploads={uploads} days={days} route={route} navigate={navigate} mirror />
          )}
        </Fragment>
      ))}
      <div className="metric-charts-axis" aria-hidden="true">
        <span>{axisLabelOf(first)}</span>
        {last !== first && <span>{axisLabelOf(last)}</span>}
      </div>
      {uploads && <UploadMarkers uploads={uploads} days={days} route={route} navigate={navigate} />}
      {mode === 'aggregate' && <p className="note">{text.runningTotalNote}</p>}
      {noteLine}
      <NumbersTable
        days={days}
        total={total}
        text={{
          caption: text.tableCaption,
          headings: {
            day: dayAfterPublishOf(first) === undefined ? text.dateColumn : text.dayColumn,
            engagedViews: seriesNames.engagedViews,
            views: seriesNames.views,
            estimatedMinutesWatched: text.watchHoursColumn,
            ...text.revenueColumns,
            rpm: text.rpmColumn,
            impressions: text.impressionsColumn,
            ctr: text.ctrColumn,
          },
          total: text.totalRow,
        }}
      />
      {daysCarryRevenue(days) && <p className="note">{revenueText.otherSourcesNote}</p>}
    </section>
  )
}
