import type {
  ExtensionSurface,
  VideoListAnswer,
  VideoRow,
  VideoWindow,
} from '@creator-analytics/api-types'
import type { VideosRead } from '../product-api.ts'
import type { ComparisonView } from './comparison.ts'
import {
  cutFrom,
  isKept,
  type PlaceAnswer,
  type Placement,
  readVideosAndSendHeldClicks,
  redrawnFrom,
  type SurfaceOptions,
  shownFrom,
} from './page-watcher.ts'
import { type LineOpened, type OpenedLink, removeSurface, renderSurface } from './render.ts'
import { type SurfaceView, showsAnswer, surfaceViewOf } from './states.ts'

/**
 * An element of the extension's own, and the Studio element it goes directly after, or directly
 * before, such as the analytics page's line before Studio's key metric card, whose previous
 * sibling is no element to anchor to.
 */
export type PlacedHost =
  | { host: HTMLElement; after: Element }
  | { host: HTMLElement; before: Element }

/** The Studio element `placed` goes beside. */
function anchorOf(placed: PlacedHost): Element {
  return 'after' in placed ? placed.after : placed.before
}

/** What a surface draws for one video, given what `videoRowPlacer` read. */
export interface VideoShown {
  document: Document
  surface: ExtensionSurface
  view: SurfaceView
  comparison: ComparisonView | undefined
  periodLabel: string | undefined
  link: OpenedLink | undefined
  lineOpened: LineOpened
}

/**
 * How a surface draws its elements for one video: each host with the Studio element it goes
 * after or before, none for a view that shows nothing.
 */
export type VideoRender = (shown: VideoShown) => readonly PlacedHost[]

/**
 * A placer for `surface`: each call places one video's engaged views in elements of the
 * extension's own, each directly after or before a Studio element, or keeps the elements it placed
 * for the same video, window and period while every one of them is on the page, and, for a shown
 * answer, while it stands on the same `standsOn` element. Before it keeps or reads, it takes down
 * every placement that may still be up when it is for another video, window or period, and a
 * shown answer's elements beside a `standsOn` element Studio has taken away or redrawn. By default
 * the element is one row after `after`; a surface that draws more, such as the analytics page's
 * figure in Studio's Views tile and its line above Studio's key metric card, gives its own
 * `render`. Studio's elements stay as they are.
 */
