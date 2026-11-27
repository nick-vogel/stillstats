import type { TrafficSource, VideoDetailAnswer } from '@creator-analytics/api-types'
import { useId } from 'react'
import { Bar } from './Bar.tsx'
import { historyNewestNoteOf, historyText, videoHistoryText } from './history.ts'
import { newestUploadsNoteOf } from './newest-average.ts'
import { numberWithShareOf } from './share.ts'
import { trafficSourceBarsOf, trafficSourceReachRowsOf } from './traffic-sources.ts'
import { historyShownOf } from './video-detail.ts'

/**
 * The traffic source types the video's engaged views came from, most engaged views first. The bars
 * keep one row each, as tall as their places.
 */
export function TrafficSources({ sources }: { sources: TrafficSource[] }) {
  if (sources.length === 0) return null
  const bars = trafficSourceBarsOf(sources)
  return (
    <section className="video-detail-section">
      {/* The heading and the row are approved word for word in creator-analytics#69, the source
          names in creator-analytics#55. */}
      <h2>Traffic sources (engaged views)</h2>
      <ul className="bars">
        {bars.map(({ type, name, engagedViews, share, width }) => (
          <li key={type}>
            <span className="bars-name">{name}</span>
            <span className="bars-number">{numberWithShareOf(engagedViews, share)}</span>
            <Bar width={width} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * With a paid channel's history, each traffic source's impressions and CTR, most impressions
 * first, in a window after publish beside the newest uploads' average for that source with a note
 * naming the uploads it counts, and a caption naming the newest day the history holds. A row of
 * its own, the whole width of the screen, so every column shows on a wide screen; on a narrow one
 * the table scrolls sideways (creator-analytics#1048). Only when the screen shows the history
 * (`historyShownOf`).
 */
export function TrafficSourceReach({ answer }: { answer: VideoDetailAnswer }) {
  const headingId = useId()
  const history = historyShownOf(answer)
  if (!history) return null
  const rows = trafficSourceReachRowsOf(
    answer.trafficSources,
    undefined,
    history.newestAverage?.trafficSources,
  )
  const averaged = history.newestAverage !== undefined
  const averageNote = newestUploadsNoteOf(history.newestAverage, answer.window)
  return (
    <div className="video-detail-section">
      <h2 id={headingId}>{videoHistoryText.sourcesHeading}</h2>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a keyboard scrolls the box only once it has focus. */}
      <section className="traffic-reach" aria-labelledby={headingId} tabIndex={0}>
        <table>
          <thead>
            <tr>
              <td />
              <th scope="col">{historyText.impressions}</th>
              <th scope="col">{historyText.ctrColumn}</th>
              {averaged && <th scope="col">{videoHistoryText.averageImpressions}</th>}
              {averaged && <th scope="col">{videoHistoryText.averageCtr}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ type, name, impressions, ctr, average }) => (
              <tr key={type}>
                <th scope="row">{name}</th>
                <td>{impressions}</td>
                <td>{ctr}</td>
                {averaged && <td>{average?.impressions}</td>}
                {averaged && <td>{average?.ctr}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {averageNote && <p className="note">{averageNote}</p>}
      <p className="traffic-reach-caption">
        {historyNewestNoteOf(history, Boolean(history.partial))}
      </p>
    </div>
  )
}
