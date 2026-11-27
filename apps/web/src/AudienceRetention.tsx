import type { AudienceRetentionPoint } from '@creator-analytics/api-types'
import { type ReactNode, useMemo, useSyncExternalStore } from 'react'
import { CursorPlot, useChartCursor } from './CursorPlot.tsx'
import { Placeholder } from './Placeholder.tsx'
import { type PlayheadStore, playheadRatioOf } from './playhead.ts'
import {
  type RetentionAxis,
  relativeCardOf,
  relativeName,
  retentionAxisOf,
  retentionChartsOf,
  retentionScaleLabelsOf,
  watchingCardOf,
} from './retention.ts'
import { relativePlotDefinitionOf, watchingPlotDefinitionOf } from './retention-plot.ts'
import {
  type PlayerSeekInput,
  type PlayerSeekPlot,
  playerMoveText,
  playerSecondsAt,
} from './video-player.ts'

/**
 * Moves the video player to a time from a retention plot, returning what the plot's live region
 * says.
 */
export type MovePlayer = (seconds: number, plot: PlayerSeekPlot, input: PlayerSeekInput) => string

// The text is approved word for word in creator-analytics#55, the relative retention explanation
// in creator-analytics#69. Change it only with Nick.
const text = {
  heading: 'Audience retention',
  explanation: 'The share of viewers still watching at each point of the video.',
  relative:
    'Above the dashed line, this video keeps viewers better than half of YouTube videos of a similar length. Below it, worse.',
  empty:
    'YouTube shows retention once a video has enough views. This video does not have enough views yet.',
}

/** The time axis under a retention chart: the start of the video and its length. */
function TimeAxis({ axis }: { axis: RetentionAxis | null }) {
  if (!axis) return null
  return (
    <div className="retention-chart-axis" aria-hidden="true">
      <span>{axis.first}</span>
      <span>{axis.last}</span>
    </div>
  )
}

/**
 * The playhead on a retention plot: a thin line at the time the video player is at, over the
 * plot's 0 to 1 x, or nothing before the player has played. It reads the store alone, so a read
 * re-renders the line and never the charts' definitions, and it has no card and moves no cursor.
 */
function Playhead({
  playhead,
  durationSeconds,
}: {
  playhead: PlayheadStore
  durationSeconds: number | null
}) {
  const seconds = useSyncExternalStore(playhead.subscribe, playhead.seconds, playhead.seconds)
  const ratio = playheadRatioOf(seconds, durationSeconds)
  if (ratio === null) return null
  return (
    <span className="retention-playhead" aria-hidden="true" style={{ left: `${ratio * 100}%` }} />
  )
}

/** What the retention section shows once the answer lands: the video's curve and its length. */
export interface RetentionAnswer {
  points: AudienceRetentionPoint[]
  durationSeconds: number | null
}

/**
 * The audience retention section, one element while the video's detail is read and once it lands,
 * so the video player in it stays in the page across a step to the previous or next video: while
 * read, the places of its heading and its two charts with their captions, and once landed the
 * charts. The player sits after the heading, first in the section's body, which holds it and the
 * pair of charts: beside the pair from 60rem and above it below that (`app.css`). The body and the
 * pair are always in the page, so the player keeps its place in both. Each chart's explanation is a
 * caption under its time axis, so the plots start level with the player (Nick, 2026-11-12).
 */
export function AudienceRetention({
  retention,
  player,
  playhead,
  onMove,
}: {
  /** The answer's retention, or null while the video's detail is read. */
  retention: RetentionAnswer | null
  /** The video player, or nothing. */
  player: ReactNode
  /** The time the video player is at, for the playhead on both charts, or none. */
  playhead?: PlayheadStore
  /** What a pick on either chart does to the video player, given only when the screen holds it. */
  onMove?: MovePlayer | undefined
}) {
  return (
    <section className="video-detail-section">
      {retention ? <h2>{text.heading}</h2> : <Placeholder shape="heading" />}
      <div className={player ? 'retention-body retention-body-with-player' : 'retention-body'}>
        {player}
        <div className="retention-pair">
          {retention ? (
            <RetentionCharts {...retention} playhead={playhead} onMove={onMove} />
          ) : (
            <>
              <Placeholder shape="chart" />
              <Placeholder shape="line" />
              <Placeholder shape="line" />
              <Placeholder shape="chart" />
              <Placeholder shape="line" />
            </>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * The share of viewers still watching, and Google's relative retention drawn beside it, as
 * Google's own comparison and never a grade (ADR 0011). With the video's duration, both charts run
 * over a time axis. The two charts share one cursor of their own on the video position axis, so a
 * pointer, a tap or a key on either shows a card on both at the same point; the stacked charts on
 * the same screen keep theirs. Once the video player has played, the playhead shows on both at its
 * time, beside the cursor and never moving it. With the video player on the screen, a click, a tap,
 * Enter or Space on either chart moves the player to the start of the picked point's slice, and
 * each chart's name says so.
 */
function RetentionCharts({
  points,
  durationSeconds,
  playhead,
  onMove,
}: RetentionAnswer & { playhead: PlayheadStore | undefined; onMove: MovePlayer | undefined }) {
  const charts = useMemo(() => retentionChartsOf(points), [points])
  // Each chart's x is the point in the video, as its line draws it.
  const xs = useMemo(
    () => points.map(({ elapsedVideoTimeRatio }) => elapsedVideoTimeRatio),
    [points],
  )
  const group = useChartCursor(xs)
  const { cursor } = group
  const top = charts?.top ?? 1
  // A definition's identity is the library's update boundary, so it changes only with its line.
  const watching = useMemo(
    () => watchingPlotDefinitionOf({ points, top, cursor }),
    [points, top, cursor],
  )
  const relative = useMemo(() => relativePlotDefinitionOf({ points, cursor }), [points, cursor])
  const axis = retentionAxisOf(durationSeconds)
  const scale = retentionScaleLabelsOf()
  const overlay = playhead && <Playhead playhead={playhead} durationSeconds={durationSeconds} />
  const moves = (plot: PlayerSeekPlot) =>
    onMove && durationSeconds
      ? {
          onPick: (at: number, input: PlayerSeekInput) =>
            points[at] ? onMove(playerSecondsAt(points, at, durationSeconds), plot, input) : null,
          labelMore: playerMoveText.moveSentence,
        }
      : {}
  if (!charts) return <p>{text.empty}</p>
  return (
    <>
      <div className="chart">
        <span className="chart-label" style={{ top: `${charts.fullLineY}%` }}>
          {scale.full}
        </span>
        <span className="chart-label" style={{ top: `${charts.halfLineY}%` }}>
          {scale.half}
        </span>
        <CursorPlot
          heading={text.heading}
          points={points}
          cardOf={(point) => watchingCardOf(point, durationSeconds)}
          definition={watching}
          group={group}
          overlay={overlay}
          {...moves('absolute')}
        />
      </div>
      <TimeAxis axis={axis} />
      <p className="retention-caption">{text.explanation}</p>
      <h3>{relativeName}</h3>
      <div className="chart">
        <CursorPlot
          heading={relativeName}
          points={points}
          cardOf={(point) => relativeCardOf(point, durationSeconds)}
          definition={relative}
          group={group}
          overlay={overlay}
          {...moves('relative')}
        />
      </div>
      <TimeAxis axis={axis} />
      <p className="retention-caption">{text.relative}</p>
    </>
  )
}
