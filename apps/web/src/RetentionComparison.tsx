import {
  maxComparedCurves,
  type RetentionCurvesAnswer,
  type VideoFormatFilter,
} from '@creator-analytics/api-types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { track } from './analytics.ts'
import { latestOnly, readAnswer } from './api.ts'
import { CursorPlot, useChartCursor } from './CursorPlot.tsx'
import { formatFilterOptions, formatLabel } from './controls-bar.ts'
import { LaunchSwatch } from './LaunchChart.tsx'
import { ListSelect } from './ListSelect.tsx'
import { loadingText } from './loading.ts'
import { LoadingStatus, Placeholder } from './Placeholder.tsx'
import { pageSizeOf, usePreferences, visibilityOf } from './preferences.ts'
import { notProcessedText } from './processing.ts'
import { retentionScaleLabelsOf } from './retention.ts'
import {
  type ComparisonSort,
  type ComparisonView,
  comparedEventOf,
  comparisonCardOf,
  comparisonChartsOf,
  comparisonSortOf,
  comparisonSortOptions,
  comparisonText,
  comparisonViewOf,
  comparisonXsOf,
  curvesQueryOf,
  heldPicksOf,
  isPickNotHeld,
  isPickRefused,
  type LegendEntry,
  pickerText,
  picksAfterToggleOf,
} from './retention-comparison.ts'
import { comparisonPlotDefinitionOf } from './retention-plot.ts'
import {
  type Navigate,
  type Route,
  routeWithControl,
  routeWithCurves,
  routeWithin,
} from './route.ts'
import { SegmentedControl } from './SegmentedControl.tsx'
import { answerShown, cacheOf, screenShown } from './screen-timing.ts'
import { Pager, readVideoList } from './VideoList.tsx'
import {
  averageViewedColumn,
  detailColumns,
  type VideoListView,
  videoListQueryOf,
} from './video-list.ts'

/** The curves read's view, or the picks the channel still holds when it holds fewer than picked. */
type CurvesRead = { kind: 'view'; view: ComparisonView } | { kind: 'held'; picks: string[] }

/**
 * The curves read for the picks. The read refuses every pick when the channel no longer holds one,
 * such as a video deleted since it was put in a bookmarked address, and does not say which; then
 * each pick is read alone, its uploads read cached, to name the picks the channel still holds.
 */
async function readCurves(channelId: string, picks: readonly string[]): Promise<CurvesRead> {
  const read = (ids: readonly string[]) =>
    readAnswer<RetentionCurvesAnswer>(
      `/api/channels/${channelId}/retention-curves?${curvesQueryOf(ids)}`,
    )
  const body = await read(picks)
  if (picks.length > 0 && isPickNotHeld(body)) {
    const held = heldPicksOf(picks, await Promise.all(picks.map((pick) => read([pick]))))
    if (held) return { kind: 'held', picks: held }
  }
  return { kind: 'view', view: comparisonViewOf(body) }
}

const [, publishedColumn] = detailColumns

