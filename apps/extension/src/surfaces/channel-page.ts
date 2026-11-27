import { channelTabIn } from '../selectors/channel-page.ts'
import { videoHrefIn, videoTilesIn, viewCountIn } from '../selectors/lockup.ts'
import {
  cutFrom,
  redrawnFrom,
  type Surface,
  type SurfaceOptions,
  shownFrom,
} from './page-watcher.ts'
import { noPills, type PublicPageReads, pillPlacer, publicPageReads } from './public-pages.ts'
import { removeSurface } from './render.ts'
import { channelTabOf, videoIdOfLink } from './youtube-url.ts'

/** The video a lockup tile links, or undefined. */
const videoIdIn = (tile: Element): string | undefined => {
  const href = videoHrefIn(tile)
  return href ? videoIdOfLink(href) : undefined
}

/**
 * A channel's Videos, Live and Home tabs on youtube.com: the engaged views pill after YouTube's view
 * count on each tile whose video is among the creator's uploads (`publicPageReads`), any channel's tab
 * alike, so a featured video of theirs on another channel's tab gets its pill too. No tile id leaves
 * the browser (ADR 0016). Whose a tile is depends on nothing YouTube draws or the order it draws in:
 * a grid YouTube reuses across an in-page move, its old tiles drawn late or the next channel's drawn
 * early, shows a pill only on a tile that is the creator's. The tab never shows a line.
 */
export function channelPage(
  options: SurfaceOptions,
  reads: PublicPageReads = publicPageReads(options),
): Surface {
  const placer = pillPlacer('channel_page')
  return {
    name: 'channel_page',
    isOn: (url) => channelTabOf(url) !== undefined,
    sweep(document) {
      placer.takeDownRepointed(videoTilesIn(document), videoIdIn)
    },
    found: (document) => channelTabIn(document) !== null,
    async place({ document, navigation, current }) {
      const page = channelTabIn(document)
      if (!page) return 'not-found'
      const tiles = videoTilesIn(page).flatMap((tile) => {
        const videoId = videoIdIn(tile)
        const viewCount = viewCountIn(tile)
        return videoId && viewCount ? [{ tile, videoId, viewCount }] : []
      })
      // A page with no id to match reads nothing.
      const { pills, fromCache, answered } =
        tiles.length > 0 ? await reads.pillsOn(navigation) : noPills
      if (!current()) return cutFrom(fromCache)
      let shown = false
      let repointed = 0
      const placed = new Set<Element>()
      for (const { tile, videoId, viewCount } of tiles) {
        // A tile YouTube pointed at another video during the read is placed on the next pass.
        if (videoIdIn(tile) !== videoId || viewCountIn(tile) !== viewCount) {
          repointed += 1
          continue
        }
        const view = pills.get(videoId)
        placer.place({ document, tile, after: viewCount, videoId, view, separator: 'space' })
        if (view) {
          shown = true
          placed.add(tile)
        }
      }
      // Every other tile, and one YouTube drew during the read, keeps no pill from an earlier video.
      for (const tile of videoTilesIn(page))
        if (!placed.has(tile)) removeSurface(tile, 'channel_page')
      if (shown) return shownFrom(fromCache)
      return answered && tiles.length > 0 && repointed === tiles.length
        ? redrawnFrom(fromCache, 'placed')
        : 'placed'
    },
  }
}
