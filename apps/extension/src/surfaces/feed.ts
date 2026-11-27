import {
  homeFeedIn,
  searchResultsIn,
  searchTilesIn,
  searchVideoHrefIn,
  searchViewCountIn,
  watchSidebarIn,
} from '../selectors/feed.ts'
import { metadataRowOf, videoHrefIn, videoTilesIn, viewCountIn } from '../selectors/lockup.ts'
import {
  cutFrom,
  redrawnFrom,
  type Surface,
  type SurfaceOptions,
  shownFrom,
} from './page-watcher.ts'
import { noPills, type PublicPageReads, pillPlacer, publicPageReads } from './public-pages.ts'
import type { PillLayout, PillSeparator } from './render.ts'
import { videoIdOfLink } from './youtube-url.ts'

/** The feed's pages: the home feed, search results, and the watch page, for its sidebar. */
type FeedPage = '/' | '/results' | '/watch'

/** The feed's page `url` shows, or undefined for any other page on www.youtube.com and off it. */
function feedPageOf(url: string): FeedPage | undefined {
  const page = new URL(url)
  if (page.origin !== 'https://www.youtube.com') return undefined
  const { pathname } = page
  return pathname === '/' || pathname === '/results' || pathname === '/watch' ? pathname : undefined
}

/**
 * How the feed reads one page's tiles: where they are, and each one's video link and view count;
 * what of a tile its pills follow, given the view count; the separator they open with, which
 * YouTube's line there takes before its next item; and how their host sits there.
 */
interface FeedTiles {
  container(document: Document): Element | null
  tilesIn(container: Element): Element[]
  hrefIn(tile: Element): string | null
  viewCountIn(tile: Element): Element | null
  pillAfter(viewCount: Element): Element | null
  separator: PillSeparator
  layout: PillLayout
}

const lockups = (container: (document: Document) => Element | null): FeedTiles => ({
  container,
  tilesIn: videoTilesIn,
  hrefIn: videoHrefIn,
  viewCountIn,
  pillAfter: (viewCount) => viewCount,
  separator: 'space',
  layout: 'inline',
})

const tilesOf: Record<FeedPage, FeedTiles> = {
  '/': lockups(homeFeedIn),
  // The sidebar's tiles are narrow, and a pill inline after the view count broke onto two lines
  // there and cut the date off, so the pill is a row of its own under the view count's row, as one
  // more of YouTube's rows, with no separator (creator-analytics#627's hand check).
  '/watch': {
    ...lockups(watchSidebarIn),
    pillAfter: metadataRowOf,
    separator: 'none',
    layout: 'row',
  },
  '/results': {
    container: searchResultsIn,
    tilesIn: searchTilesIn,
    hrefIn: searchVideoHrefIn,
    viewCountIn: searchViewCountIn,
    pillAfter: (viewCount) => viewCount,
    separator: 'dot',
    layout: 'inline',
  },
}

/** The tile container of the feed page `url` shows, or null off the feed's pages. */
function containerOf(document: Document, url: string): Element | null {
  const page = feedPageOf(url)
  return page ? tilesOf[page].container(document) : null
}

const videoIdIn = (read: FeedTiles, tile: Element): string | undefined => {
  const href = read.hrefIn(tile)
  return href ? videoIdOfLink(href) : undefined
}

/** The feed's pills anywhere in `document`. */
const feedPillsIn = (document: Document) => [
  ...document.querySelectorAll('[data-stillstats-surface="feed"]'),
]

/**
 * The home feed, search results and the watch page's sidebar on youtube.com: the engaged views pill
 * after YouTube's view count, in the sidebar on a row of its own under the view count's row, on each
 * tile whose video is among the creator's uploads
 * (`publicPageReads`). No tile id leaves the browser (ADR 0016), and no channel link decides
 * anything, so a sidebar tile, which carries none, gets its pill too. A Shorts shelf's tiles are not
 * the feed's. Tiles YouTube adds as the creator scrolls are matched against the same read. A feed
 * with none of the creator's videos is `placed`, so `extension_surface_missing` keeps meaning its
 * container is not there. YouTube keeps the pages it showed before in the document, the sidebar
 * among them, so the feed's pills stand only in the container of the page the URL shows. The feed
 * never shows a line.
 */
export function feed(
  options: SurfaceOptions,
  reads: PublicPageReads = publicPageReads(options),
): Surface {
  const placer = pillPlacer('feed')

  /** Takes every feed pill down that is not on one of `kept`. */
  const takeDownAllBut = (document: Document, kept: ReadonlySet<Element>): void => {
    for (const host of feedPillsIn(document)) {
      let on = host.parentElement
      while (on && !kept.has(on)) on = on.parentElement
      if (!on) host.remove()
    }
  }

  return {
    name: 'feed',
    isOn: (url) => feedPageOf(url) !== undefined,
    found: (document, url) => containerOf(document, url) !== null,
    // A move among the feed's pages leaves the feed on: the last page's pills go at once, before the
    // next page's read lands.
    sweep(document) {
      const container = containerOf(document, document.URL)
      for (const host of feedPillsIn(document)) if (!container?.contains(host)) host.remove()
      const page = feedPageOf(document.URL)
      if (!page || !container) return
      const read = tilesOf[page]
      placer.takeDownRepointed(read.tilesIn(container), (tile) => videoIdIn(read, tile))
    },
    async place({ document, url, navigation, current }) {
      const page = feedPageOf(url)
      const read = page && tilesOf[page]
      const container = containerOf(document, url)
      if (!read || !container) return 'not-found'
      const tiles = read.tilesIn(container).flatMap((tile) => {
        const videoId = videoIdIn(read, tile)
        const viewCount = read.viewCountIn(tile)
        const after = viewCount && read.pillAfter(viewCount)
        return videoId && viewCount && after ? [{ tile, videoId, viewCount, after }] : []
      })
      // A feed with no id to match reads nothing.
      const { pills, fromCache, answered } =
        tiles.length > 0 ? await reads.pillsOn(navigation) : noPills
      if (!current()) return cutFrom(fromCache)
      let repointed = 0
      const placed = new Set<Element>()
      for (const { tile, videoId, viewCount, after } of tiles) {
        // A tile YouTube pointed at another video during the read is placed on the next pass.
        if (
          videoIdIn(read, tile) !== videoId ||
          read.viewCountIn(tile) !== viewCount ||
          read.pillAfter(viewCount) !== after
        ) {
          repointed += 1
          continue
        }
        const view = pills.get(videoId)
        const { separator, layout } = read
        placer.place({ document, tile, after, videoId, view, separator, layout })
        if (view) placed.add(tile)
      }
      // Every other tile, one YouTube redrew during the read, and any page the URL no longer shows
      // keep no pill.
      takeDownAllBut(document, placed)
      if (placed.size > 0) return shownFrom(fromCache)
      return answered && tiles.length > 0 && repointed === tiles.length
        ? redrawnFrom(fromCache, 'placed')
        : 'placed'
    },
  }
}