/** The chart's legend: each pick in its line's colour, its title, and its read date or why none. */
function Legend({ entries }: { entries: LegendEntry[] }) {
  return (
    <ul className="comparison-legend" aria-label={comparisonText.legend}>
      {entries.map(({ videoId, title, position, drawn, detail }) => (
        <li key={videoId}>
          {drawn && <LaunchSwatch position={position} />}
          <span className="comparison-legend-title">{title}</span>{' '}
          <span className="comparison-legend-detail">{detail}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The overlay of the drawn curves over one cursor: a pointer, a tap or a key shows one card that
 * reads every curve at the same share of the video (`comparisonCardOf`).
 */
function ComparisonChart({ view }: { view: Extract<ComparisonView, { kind: 'compared' }> }) {
  const { lines, legend } = view
  const titled = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        title: legend.find(({ videoId }) => videoId === line.videoId)?.title ?? line.videoId,
      })),
    [lines, legend],
  )
  const xs = useMemo(() => comparisonXsOf(lines), [lines])
  const group = useChartCursor(xs)
  const { cursor } = group
  const charts = comparisonChartsOf(lines)
  const top = charts?.top ?? 1
  const definition = useMemo(
    () => comparisonPlotDefinitionOf({ curves: lines, top, cursor }),
    [lines, top, cursor],
  )
  const scale = retentionScaleLabelsOf()
  if (!charts) return <EmptyChart text={null} />
  return (
    <div className="chart comparison-chart">
      <span className="chart-label" style={{ top: `${charts.fullLineY}%` }}>
        {scale.full}
      </span>
      <span className="chart-label" style={{ top: `${charts.halfLineY}%` }}>
        {scale.half}
      </span>
      <CursorPlot
        heading={comparisonText.chart}
        points={xs}
        cardOf={(x) => comparisonCardOf(x, titled)}
        definition={definition}
        group={group}
      />
    </div>
  )
}

/** The chart's place with no curve to draw, at the chart's height, so a pick moves nothing. */
function EmptyChart({ text }: { text: string | null }) {
  return (
    <div className="chart comparison-chart">
      <p className="comparison-chart-empty">{text}</p>
    </div>
  )
}

/**
 * The retention comparison (creator-analytics#951): an h1, the intro with the note while the
 * backfill fills under it, up to 5 stored retention curves drawn on one chart with a legend of each
 * pick's title and read date under it, and the channel's videos with a stored curve to draw over their lifetime to pick from
 * (creator-analytics#1044), by format and in a publish date or average viewed sort, a page at a
 * time. The picks live in the address (`curves`), in pick order, and one the channel no longer
 * holds is dropped from it. The curves are read on open, with no pick too, which answers a free
 * channel's refusal and the backfill's count, and on each pick change; `retention_curves_compared`
 * goes out when a pick change lands an answer that draws 2 or more curves, not on a load from the
 * address. A sixth pick is disabled, with the limit sentence, and "Clear all picks" clears every
 * pick, on any page. The chart, the legend's room for 5 picks, the limit sentence and "Clear all
 * picks" keep their places with any number of picks, so a pick moves nothing on the page
 * (creator-analytics#1049). A free channel's picker leaves its refusal to the chart's place. With no
 * channel it reads nothing.
 */
export function RetentionComparison({
  channelId,
  route,
  navigate,
}: {
  channelId: string | null
  route: Route
  navigate: Navigate
}) {
  const picks = useMemo(() => route.curves ?? [], [route.curves])
  const picksKey = picks.join(',')
  const [view, setView] = useState<ComparisonView | null>(null)
  const [list, setList] = useState<VideoListView | null>(null)
  const pickChanged = useRef(false)
  // The route on view when a read lands, so dropping a pick keeps a format or sort chosen meanwhile.
  const latestRoute = useRef(route)
  latestRoute.current = route
  const pickerHeading = useRef<HTMLHeadingElement>(null)
  const { saved } = usePreferences()
  const sort = comparisonSortOf(route)
  const visibility = visibilityOf(route, saved)
  const listQuery = videoListQueryOf({
    page: route.page,
    window: 'lifetime',
    sort,
    format: route.format,
    pageSize: pageSizeOf(route, saved),
    visibility,
    withRetentionCurve: true,
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: the picks' key stands for the picks.
  useEffect(() => {
    if (channelId === null) return
    return latestOnly(
      readCurves(channelId, picks),
      (read) => {
        if (read.kind === 'held') {
          navigate(routeWithCurves(latestRoute.current, read.picks), { replace: true })
          return
        }
        const next = read.view
        setView(next)
        if (!pickChanged.current) return
        pickChanged.current = false
        const event = comparedEventOf(next)
        if (event) track(event)
      },
      (message) => setView({ kind: 'refused', message }),
    )
  }, [channelId, picksKey])

  useEffect(() => {
    if (channelId === null) return
    return latestOnly(
      readVideoList(channelId, listQuery),
      (next) => {
        if (next.kind === 'list') {
          const clamped = routeWithin(latestRoute.current, next.answer.pageCount)
          if (clamped !== latestRoute.current) {
            navigate(clamped, { replace: true })
            return
          }
        }
        setList(next)
      },
      (message) => setList({ kind: 'refused', message }),
    )
  }, [channelId, listQuery, navigate])

  // The load is timed by the stored curves' view, and a sort, page or format change of the picker
  // by the picker's own list, read from the API's cache or Google. A pick change times nothing.
  useEffect(() => screenShown('/app/retention'), [])
  useEffect(() => {
    if (view && view.kind !== 'refused') answerShown('/app/retention', 'lifetime', 'stored', 'load')
  }, [view])
  useEffect(() => {
    if (list?.kind !== 'list') return
    answerShown('/app/retention', 'lifetime', cacheOf(list.answer.fromCache), 'change')
  }, [list])

  function toggle(videoId: string) {
    pickChanged.current = true
    navigate(routeWithCurves(route, picksAfterToggleOf(picks, videoId)))
  }

  function clearPicks() {
    pickChanged.current = true
    navigate(routeWithCurves(route, []))
    pickerHeading.current?.focus()
  }

  const full = picks.length >= maxComparedCurves
  return (
    <>
      <h1>{comparisonText.heading}</h1>
      <div className="comparison-header">
        <p className="comparison-intro">{comparisonText.intro}</p>
        {view?.kind === 'compared' && view.note && <p className="comparison-note">{view.note}</p>}
      </div>
      <section className="comparison-chart-section" aria-labelledby="comparison-chart-heading">
        <h2 id="comparison-chart-heading" className="visually-hidden">
          {comparisonText.chart}
        </h2>
        <LoadingStatus text={view ? null : loadingText.channel} />
        {!view ? (
          <Placeholder shape="chart" />
        ) : view.kind === 'refused' ? (
          <p role="alert">{view.message}</p>
        ) : (
          <>
            {view.lines.length === 0 ? (
              <EmptyChart text={view.legend.length === 0 ? comparisonText.empty : null} />
            ) : (
              <ComparisonChart view={view} />
            )}
            <p className="retention-caption">{comparisonText.explanation}</p>
            <div className="comparison-legend-place">
              {view.legend.length > 0 && <Legend entries={view.legend} />}
            </div>
          </>
        )}
      </section>
      <section className="comparison-picker" aria-labelledby="comparison-picker-heading">
        <h2 id="comparison-picker-heading" ref={pickerHeading} tabIndex={-1}>
          {comparisonText.pick}
        </h2>
        <div className="comparison-controls">
          <SegmentedControl<VideoFormatFilter>
            label={formatLabel}
            value={route.format}
            options={formatFilterOptions}
            onChange={(format) => navigate(routeWithControl(route, { format }))}
          />
          <ListSelect<ComparisonSort>
            label={comparisonText.sort}
            value={sort}
            options={comparisonSortOptions}
            onChange={(next) => navigate(routeWithControl(route, { sort: next }))}
          />
          <Button
            variant="quiet"
            type="button"
            className="py-[0.6rem]!"
            disabled={picks.length === 0}
            onClick={clearPicks}
          >
            {pickerText.clear}
          </Button>
        </div>
        <p
          id="comparison-limit"
          className="comparison-limit"
          style={full ? undefined : { visibility: 'hidden' }}
        >
          {comparisonText.limit}
        </p>
        <LoadingStatus text={list ? null : loadingText.videos} />
        {!list ? (
          <Placeholder shape="line" />
        ) : list.kind === 'list' && list.answer.pageCount === 0 ? (
          <p>{pickerText.noDrawable}</p>
        ) : list.kind === 'list' ? (
          <>
            <ul className="comparison-videos">
              {list.answer.videos.map((video) => {
                const id = `comparison-pick-${video.id}`
                const refused = isPickRefused(picks, video.id)
                return (
                  <li key={video.id}>
                    <Checkbox
                      id={id}
                      nativeButton
                      render={<button type="button" />}
                      checked={picks.includes(video.id)}
                      disabled={refused}
                      aria-describedby={refused ? 'comparison-limit' : undefined}
                      onCheckedChange={() => toggle(video.id)}
                    />
                    <label htmlFor={id}>
                      <span className="comparison-video-title">{video.title}</span>
                      <span className="comparison-video-numbers">
                        <span>{publishedColumn?.textOf(video)}</span>
                        <span>
                          {video.awaitingProcessing
                            ? notProcessedText
                            : `${averageViewedColumn.label} ${averageViewedColumn.textOf(video)}`}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <Pager
              pageCount={list.answer.pageCount}
              route={route}
              navigate={navigate}
              land={() => pickerHeading.current?.focus()}
            />
          </>
        ) : list.kind === 'refused' && list.historyFilter ? null : (
          <p role="alert">{list.kind === 'refused' ? list.message : null}</p>
        )}
      </section>
    </>
  )
}
