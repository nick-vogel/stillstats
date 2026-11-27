import { type VideoWindow, videoWindowDays } from '@creator-analytics/api-types'
import { analyticsHrefIn, latestVideoCardIn, viewsRowIn } from '../selectors/card.ts'
import { comparedUploads, comparisonOf, daysProcessedOf, windowCovering } from './comparison.ts'
import { readVideosAndSendHeldClicks, type Surface, type SurfaceOptions } from './page-watcher.ts'
import { channelIdOf, isDashboard, videoIdOf } from './studio-url.ts'
import { videoRowPlacer } from './video-row.ts'

/** The latest video card's video and the Views row its figure goes after, once Studio draws them. */
function cardIn(document: Document, url: string) {
  const card = latestVideoCardIn(document)
  const href = card && analyticsHrefIn(card)
  const videoId = href ? videoIdOf(href) : undefined
  const viewsRow = card && viewsRowIn(card)
  const youtubeChannelId = channelIdOf(url)
  return card && viewsRow && videoId && youtubeChannelId
    ? { card, viewsRow, videoId, youtubeChannelId }
    : undefined
}

/**
 * The latest video card on the Studio dashboard: the video's lifetime engaged views, in a row of
 * the extension's own directly after Studio's Views row, and under it the video's place among the
 * newest public uploads of its format by engaged views over the same days since publish: each
 * upload's first N days, N being the days Google has processed for the card video. Studio's rows
 * stay as they are.
 */
export function latestVideoCard(options: SurfaceOptions): Surface {
  const placeRow = videoRowPlacer('card', options)

  return {
    name: 'card',
    isOn: isDashboard,
    found: (document, url) => cardIn(document, url) !== undefined,
    async place({ document, url, navigation, current }) {
      const found = cardIn(document, url)
      if (!found) return 'not-found'
      const { card, viewsRow, videoId, youtubeChannelId } = found
      return placeRow({
        document,
        navigation,
        current,
        after: viewsRow,
        root: card,
        youtubeChannelId,
        videoId,
        window: 'lifetime',
        // Only a public, processed upload with a format has a place among the newest of its format.
        // Every format read counts toward the figure's cache result, since the figure waits on it:
        // one with no answer is not from the cache.
        async comparisonOf(video, answer) {
          if (video.privacy !== 'public' || video.format === null || video.awaitingProcessing)
            return { comparison: undefined, fromCache: true }
          const days = daysProcessedOf(video.publishedAt, answer.lastProcessedDay)
          if (days === 0) return { comparison: undefined, fromCache: true }
          const query = { youtubeChannelId, format: video.format, newest: comparedUploads }
          let fromCache = true
          const formatRead = async (window: VideoWindow) => {
            const read = await readVideosAndSendHeldClicks(options, { ...query, window })
            fromCache &&= read.state === 'read' && read.answer.fromCache
            return read
          }
          const window = windowCovering(days)
          let read = await formatRead(window)
          // A format read with no answer is asked again, as a line is: see `videoRowPlacer`.
          if (read.state !== 'read') return { comparison: 'unread', fromCache }
          // The API caps each upload's days at the window's length. A format read counted past the
          // figure's day, with the card video at the window's edge, holds fewer days than Google has
          // processed, so it is asked once more in the window that covers them all.
          const longer = windowCovering(
            daysProcessedOf(video.publishedAt, read.answer.lastProcessedDay),
          )
          const held = read.answer.videos.find(({ id }) => id === video.id)?.engagedViewsByDay
          if (
            held?.length === videoWindowDays[window] &&
            videoWindowDays[longer] > videoWindowDays[window]
          ) {
            read = await formatRead(longer)
            if (read.state !== 'read') return { comparison: 'unread', fromCache }
          }
          const comparison = comparisonOf(video, read)
          // A format read counted to an earlier day than the figure that gives no place is asked
          // again too, since a later one can.
          return {
            comparison:
              comparison === undefined && read.answer.lastProcessedDay < answer.lastProcessedDay
                ? 'unread'
                : comparison,
            fromCache,
          }
        },
      })
    },
  }
}
