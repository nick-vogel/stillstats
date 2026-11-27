import type { ListedChannel } from '@creator-analytics/api-types'
import { channelPagesIn, channelTabIn } from '../selectors/channel-page.ts'
import {
  shortsChannelBarIn,
  shortsChannelHrefIn,
  shortsHrefIn,
  shortsPlayerIn,
  shortsPlayersIn,
  shortsTilesIn,
  shortsViewCountIn,
} from '../selectors/shorts.ts'
import {
  cutFrom,
  type PlaceAnswer,
  redrawnFrom,
  type Surface,
  type SurfaceOptions,
  shownFrom,
} from './page-watcher.ts'
import { noPills, type PublicPageReads, pillPlacer, publicPageReads } from './public-pages.ts'
import { removeSurface } from './render.ts'
import {
  channelOfLink,
  heldChannelOf,
  shortsTabOf,
  shortsVideoOf,
  videoIdOfLink,
} from './youtube-url.ts'

/** The Short a Shorts tile links, or undefined. */
const shortIdIn = (tile: Element): string | undefined => {
  const href = shortsHrefIn(tile)
  return href ? videoIdOfLink(href) : undefined
}

type PlacePage = Parameters<Surface['place']>[0]

/** The Shorts player on screen, its channel bar, and the link the bar shows, as far as drawn. */
function channelBarIn(document: Document) {
  const player = shortsPlayerIn(document)
  const bar = player && shortsChannelBarIn(player)
  const channelHref = bar && shortsChannelHrefIn(bar)
  return { player, bar, channelHref }
}

/**
 * A Short the URL named, the bar's link the last pass saw while it did, and the link its pill was
 * first drawn under while it did, if one was.
 */
interface PlayerSeen {
  videoId: string
  channelHref: string | undefined
  drawnUnder?: string
}

/**
 * The creator's Shorts on youtube.com: the engaged views pill after YouTube's view count on each
 * Short of a channel's Shorts tab, and under the channel name in the Shorts player, which shows no
 * view count, for each Short among the creator's uploads (`publicPageReads`). A tile's id and the
 * player URL's `/shorts/<id>` are matched in the browser and never sent (ADR 0016), so whose a Short
 * is depends on no channel link, URL or draw order. Neither page shows a line.
 *
 * One surface for both pages: the watch takes a surface down by its name when its `isOn` is false,
 * and a move between the tab and the player keeps this one on, so each page takes the other's pills
 * down itself. YouTube keeps the page left hidden in the document.
 *
 * The player draws its channel bar in an overlay YouTube reuses across the Shorts it plays. The
 * pill is taken down at the first tick after the URL moves to another Short, and when YouTube points
 * the bar's link elsewhere. After a move it waits while the bar still shows the link it showed for
 * the Short before, that Short has no pill among the uploads, and the link names none of the
 * creator's channels: YouTube may have moved the URL before it redrew the bar. Shorts the URL moved
 * through under one link count as the first of them, since YouTube may have redrawn the bar for
 * none of the rest, until one of them has its pill drawn. It waits until the bar changes, or until
 * the navigation settles, when the bar on the page is the one YouTube draws for the Short. The
 * href is read only to tell a bar left over from another Short, so one Short's figure does not
 * sit under another channel's name while YouTube redraws, never to decide whose the Short is.
 */
