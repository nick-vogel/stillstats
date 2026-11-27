import type { ListedChannel } from '@creator-analytics/api-types'
import { type CSSProperties, useEffect, useState } from 'react'
import { launchChartRows } from './launch-chart.ts'
import { numbersTableRowsOf } from './numbers-table.ts'
import { chartCardOf, chartModeOf, revenueSourcesOf, usePreferences } from './preferences.ts'
import type { Route } from './route.ts'
import { listRowsExpectedFor, publishDayTopRowsExpectedFor } from './video-list.ts'

/** The shapes a placeholder takes, each about the size of what it stands in for. */
export type PlaceholderShape =
  | 'card'
  | 'figure'
  | 'heading'
  | 'toolbar'
  | 'legend'
  | 'chart'
  | 'axis'
  | 'table'
  | 'since-publish-table'
  | 'thumbnail'
  | 'line'
  | 'note'
  | 'first-rows-note'
  | 'launch-total-note'
  | 'other-sources-note'
  | 'not-processed'
  | 'total-note'
  | 'countries-note'
  | 'us-states-note'
  | 'cities-note'
  | 'every-format-note'
  | 'gender-note'
  | 'countries-heading'
  | 'us-states-heading'
  | 'cities-heading'
  | 'age-heading'
  | 'gender-heading'
  | 'devices-heading'
  | 'operating-systems-heading'
  | 'subscribers-heading'
  | 'video-subscribers-heading'
  | 'text'
  | 'audience-empty-text'
  | 'publish-day-empty-text'
  | 'bar'
  | 'avatar'
  | 'sidebar-row'
  | 'channel'
  | 'button'

/**
 * A still block where an answer will show, so the page does not jump when it arrives. It never
 * animates (creator-analytics#71), and a screen reader skips it: `LoadingStatus` says what is
 * loading. With `stackedOnly`, it shows only on a screen large enough to stack the charts.
 */
export function Placeholder({
  shape,
  style,
  stackedOnly,
}: {
  shape: PlaceholderShape
  style?: CSSProperties | undefined
  stackedOnly?: boolean
}) {
  const className = `placeholder placeholder-${shape}${stackedOnly ? ' placeholder-stacked-only' : ''}`
  return <div className={className} style={style} aria-hidden="true" />
}

function placeholdersOf(count: number, shape: PlaceholderShape) {
  return Array.from({ length: count }, (_, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the placeholders are alike and never reorder.
    <Placeholder key={index} shape={shape} />
  ))
}

/** `rows` bars' places, three unless told, each a name's line above its bar. */
export function PlaceholderBarRows({ rows = 3 }: { rows?: number }) {
  return Array.from({ length: rows }, (_, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the places are alike and never reorder.
    <div className="placeholder-bar-row" key={index}>
      <Placeholder shape="line" />
      <Placeholder shape="bar" />
    </div>
  ))
}

/** A row of card placeholders, as `Cards` lays out its cards. */
export function CardsPlaceholder({ count }: { count: number }) {
  return <div className="cards">{placeholdersOf(count, 'card')}</div>
}

/** A row of figure placeholders, as `Figures` lays out its figures. */
export function FiguresPlaceholder({ count, smaller }: { count: number; smaller?: boolean }) {
  return (
    <div className={smaller ? 'figures figures-smaller' : 'figures'}>
      {placeholdersOf(count, 'figure')}
    </div>
  )
}

/** A table's place, as many rows tall as `rows`. */
export function TablePlaceholder({ rows }: { rows: number }) {
  return <Placeholder shape="table" style={{ '--rows': rows } as CSSProperties} />
}

/**
 * The charts' place, as `MetricCharts` lays out its section: the mode buttons, the engaged views
 * chart, and on a screen large enough to stack them, the watch hours chart, 6rem tall as its chart
 * is below engaged views' 10rem (app.css), then the axis, the running total note in that mode, the
 * note on how current the numbers are, and the numbers table, whose place is the same in both modes
 * since the table stays daily. On a smaller screen the one chart is the chosen card's, so the
 * engaged views legend's place holds only for that card. It holds no place for the revenue chart,
 * which shows only once the answer carries revenue, but holds the revenue sources button's, and the
 * other sources note's under the table, once the user has saved a choice of the sources. They made
 * it on a channel with revenue, and the choice is theirs on every channel, a channel without revenue
 * included: there the page moves up the button's and the note's height when the numbers land, a
 * cost accepted for a still page on a channel with revenue (creator-analytics#509). The mode and the
 * card are the ones `MetricCharts` takes from the route and the saved preference.
 */
