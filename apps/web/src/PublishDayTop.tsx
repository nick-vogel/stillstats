import type { PublishDayVideo } from '@creator-analytics/api-types'
import { Bar } from './Bar.tsx'
import { publishDayTopBarsOf, publishDayTopText } from './publish-day-top.ts'
import { RouteLink } from './RouteLink.tsx'
import { type Navigate, type Route, routeToVideo } from './route.ts'

/**
 * The videos with the most engaged views on their publish day, most first, as bars: each title
 * links to the video's detail screen, as a list title does, and its number sits at the end of the
 * bar. No rank number. With no video, it says YouTube has processed no publish day yet. The
 * processed note (`note`) sits last, under the bars or that sentence, as under the summary's charts
 * it takes the place of.
 */
export function PublishDayTop({
  videos,
  route,
  navigate,
  note,
}: {
  videos: PublishDayVideo[]
  route: Route
  navigate: Navigate
  /** How current the numbers are: "YouTube has processed data up to ...". */
  note: string
}) {
  const bars = publishDayTopBarsOf(videos)
  return (
    <section className="video-detail-section publish-day-top">
      <h2>{publishDayTopText.heading}</h2>
      {bars.length === 0 ? (
        <p>{publishDayTopText.empty}</p>
      ) : (
        <ul className="bars">
          {bars.map(({ id, title, engagedViews, width }) => (
            <li key={id}>
              <RouteLink className="bars-name" route={routeToVideo(route, id)} navigate={navigate}>
                {title}
              </RouteLink>
              <span className="bars-number">{engagedViews}</span>
              <Bar width={width} />
            </li>
          ))}
        </ul>
      )}
      <p className="note">{note}</p>
    </section>
  )
}
