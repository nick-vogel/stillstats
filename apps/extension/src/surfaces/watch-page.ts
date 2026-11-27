import { isMetadataOf, viewCountUnderTitleIn, watchMetadataIn } from '../selectors/watch-page.ts'
import {
  cutFrom,
  redrawnFrom,
  type Surface,
  type SurfaceOptions,
  shownFrom,
} from './page-watcher.ts'
import { type PublicPageReads, pillPlacer, publicPageReads } from './public-pages.ts'
import { removeSurface } from './render.ts'
import { watchVideoOf } from './youtube-url.ts'

/**
 * The watch page on youtube.com: the engaged views pill after the view count under the title, when
 * the page URL's video, its `v`, is among the creator's uploads (`publicPageReads`). The `v` is
 * matched in the browser and never sent (ADR 0016), and the owner link decides nothing, so a video
 * of a channel the creator does not hold shows no pill whatever YouTube has drawn. The page never
 * shows a line. The sidebar's tiles are the feed surface's.
 *
 * YouTube reuses the block under the player when it moves to another video without a reload, and may
 * redraw it before or after the URL moves. The block names the video it was drawn for in its
 * `video-id`, which the surface matches in a selector against the URL's `v` and never reads, so one
 * video's figure never sits beside another's view count: until they agree the pill is down.
 */
export function watchPageSurface(
  options: SurfaceOptions,
  reads: PublicPageReads = publicPageReads(options),
): Surface {
  const placer = pillPlacer('watch_page')
  /** The video the pill on screen was drawn for, or undefined when none is drawn. */
  let pillFor: string | undefined

  const takeDown = (document: Document): void => {
    removeSurface(document, 'watch_page')
    pillFor = undefined
  }

  /** The block on screen, if YouTube drew it for `videoId`. */
  const metadataFor = (document: Document, videoId: string): Element | null => {
    const metadata = watchMetadataIn(document)
    return metadata && isMetadataOf(metadata, videoId) ? metadata : null
  }

  /** The view count under the title of the block YouTube drew for the URL's video, or null. */
  const viewCountFor = (document: Document, url: string): Element | null => {
    const videoId = watchVideoOf(url)
    const metadata = videoId ? metadataFor(document, videoId) : null
    return metadata && viewCountUnderTitleIn(metadata)
  }

  return {
    name: 'watch_page',
    isOn: (url) => watchVideoOf(url) !== undefined,
    found: (document, url) => viewCountFor(document, url) !== null,
    // Before any read: one video's figure never sits beside another's count while that one's is out.
    sweep(document) {
      const videoId = watchVideoOf(document.URL)
      if (!videoId || pillFor !== videoId || !metadataFor(document, videoId)) takeDown(document)
    },
    async place({ document, url, navigation, current }) {
      const videoId = watchVideoOf(url)
      const metadata = watchMetadataIn(document)
      const viewCount = metadata && viewCountUnderTitleIn(metadata)
      // YouTube still shows another video's block, or drew the next one before moving the URL: the
      // view count under this video's title is not there (yet). After the settle, it is missing.
      if (!videoId || !metadata || !viewCount || !isMetadataOf(metadata, videoId)) {
        takeDown(document)
        return 'not-found'
      }

      const { pills, fromCache, answered } = await reads.pillsOn(navigation)
      if (!current()) return cutFrom(fromCache)
      // YouTube changed the block during the read: the next pass judges the page as it is.
      const shownCount =
        metadataFor(document, videoId) === metadata && viewCountUnderTitleIn(metadata)
      if (!shownCount) {
        takeDown(document)
        return answered ? redrawnFrom(fromCache, 'not-found') : 'not-found'
      }
      const view = pills.get(videoId)
      placer.place({
        document,
        tile: metadata,
        after: shownCount,
        videoId,
        view,
        separator: 'two-spaces',
      })
      pillFor = view ? videoId : undefined
      return view ? shownFrom(fromCache) : 'placed'
    },
  }
}
