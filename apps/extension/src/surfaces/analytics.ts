import type { VideoWindow } from '@creator-analytics/api-types'
import {
  dashboardHrefIn,
  keyMetricCardOf,
  keyMetricHeaderIn,
  viewsNumberRowIn,
} from '../selectors/analytics.ts'
import { sendWebAppOpened } from './line-clicks.ts'
import { redrawnFrom, type Surface, type SurfaceOptions } from './page-watcher.ts'
import { type OpenedLink, removeSurface, renderVideoAnalytics } from './render.ts'
import { analyticsPeriodOf, channelIdOf, isVideoAnalytics, videoIdOf } from './studio-url.ts'
import { surfaceText } from './text.ts'
import { type PlacedHost, videoRowPlacer } from './video-row.ts'

/**
 * Studio's periods by their URL names, as the period menu's test-ids name them, and the API's window
 * for each.
 */
const windows: Record<string, VideoWindow> = {
  week: 'last7',
  '4_weeks': 'last28',
  quarter: 'last90',
  year: 'last365',
  lifetime: 'lifetime',
}

/**
 * The window the figure covers for the page at `url`, and the period said under the figure when it
 * is not Studio's: none for one of Studio's periods the API serves, and "Lifetime" for any other
 * period, or none in the URL, which shows lifetime engaged views.
 */
function periodOf(url: string): { window: VideoWindow; label: string | undefined } {
  const name = analyticsPeriodOf(url)
  const window = name !== undefined && Object.hasOwn(windows, name) ? windows[name] : undefined
  return window ? { window, label: undefined } : { window: 'lifetime', label: surfaceText.lifetime }
}

/**
 * The video's detail screen in the web app, for the Stillstats channel the read matched, in the
 * page's window.
 */
function detailHrefOf({
  origin,
  videoId,
  channelId,
  window,
}: {
  origin: string
  videoId: string
  channelId: string
  window: VideoWindow
}): string {
  const query = new URLSearchParams({ channel: channelId, window })
  return `${origin}/app/videos/${encodeURIComponent(videoId)}?${query}`
}

/**
 * The page's video and channel, and Studio's key metric header and card the line goes by, once
 * Studio draws them.
 */
function keyMetricsIn(document: Document, url: string) {
  const videoId = videoIdOf(url)
  const dashboardHref = dashboardHrefIn(document)
  const youtubeChannelId = dashboardHref ? channelIdOf(new URL(dashboardHref, url).href) : undefined
  const header = keyMetricHeaderIn(document)
  const card = header && keyMetricCardOf(header)
  return videoId && youtubeChannelId && header && card
    ? { videoId, youtubeChannelId, header, card }
    : undefined
}

/**
 * A video's analytics page, Overview tab: the video's engaged views over Studio's selected period,
 * in an element of the extension's own inside Studio's Views tile, under Studio's number, and a
 * line of its own directly before Studio's key metric card, above its tiles and chart, with the day
 * the figure runs through and the link to the video in the web app. The line, a line state's
 * (signed out, not connected, a refusal) as much as a shown answer's, needs only the key metric
 * header and card; the figure needs Studio's Views number too, comes on the pass that finds it,
 * and comes down on the pass that finds it gone, while the line waits for the next read. A pass
 * that misses the header or the card takes both down. A shown answer whose figure has
 * no Views number to go under is not yet found, so a page whose figure never places is reported
 * missing. Studio's card stays as it is.
 */
export function videoAnalyticsPage(options: SurfaceOptions): Surface {
  const { ask, origin } = options
  const placeRow = videoRowPlacer('analytics', options)

  return {
    name: 'analytics',
    isOn: isVideoAnalytics,
    found: (document, url) => keyMetricsIn(document, url) !== undefined,
    async place({ document, url, navigation, current }) {
      const found = keyMetricsIn(document, url)
      const viewsNumberRow = viewsNumberRowIn(document)
      if (!found) {
        removeSurface(document, 'analytics')
        return 'not-found'
      }
      const { videoId, youtubeChannelId, header, card } = found
      const { window, label } = periodOf(url)
      const placement = await placeRow({
        document,
        navigation,
        current,
        after: header,
        // A shown answer placed with no Views number is placed again once Studio draws one, so its
        // figure comes; one placed under a number Studio redraws is placed again under the new one;
        // one whose number Studio takes away takes its figure down before it is read again.
        ...(viewsNumberRow ? { standsOn: viewsNumberRow } : {}),
        root: document,
        youtubeChannelId,
        videoId,
        window,
        ...(label === undefined ? {} : { periodLabel: label }),
        render(shown): PlacedHost[] {
          const { figure, line } = renderVideoAnalytics(shown)
          return [
            ...(figure && viewsNumberRow ? [{ host: figure, after: viewsNumberRow }] : []),
            ...(line ? [{ host: line, before: card }] : []),
          ]
        },
        linkOf: (read): OpenedLink | undefined =>
          read.state === 'read'
            ? {
                text: surfaceText.viewInStillstats,
                href: detailHrefOf({ origin, videoId, channelId: read.channelId, window }),
                opened: () => sendWebAppOpened(ask, 'analytics'),
              }
            : undefined,
      })
      // The figure is the surface's point: a shown answer counts as found only once it is up.
      return typeof placement !== 'string' && placement.placement === 'shown' && !viewsNumberRow
        ? redrawnFrom(placement.fromCache, 'not-found')
        : placement
    },
  }
}