export function videoRowPlacer(
  surface: ExtensionSurface,
  options: SurfaceOptions,
): (row: {
  document: Document
  /**
   * The navigation the pass places for: see `Surface.place`. A shown figure kept for a later one
   * answers from the cache, since that navigation sent no request.
   */
  navigation: number
  /**
   * The Studio element the placement is held by, which the default row goes after: a new element
   * there is a new placement. A surface with its own `render` says where each element goes.
   */
  after: Element
  /**
   * A Studio element a shown answer also stands on, such as the analytics page's Views number row
   * the figure goes after: a shown placement is kept only while this is the same element, and a
   * new one, or none, is a new placement. A line state's placement does not stand on it.
   */
  standsOn?: Element
  /** Where an element of the surface left beside an element Studio redrew is removed from. */
  root: ParentNode
  youtubeChannelId: string
  videoId: string
  window: VideoWindow
  /**
   * The period said under the figure when it is not Studio's, such as the analytics page's
   * "Lifetime". A new label is a new placement.
   */
  periodLabel?: string
  linkOf?: (read: VideosRead) => OpenedLink | undefined
  /** Draws the surface's elements in place of the one row after `after`. */
  render?: VideoRender
  /**
   * The row under the figure that compares the video with others, when the surface has one. Asked
   * only for a video the read answered, with the answer it came from, such as for its last
   * processed day, before the row is drawn, so both show together. `'unread'` is a comparison due
   * but not read: the figure shows without it and is kept only as long as a line, so both are
   * asked again once `signedInReadKeptMs` has passed. `fromCache` is true when every read it made
   * answered from the cache, or it made none: the figure waits on them, so its cache result counts
   * them.
   */
  comparisonOf?: (
    video: VideoRow,
    answer: VideoListAnswer,
  ) => Promise<{ comparison: ComparisonView | 'unread' | undefined; fromCache: boolean }>
  /** False once Studio has navigated since the pass began: see `Surface.place`. */
  current(): boolean
}) => Promise<PlaceAnswer> {
  const { origin, locale, lineClicks } = options
  /** Per Studio element, what the extension placed for it. */
  const placed = new WeakMap<Element, PlacedEntry>()
  /**
   * Every placement that may still be up, whatever Studio element holds it: an element for another
   * video, window or period, such as a key metric card Studio redrew on a move or put back, takes
   * it down before it keeps or reads, so another video's, window's or period's numbers never stay
   * up. Its bound: when a read places, every earlier placement left in the set is for the same read
   * and superseded, so its elements Studio took off the page (in a subtree Studio detached, which
   * may come back) come down too, and a placement with none of its elements left in a parent
   * leaves the set. After a pass that places, the set holds that placement and those of the same
   * read with an element still on the page outside `root`; a pass that keeps or finds nothing adds
   * none.
   */
  const mayBeUp = new Set<PlacedEntry>()

  return async ({
    document,
    navigation,
    after,
    standsOn,
    root,
    youtubeChannelId,
    videoId,
    window,
    periodLabel,
    linkOf,
    render,
    comparisonOf,
    current,
  }) => {
    const held = placed.get(after)
    const forThisRead = (entry: PlacedEntry) =>
      entry.videoId === videoId && entry.window === window && entry.periodLabel === periodLabel
    // A placement for another read comes down whole. A shown figure stands beside its `standsOn`
    // element: once Studio takes that away or draws a new one, the figure is beside the wrong
    // number or none, so it comes down before the pass keeps or reads. The rest of a placement for
    // this read, such as a line, stays: a keep leaves it up, and a read takes it down only once it
    // places the new one.
    const judge = (before: PlacedEntry) => {
      if (!forThisRead(before)) {
        for (const host of before.hosts) host.remove()
        mayBeUp.delete(before)
      } else if (before.placement === 'shown' && before.standsOn !== standsOn)
        for (const host of before.standing) host.remove()
    }
    for (const before of mayBeUp) if (before !== held) judge(before)
    if (
      held &&
      forThisRead(held) &&
      held.hosts.every((host) => host.isConnected) &&
      (held.placement !== 'shown' || held.standsOn === standsOn) &&
      isKept({ placement: held.keptAs, at: held.at })
    ) {
      return held.placement === 'shown'
        ? shownFrom(held.navigation === navigation ? held.fromCache : true)
        : held.placement
    }
    if (held) judge(held)

    const read = await readVideosAndSendHeldClicks(options, {
      youtubeChannelId,
      ids: [videoId],
      window,
    })
    // Studio may redraw its element, or navigate to another video or period, while the background
    // answers; the next pass places it then.
    if (!current()) return cutFrom(read.state === 'read' && read.answer.fromCache)
    if (!after.isConnected)
      return read.state === 'read' ? redrawnFrom(read.answer.fromCache, 'not-found') : 'not-found'
    const view = surfaceViewOf({ read, videoId, origin, locale })
    const answer = read.state === 'read' && showsAnswer(view) ? read.answer : undefined
    const video = answer?.videos.find(({ id }) => id === videoId)
    const compared = answer && video ? await comparisonOf?.(video, answer) : undefined
    const comparison = compared?.comparison
    const fromCache = answer?.fromCache === true && (compared?.fromCache ?? true)
    if (!current()) return cutFrom(fromCache)
    if (!after.isConnected)
      return read.state === 'read'
        ? redrawnFrom(read.answer.fromCache && (compared?.fromCache ?? true), 'not-found')
        : 'not-found'
    const shown: VideoShown = {
      document,
      surface,
      view,
      comparison: comparison === 'unread' ? undefined : comparison,
      periodLabel,
      link: linkOf?.(read),
      lineOpened: (click) => lineClicks.opened(surface, click),
    }
    const placing = render ? render(shown) : rowAfter(after, renderSurface(shown))
    if (!placing.every((each) => anchorOf(each).isConnected))
      return read.state === 'read'
        ? redrawnFrom(read.answer.fromCache && (compared?.fromCache ?? true), 'not-found')
        : 'not-found'
    removeSurface(root, surface)
    for (const each of placing) {
      if ('after' in each) each.after.after(each.host)
      else each.before.before(each.host)
    }
    const placement: Placement = showsAnswer(view) ? 'shown' : 'placed'
    const keptAs: Placement = comparison === 'unread' ? 'placed' : placement
    const hosts = placing.map(({ host }) => host)
    const standing = placing.flatMap((each) =>
      standsOn !== undefined && anchorOf(each) === standsOn ? [each.host] : [],
    )
    const entry: PlacedEntry = {
      navigation,
      videoId,
      window,
      periodLabel,
      standsOn,
      hosts,
      standing,
      placement,
      keptAs,
      fromCache,
      at: Date.now(),
    }
    placed.set(after, entry)
    for (const each of mayBeUp) {
      for (const host of each.hosts) if (!host.isConnected) host.remove()
      if (each.hosts.every((host) => host.parentNode === null)) mayBeUp.delete(each)
    }
    mayBeUp.add(entry)
    return placement === 'shown' ? shownFrom(entry.fromCache) : placement
  }
}

/**
 * What `videoRowPlacer` placed for one Studio element: the video, window and period the extension
 * answered for, the element a shown answer stood on, its own elements (none for a view that shows
 * nothing), whether it shows the extension's numbers, how it is kept (as a line when its comparison
 * was not read), whether every answer it was drawn from came from the cache, which a keep of it
 * for the same navigation answers again, and when and for which navigation.
 */
interface PlacedEntry {
  navigation: number
  videoId: string
  window: VideoWindow
  periodLabel: string | undefined
  standsOn: Element | undefined
  hosts: readonly Element[]
  /** The hosts placed beside `standsOn`, such as the analytics page's figure. */
  standing: readonly Element[]
  placement: Placement
  keptAs: Placement
  fromCache: boolean
  at: number
}

/** The default placement: the one row, if the view shows one, directly after `after`. */
function rowAfter(after: Element, host: HTMLElement | undefined): readonly PlacedHost[] {
  return host ? [{ host, after }] : []
}