export function MetricChartsPlaceholder({ route }: { route: Route }) {
  const { saved } = usePreferences()
  const mode = chartModeOf(route, saved)
  return (
    <div className="video-detail-section metric-charts">
      <Placeholder shape="toolbar" />
      <div className="metric-chart">
        <Placeholder shape="heading" />
        <Placeholder shape="legend" stackedOnly={chartCardOf(route, saved) !== 'engagedViews'} />
        <Placeholder shape="chart" />
      </div>
      <div className="metric-chart placeholder-stacked-only">
        <Placeholder shape="heading" />
        <Placeholder shape="chart" />
      </div>
      <Placeholder shape="axis" />
      {mode === 'aggregate' && <Placeholder shape="total-note" />}
      <Placeholder shape="note" />
      {saved.revenueSources !== undefined && <Placeholder shape="button" />}
      {/* As many rows tall as the window is expected to show, up to the box's ten body rows, with
          the sources' heading row when the saved choice shows them. */}
      <TablePlaceholder rows={numbersTableRowsOf(route, revenueSourcesOf(saved))} />
      {saved.revenueSources !== undefined && <Placeholder shape="other-sources-note" />}
    </div>
  )
}

/**
 * What a screen reader hears while a region waits: the text, or nothing once the answer is in.
 * It sits beside the busy region, not inside it, since `aria-busy` holds back what changes inside.
 * It mounts empty and takes its text after the commit, since a screen reader announces only a
 * change to a live region it already knows, and most screens mount already waiting.
 */
export function LoadingStatus({ text }: { text: string | null }) {
  const [said, setSaid] = useState<string | null>(null)
  useEffect(() => setSaid(text), [text])
  return (
    <p role="status" className="visually-hidden">
      {said}
    </p>
  )
}

/**
 * The summary's place in a window after publish while the video list is read: under "Publish day",
 * the top's heading and as many bars as the same read of `channel` last answered on this page load,
 * else the most the top holds, 10 (creator-analytics#510), or with none answered the empty text's
 * place; under the other windows, the launch chart's mode buttons,
 * heading, plot and axis, then the note on its first 10 rows when the page is expected to hold more,
 * and the running total sentence in that mode, the mode `LaunchChart` takes from the route and the
 * saved preference. The rows the list last answered for the same read of `channel`, the read the
 * list sends (creator-analytics#376), predict the note before the answer, and with no such answer
 * the page size, as the list takes it from the route and the saved preference
 * (creator-analytics#325). So only a page the list has not answered on this page load, of 10 rows
 * or fewer at a larger page size, holds the note's place, which never fills
 * (creator-analytics#314). Both end with the delay note's place, as the note sits last under either.
 */
export function AfterPublishPlaceholder({
  route,
  channel,
}: {
  route: Route
  channel: ListedChannel | null
}) {
  const { saved } = usePreferences()
  if (route.window === 'first1') {
    const rows = publishDayTopRowsExpectedFor(channel, route, saved)
    return (
      <div className="video-detail-section" aria-busy="true">
        <Placeholder shape="heading" />
        {rows === 0 ? (
          <Placeholder shape="publish-day-empty-text" />
        ) : (
          <PlaceholderBarRows rows={rows} />
        )}
        <Placeholder shape="note" />
      </div>
    )
  }
  return (
    <div className="video-detail-section metric-charts" aria-busy="true">
      <Placeholder shape="toolbar" />
      <div className="metric-chart">
        <Placeholder shape="heading" />
        <Placeholder shape="chart" />
      </div>
      <Placeholder shape="axis" />
      {listRowsExpectedFor(channel, route, saved) > launchChartRows && (
        <Placeholder shape="first-rows-note" />
      )}
      {chartModeOf(route, saved) === 'aggregate' && <Placeholder shape="launch-total-note" />}
      <Placeholder shape="note" />
    </div>
  )
}