export function shorts(
  options: SurfaceOptions,
  reads: PublicPageReads = publicPageReads(options),
): Surface {
  const placer = pillPlacer('shorts')
  /** The Short and channel link the player's pill was drawn for, or undefined when none is. */
  let playerPill: { videoId: string; channelHref: string } | undefined
  /**
   * What the player showed for the Short the URL names, and for the Short it named before. A Short
   * that showed the link the one before it showed is not noted as before: YouTube may not have
   * redrawn the bar for it, so the bar is still the one before's.
   */
  let seen: PlayerSeen | undefined
  let seenBefore: PlayerSeen | undefined

  /** Notes the bar's link the player shows for the URL's Short, `videoId`, at each pass. */
  const note = (videoId: string, channelHref: string | undefined): void => {
    if (seen?.videoId === videoId) {
      seen = { ...seen, channelHref }
      return
    }
    if (seen && seen.channelHref !== seenBefore?.channelHref) seenBefore = seen
    seen = { videoId, channelHref }
  }

  /**
   * Notes the pill drawn for `videoId` under `channelHref`. A Short of a run under one link whose
   * pill was drawn ends the run's wait: the bar it was drawn under is taken for the creator's, so
   * it counts as the Short before for the rest of the run.
   */
  const noteDrawn = (videoId: string, channelHref: string): void => {
    if (seen?.videoId !== videoId) return
    seen = { ...seen, drawnUnder: seen.drawnUnder ?? channelHref }
    if (seenBefore?.channelHref === channelHref) seenBefore = seen
  }

  /**
   * Whether the bar may be the one YouTube drew for the Short before and has not redrawn since:
   * it shows the link it showed then, and neither that Short, by a pill among the uploads' `pills`,
   * nor the link, by naming a held channel, says the bar is the creator's. A link the bar took
   * after that Short's pill was drawn under another is the next Short's, drawn before the URL
   * moved, so that Short's pill says nothing about it.
   */
  const leftOver = (
    channelHref: string,
    pills: ReadonlyMap<string, unknown>,
    channels: readonly ListedChannel[],
  ): boolean => {
    if (!seenBefore || seenBefore.channelHref !== channelHref) return false
    const { videoId, drawnUnder } = seenBefore
    if (pills.has(videoId) && (drawnUnder === undefined || drawnUnder === channelHref)) return false
    const channel = channelOfLink(channelHref)
    return !channel || !heldChannelOf(channel, channels)
  }

  const takePlayerDown = (document: Document): void => {
    for (const player of shortsPlayersIn(document)) removeSurface(player, 'shorts')
    playerPill = undefined
  }

  async function placeTab({ document, navigation, current }: PlacePage): Promise<PlaceAnswer> {
    // The sweep takes the player's pill down at the first tick; a pass no tick runs before, the
    // give-up's, does it here.
    takePlayerDown(document)
    const page = channelTabIn(document)
    if (!page) return 'not-found'
    const tiles = shortsTilesIn(page).flatMap((tile) => {
      const videoId = shortIdIn(tile)
      const viewCount = shortsViewCountIn(tile)
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
      // A tile YouTube pointed at another Short during the read is placed on the next pass.
      if (shortIdIn(tile) !== videoId || shortsViewCountIn(tile) !== viewCount) {
        repointed += 1
        continue
      }
      const view = pills.get(videoId)
      placer.place({ document, tile, after: viewCount, videoId, view, separator: 'none' })
      if (view) {
        shown = true
        placed.add(tile)
      }
    }
    // Every other tile, and one YouTube drew during the read, keeps no pill from an earlier Short.
    for (const tile of shortsTilesIn(page)) if (!placed.has(tile)) removeSurface(tile, 'shorts')
    if (shown) return shownFrom(fromCache)
    return answered && tiles.length > 0 && repointed === tiles.length
      ? redrawnFrom(fromCache, 'placed')
      : 'placed'
  }

  async function placePlayer(
    { document, navigation, current, settled }: PlacePage,
    videoId: string,
  ): Promise<PlaceAnswer> {
    for (const page of channelPagesIn(document)) removeSurface(page, 'shorts')
    const { player, bar, channelHref } = channelBarIn(document)
    note(videoId, channelHref ?? undefined)
    if (!player || !bar || !channelHref) {
      takePlayerDown(document)
      return 'not-found'
    }
    /** Whether the player on screen still shows the bar read, with the same link. */
    const stillShown = () =>
      shortsPlayerIn(document) === player &&
      shortsChannelBarIn(player) === bar &&
      shortsChannelHrefIn(bar) === channelHref

    const [{ pills, fromCache, answered }, channels] = await Promise.all([
      reads.pillsOn(navigation),
      reads.heldChannels(navigation),
    ])
    if (!current()) return cutFrom(fromCache)
    // YouTube redrew the bar during the read, or may yet redraw it for this Short: the pass its
    // redraw starts, or the settled pass, judges the player as it is.
    const view = pills.get(videoId)
    if (!stillShown() || (view && !settled && leftOver(channelHref, pills, channels))) {
      takePlayerDown(document)
      return answered ? redrawnFrom(fromCache, 'placed') : 'placed'
    }
    // The pill is the channel bar's next sibling, on its own line under the channel name, with space
    // above it.
    placer.place({
      document,
      tile: player,
      after: bar,
      videoId,
      view,
      separator: 'none',
      layout: 'under-channel-bar',
    })
    playerPill = view ? { videoId, channelHref } : undefined
    if (view) noteDrawn(videoId, channelHref)
    return view ? shownFrom(fromCache) : 'placed'
  }

  return {
    name: 'shorts',
    isOn: (url) => shortsTabOf(url) !== undefined || shortsVideoOf(url) !== undefined,
    found: (document, url) =>
      shortsTabOf(url) ? channelTabIn(document) !== null : !!channelBarIn(document).channelHref,
    // Before any read: one Short's figure never sits under another Short's channel name.
    sweep(document) {
      placer.takeDownRepointed(shortsTilesIn(document), shortIdIn)
      if (!playerPill) return
      const player = shortsPlayerIn(document)
      const bar = player && shortsChannelBarIn(player)
      if (
        shortsVideoOf(document.URL) !== playerPill.videoId ||
        !bar ||
        shortsChannelHrefIn(bar) !== playerPill.channelHref
      )
        takePlayerDown(document)
    },
    place(page) {
      if (shortsTabOf(page.url)) return placeTab(page)
      const videoId = shortsVideoOf(page.url)
      return videoId ? placePlayer(page, videoId) : Promise.resolve('not-found')
    },
  }
}
